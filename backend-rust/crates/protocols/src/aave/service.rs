use super::models::*;
use crate::types::{PositionToken, PositionType, ProtocolPosition, YieldComponent, YieldInfo};
use defi10_core::{http_helpers::check_and_parse, Chain, DeFi10Error, Protocol, Result};
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;

const AAVE_V3_API_ENDPOINT: &str = "https://api.v3.aave.com/graphql";

#[derive(Debug, Clone)]
struct ChainConfig {
    market_address: &'static str,
    chain_id: i64,
}

fn get_chain_configs() -> HashMap<Chain, ChainConfig> {
    let mut configs = HashMap::new();

    configs.insert(
        Chain::Base,
        ChainConfig {
            market_address: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
            chain_id: 8453,
        },
    );

    configs.insert(
        Chain::Ethereum,
        ChainConfig {
            market_address: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
            chain_id: 1,
        },
    );

    configs.insert(
        Chain::Arbitrum,
        ChainConfig {
            market_address: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb",
            chain_id: 42161,
        },
    );

    configs
}

fn get_token_decimals(symbol: &str, chain: Chain, api_decimals: Option<u8>) -> u8 {
    defi10_core::token_decimals::get_token_decimals(symbol, chain, api_decimals)
}

#[derive(Debug, Clone, Default)]
pub struct AaveGraphConfig {
    pub api_key: Option<String>,
    pub url_template: Option<String>,
    pub base_subgraph_id: Option<String>,
    pub ethereum_subgraph_id: Option<String>,
    pub arbitrum_subgraph_id: Option<String>,
}

pub struct AaveV3Service {
    client: Arc<Client>,
    chain_configs: HashMap<Chain, ChainConfig>,
    graph_config: AaveGraphConfig,
}

impl AaveV3Service {
    pub fn new() -> Self {
        Self::with_config(AaveGraphConfig::default())
    }

    pub fn with_config(config: AaveGraphConfig) -> Self {
        Self::with_client(Arc::new(Client::new()), config)
    }

    pub fn with_client(client: Arc<Client>, config: AaveGraphConfig) -> Self {
        tracing::info!(
            "Aave V3 service configured using official API: {}",
            AAVE_V3_API_ENDPOINT
        );

        Self {
            client,
            chain_configs: get_chain_configs(),
            graph_config: config,
        }
    }

    pub fn is_chain_supported(&self, chain: Chain) -> bool {
        self.chain_configs.contains_key(&chain)
    }

    pub async fn get_user_positions(
        &self,
        chain: Chain,
        user_address: &str,
    ) -> Result<Vec<ProtocolPosition>> {
        let chain_config = self
            .chain_configs
            .get(&chain)
            .ok_or(DeFi10Error::ChainNotSupported(chain))?;

        let mut positions = Vec::new();

        let supplies = self.fetch_user_supplies(user_address, chain_config).await?;
        let borrows = self.fetch_user_borrows(user_address, chain_config).await?;

        let total_collateral_usd: f64 = supplies
            .iter()
            .filter(|s| s.is_collateral)
            .map(|s| s.balance.usd)
            .sum();
        let total_debt_usd: f64 = borrows.iter().map(|b| b.debt.usd).sum();

        const ASSUMED_LT: f64 = 0.8;
        let health_factor = if total_debt_usd > 0.0 {
            (total_collateral_usd * ASSUMED_LT) / total_debt_usd
        } else {
            f64::MAX
        };

        for supply in supplies {
            if supply.balance.usd > 0.0 {
                let position =
                    self.create_supply_position(chain, user_address, &supply, health_factor)?;
                positions.push(position);
            }
        }

        for borrow in borrows {
            if borrow.debt.usd > 0.0 {
                let position =
                    self.create_borrow_position(chain, user_address, &borrow, health_factor)?;
                positions.push(position);
            }
        }

        Ok(positions)
    }

    async fn fetch_user_supplies(
        &self,
        user_address: &str,
        chain_config: &ChainConfig,
    ) -> Result<Vec<UserSupply>> {
        let query = r#"
            query UserSupplies($marketAddress: String!, $chainId: Int!, $user: String!) {
                userSupplies(request: { markets: [{ address: $marketAddress, chainId: $chainId }] user: $user }) {
                    market { name chain { chainId } }
                    currency { symbol name address decimals }
                    balance { amount { value decimals } usd }
                    apy { raw decimals value formatted }
                    isCollateral
                    canBeCollateral
                }
            }
        "#;

        let body = serde_json::json!({
            "query": query,
            "variables": {
                "marketAddress": chain_config.market_address,
                "chainId": chain_config.chain_id,
                "user": user_address
            }
        });

        let response = self
            .client
            .post(AAVE_V3_API_ENDPOINT)
            .json(&body)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(e.to_string()))?;

        let result: AaveUserSuppliesResponse = check_and_parse(response, "Aave API").await?;

        Ok(result.data.map(|d| d.user_supplies).unwrap_or_default())
    }

    async fn fetch_user_borrows(
        &self,
        user_address: &str,
        chain_config: &ChainConfig,
    ) -> Result<Vec<UserBorrow>> {
        let query = r#"
            query UserBorrows($marketAddress: String!, $chainId: Int!, $user: String!) {
                userBorrows(request: { markets: [{ address: $marketAddress, chainId: $chainId }] user: $user }) {
                    market { name chain { chainId } }
                    currency { symbol name address decimals }
                    debt { amount { value decimals } usd }
                    apy { raw decimals value formatted }
                }
            }
        "#;

        let body = serde_json::json!({
            "query": query,
            "variables": {
                "marketAddress": chain_config.market_address,
                "chainId": chain_config.chain_id,
                "user": user_address
            }
        });

        let response = self
            .client
            .post(AAVE_V3_API_ENDPOINT)
            .json(&body)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(e.to_string()))?;

        let result: AaveUserBorrowsResponse = check_and_parse(response, "Aave API").await?;

        Ok(result.data.map(|d| d.user_borrows).unwrap_or_default())
    }

    fn create_supply_position(
        &self,
        chain: Chain,
        user_address: &str,
        supply: &UserSupply,
        health_factor: f64,
    ) -> Result<ProtocolPosition> {
        let balance: f64 = supply.balance.amount.value.parse().unwrap_or(0.0);
        let balance_usd = supply.balance.usd;
        let price_usd = if balance > 0.0 {
            balance_usd / balance
        } else {
            0.0
        };
        let apy = supply
            .apy
            .value
            .as_ref()
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(0.0)
            * 100.0;

        let decimals = get_token_decimals(
            &supply.currency.symbol,
            chain,
            supply.currency.decimals.or(supply.balance.amount.decimals),
        );

        let token = PositionToken {
            token_address: supply.currency.address.clone(),
            symbol: supply.currency.symbol.clone(),
            name: supply.currency.name.clone(),
            decimals,
            balance: balance.to_string(),
            balance_usd,
            price_usd,
            token_type: Some("Supplied".to_string()),
        };

        let hf_value = if health_factor.is_infinite() || health_factor > 1e10 {
            serde_json::Value::Null
        } else {
            serde_json::json!(health_factor)
        };

        Ok(ProtocolPosition {
            protocol: Protocol::AaveV3,
            chain,
            wallet_address: user_address.to_string(),
            position_type: PositionType::Lending,
            tokens: vec![token],
            total_value_usd: balance_usd,
            metadata: serde_json::json!({
                "apy": apy,
                "healthFactor": hf_value,
                "is_collateral": supply.is_collateral,
                "can_be_collateral": supply.can_be_collateral,
                "asset_name": supply.currency.name,
            }),
        })
    }

    fn create_borrow_position(
        &self,
        chain: Chain,
        user_address: &str,
        borrow: &UserBorrow,
        health_factor: f64,
    ) -> Result<ProtocolPosition> {
        let balance: f64 = borrow.debt.amount.value.parse().unwrap_or(0.0);
        let balance_usd = borrow.debt.usd;
        let price_usd = if balance > 0.0 {
            balance_usd / balance
        } else {
            0.0
        };
        let apy = -borrow
            .apy
            .value
            .as_ref()
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(0.0)
            * 100.0;

        let decimals = get_token_decimals(
            &borrow.currency.symbol,
            chain,
            borrow.currency.decimals.or(borrow.debt.amount.decimals),
        );

        let token = PositionToken {
            token_address: borrow.currency.address.clone(),
            symbol: borrow.currency.symbol.clone(),
            name: borrow.currency.name.clone(),
            decimals,
            balance: balance.to_string(),
            balance_usd,
            price_usd,
            token_type: Some("Borrowed".to_string()),
        };

        let hf_value = if health_factor.is_infinite() || health_factor > 1e10 {
            serde_json::Value::Null
        } else {
            serde_json::json!(health_factor)
        };

        Ok(ProtocolPosition {
            protocol: Protocol::AaveV3,
            chain,
            wallet_address: user_address.to_string(),
            position_type: PositionType::Borrowing,
            tokens: vec![token],
            total_value_usd: balance_usd,
            metadata: serde_json::json!({
                "apy": apy,
                "healthFactor": hf_value,
                "asset_name": borrow.currency.name,
            }),
        })
    }

    pub async fn get_market_yield(&self, chain: Chain, _asset_address: &str) -> Result<YieldInfo> {
        if !self.chain_configs.contains_key(&chain) {
            return Err(DeFi10Error::ChainNotSupported(chain));
        }

        Ok(YieldInfo {
            apy: 0.0,
            apr: 0.0,
            breakdown: vec![YieldComponent {
                name: "Supply APY".to_string(),
                apy: 0.0,
                token_symbol: None,
            }],
        })
    }

    pub async fn get_transaction_history(
        &self,
        chain: Chain,
        user_address: &str,
    ) -> Result<(
        Vec<TransactionHistoryItem>,
        Vec<TransactionHistoryItem>,
        Vec<TransactionHistoryItem>,
        Vec<TransactionTokenInfo>,
    )> {
        let subgraph_id = match chain {
            Chain::Base => self.graph_config.base_subgraph_id.as_ref(),
            Chain::Ethereum => self.graph_config.ethereum_subgraph_id.as_ref(),
            Chain::Arbitrum => self.graph_config.arbitrum_subgraph_id.as_ref(),
            _ => None,
        };

        let subgraph_id = match subgraph_id {
            Some(id) if !id.is_empty() => id,
            _ => {
                tracing::debug!("No subgraph configured for chain {:?}", chain);
                return Ok((vec![], vec![], vec![], vec![]));
            }
        };

        let api_key = match self.graph_config.api_key.as_ref() {
            Some(key) if !key.is_empty() => key,
            _ => {
                tracing::debug!("No Graph API key configured");
                return Ok((vec![], vec![], vec![], vec![]));
            }
        };

        let url_template = self
            .graph_config
            .url_template
            .as_deref()
            .unwrap_or("https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{ID}");

        let graph_url = url_template
            .replace("{API_KEY}", api_key)
            .replace("{ID}", subgraph_id);

        let user_lower = user_address.to_lowercase();

        let query = r#"
            query GetUserTransactions($user: Bytes!) {
              supplies(
                where: { user: $user }
                orderBy: timestamp
                orderDirection: desc
                first: 100
              ) {
                id
                timestamp
                amount
                reserve {
                  symbol
                  name
                  underlyingAsset
                  decimals
                }
              }
              borrows(
                where: { user: $user }
                orderBy: timestamp
                orderDirection: desc
                first: 100
              ) {
                id
                timestamp
                amount
                reserve {
                  symbol
                  name
                  underlyingAsset
                  decimals
                }
              }
              repays(
                where: { user: $user }
                orderBy: timestamp
                orderDirection: desc
                first: 100
              ) {
                id
                timestamp
                amount
                reserve {
                  symbol
                  name
                  underlyingAsset
                  decimals
                }
              }
            }
        "#;

        let body = serde_json::json!({
            "query": query,
            "variables": { "user": user_lower }
        });

        let response = self
            .client
            .post(&graph_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(format!("Graph API error: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            tracing::warn!("The Graph API error {}: {}", status, text);
            return Ok((vec![], vec![], vec![], vec![]));
        }

        let text = response
            .text()
            .await
            .map_err(|e| DeFi10Error::ParseError(e.to_string()))?;

        let result: AaveTransactionHistoryResponse = serde_json::from_str(&text).map_err(|e| {
            let preview = if text.len() > 500 {
                &text[..500]
            } else {
                &text
            };
            DeFi10Error::ParseError(format!("{} - body: {}", e, preview))
        })?;

        let data = match result.data {
            Some(d) => d,
            None => return Ok((vec![], vec![], vec![], vec![])),
        };

        let mut token_map: std::collections::HashMap<String, TransactionTokenInfo> =
            std::collections::HashMap::new();

        let convert_events = |events: Vec<AaveTransactionEvent>| -> Vec<TransactionHistoryItem> {
            events
                .into_iter()
                .map(|e| {
                    let timestamp = chrono::DateTime::from_timestamp(
                        e.timestamp.parse::<i64>().unwrap_or(0),
                        0,
                    )
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default();

                    TransactionHistoryItem {
                        token_address: e.reserve.underlying_asset.clone(),
                        mint_address: None,
                        symbol: e.reserve.symbol.clone(),
                        balance: e.amount,
                        timestamp,
                    }
                })
                .collect()
        };

        let supplies = convert_events(data.supplies.clone());
        let borrows = convert_events(data.borrows.clone());
        let repays = convert_events(data.repays.clone());

        for event in data
            .supplies
            .iter()
            .chain(data.borrows.iter())
            .chain(data.repays.iter())
        {
            let addr = event.reserve.underlying_asset.to_lowercase();
            if !token_map.contains_key(&addr) {
                token_map.insert(
                    addr.clone(),
                    TransactionTokenInfo {
                        token_address: event.reserve.underlying_asset.clone(),
                        mint_address: None,
                        symbol: event.reserve.symbol.to_uppercase(),
                        name: event.reserve.name.to_uppercase(),
                        logo_url: None,
                        decimals: event.reserve.decimals,
                    },
                );
            }
        }

        let tokens: Vec<TransactionTokenInfo> = token_map.into_values().collect();

        tracing::info!(
            "AAVE: Transaction history for {} - supplies: {}, borrows: {}, repays: {}",
            user_address,
            supplies.len(),
            borrows.len(),
            repays.len()
        );

        Ok((supplies, borrows, repays, tokens))
    }
}

impl Default for AaveV3Service {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_creation() {
        let service = AaveV3Service::new();
        assert!(service.is_chain_supported(Chain::Ethereum));
        assert!(service.is_chain_supported(Chain::Base));
        assert!(service.is_chain_supported(Chain::Arbitrum));
    }

    #[test]
    fn test_unsupported_chain() {
        let service = AaveV3Service::new();
        assert!(!service.is_chain_supported(Chain::BNB));
        assert!(!service.is_chain_supported(Chain::Solana));
    }

    #[test]
    fn test_chain_configs() {
        let configs = get_chain_configs();

        assert!(configs.contains_key(&Chain::Base));
        assert_eq!(configs.get(&Chain::Base).unwrap().chain_id, 8453);

        assert!(configs.contains_key(&Chain::Ethereum));
        assert_eq!(configs.get(&Chain::Ethereum).unwrap().chain_id, 1);

        assert!(configs.contains_key(&Chain::Arbitrum));
        assert_eq!(configs.get(&Chain::Arbitrum).unwrap().chain_id, 42161);
    }

    #[test]
    fn test_service_default() {
        let service1 = AaveV3Service::new();
        let service2 = AaveV3Service::default();

        assert_eq!(service1.chain_configs.len(), service2.chain_configs.len());
    }
}
