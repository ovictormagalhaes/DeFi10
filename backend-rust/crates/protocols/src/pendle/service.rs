use super::models::*;
use crate::types::{PositionToken, PositionType, ProtocolPosition};
use defi10_core::{http_helpers::check_and_parse, Chain, DeFi10Error, Protocol, Result};
use reqwest::Client;
use std::sync::Arc;

const PENDLE_API_BASE: &str = "https://api-v2.pendle.finance/core";
const VE_PENDLE_CONTRACT: &str = "0x4f30A9D41B80ecC5B94306AB4364951AE3170210";
const PENDLE_TOKEN_CONTRACT: &str = "0x808507121b80c02388fad14726482e061b8da827";
const PENDLE_DECIMALS: u8 = 18;

pub struct PendleService {
    client: Arc<Client>,
    api_base_url: String,
}

impl PendleService {
    pub fn new() -> Self {
        Self {
            client: Arc::new(Client::new()),
            api_base_url: PENDLE_API_BASE.to_string(),
        }
    }

    pub fn with_api_url(api_base_url: String) -> Self {
        Self {
            client: Arc::new(Client::new()),
            api_base_url,
        }
    }

    pub fn with_client(client: Arc<Client>) -> Self {
        Self {
            client,
            api_base_url: PENDLE_API_BASE.to_string(),
        }
    }

    /// Get all markets for a specific chain
    pub async fn get_markets(&self, chain: Chain) -> Result<Vec<PendleMarket>> {
        let url = format!(
            "{}/v1/{}/markets",
            self.api_base_url,
            Self::chain_id(chain)?
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(e.to_string()))?;

        let markets: Vec<PendleMarket> = check_and_parse(response, "Pendle API").await?;

        Ok(markets)
    }

    pub async fn get_user_positions(
        &self,
        chain: Chain,
        wallet_address: &str,
    ) -> Result<Vec<ProtocolPosition>> {
        let url = format!(
            "{}/v1/{}/users/{}/positions",
            self.api_base_url,
            Self::chain_id(chain)?,
            wallet_address
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(e.to_string()))?;

        if response.status() == 404 {
            return Ok(vec![]);
        }

        let positions: Vec<PendlePosition> = check_and_parse(response, "Pendle API").await?;

        Ok(positions
            .into_iter()
            .map(|pos| ProtocolPosition {
                protocol: Protocol::Pendle,
                chain,
                wallet_address: wallet_address.to_string(),
                position_type: PositionType::Yield,
                tokens: vec![PositionToken {
                    token_address: pos.market.clone(),
                    symbol: "PT".to_string(),
                    name: "Pendle Token".to_string(),
                    decimals: 18,
                    balance: pos.pt_balance,
                    balance_usd: pos.value_usd / 2.0,
                    price_usd: 1.0,
                    token_type: Some("Supplied".to_string()),
                }],
                total_value_usd: pos.value_usd,
                metadata: serde_json::json!({
                    "market": pos.market,
                }),
            })
            .collect())
    }

    pub async fn get_ve_positions(
        &self,
        rpc_url: &str,
        wallet_address: &str,
    ) -> Result<Vec<ProtocolPosition>> {
        if wallet_address.is_empty() {
            return Ok(vec![]);
        }

        let addr = wallet_address.trim().to_lowercase();
        let addr_padded = format!("000000000000000000000000{}", addr.trim_start_matches("0x"));

        let position_data = self
            .eth_call(
                rpc_url,
                VE_PENDLE_CONTRACT,
                &format!("0xcb6b4f3c{}", addr_padded), // positionData(address)
            )
            .await?;

        if position_data.len() < 130 {
            return Ok(vec![]);
        }

        let amount_hex = &position_data[2..66];
        let expiry_hex = &position_data[66..130];

        let amount_raw = u128::from_str_radix(amount_hex.trim_start_matches('0'), 16).unwrap_or(0);
        let expiry = u128::from_str_radix(expiry_hex.trim_start_matches('0'), 16).unwrap_or(0);

        if amount_raw == 0 || expiry == 0 {
            return Ok(vec![]);
        }

        let balance_of_data = self
            .eth_call(
                rpc_url,
                VE_PENDLE_CONTRACT,
                &format!("0x70a08231{}", addr_padded), // balanceOf(address)
            )
            .await?;

        let ve_balance_raw = if balance_of_data.len() >= 66 {
            u128::from_str_radix(balance_of_data[2..66].trim_start_matches('0'), 16).unwrap_or(0)
        } else {
            0u128
        };

        let amount_formatted = amount_raw as f64 / 10f64.powi(PENDLE_DECIMALS as i32);
        let ve_balance_formatted = ve_balance_raw as f64 / 10f64.powi(PENDLE_DECIMALS as i32);

        Ok(vec![ProtocolPosition {
            protocol: Protocol::Pendle,
            chain: Chain::Ethereum,
            wallet_address: wallet_address.to_string(),
            position_type: PositionType::Locking,
            tokens: vec![
                PositionToken {
                    token_address: PENDLE_TOKEN_CONTRACT.to_string(),
                    symbol: "PENDLE".to_string(),
                    name: "PENDLE".to_string(),
                    decimals: PENDLE_DECIMALS,
                    balance: amount_formatted.to_string(),
                    balance_usd: 0.0,
                    price_usd: 0.0,
                    token_type: Some("Supplied".to_string()),
                },
                PositionToken {
                    token_address: String::new(),
                    symbol: "vePENDLE".to_string(),
                    name: String::new(),
                    decimals: PENDLE_DECIMALS,
                    balance: ve_balance_formatted.to_string(),
                    balance_usd: 0.0,
                    price_usd: 0.0,
                    token_type: Some("GovernancePower".to_string()),
                },
            ],
            total_value_usd: 0.0,
            metadata: serde_json::json!({
                "unlockAt": expiry as i64,
            }),
        }])
    }

    async fn eth_call(&self, rpc_url: &str, to: &str, data: &str) -> Result<String> {
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "eth_call",
            "params": [{"to": to, "data": data}, "latest"],
            "id": 1
        });

        let response: serde_json::Value = self
            .client
            .post(rpc_url)
            .json(&body)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(e.to_string()))?
            .json()
            .await
            .map_err(|e| DeFi10Error::ParseError(e.to_string()))?;

        response
            .get("result")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| {
                DeFi10Error::ExternalApiError("No result in eth_call response".to_string())
            })
    }

    fn chain_id(chain: Chain) -> Result<u32> {
        match chain {
            Chain::Ethereum => Ok(1),
            Chain::Arbitrum => Ok(42161),
            Chain::Base => Ok(8453),
            _ => Err(DeFi10Error::ChainNotSupported(chain)),
        }
    }
}

impl Default for PendleService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chain_id() {
        assert_eq!(PendleService::chain_id(Chain::Ethereum).unwrap(), 1);
        assert_eq!(PendleService::chain_id(Chain::Arbitrum).unwrap(), 42161);
        assert!(PendleService::chain_id(Chain::Solana).is_err());
    }

    #[test]
    fn test_service_creation() {
        let service = PendleService::new();
        assert_eq!(service.api_base_url, PENDLE_API_BASE);
    }

    #[test]
    fn test_custom_api_url() {
        let service = PendleService::with_api_url("https://custom.api".to_string());
        assert_eq!(service.api_base_url, "https://custom.api");
    }

    #[test]
    fn test_service_default() {
        let service1 = PendleService::new();
        let service2 = PendleService::default();
        assert_eq!(service1.api_base_url, service2.api_base_url);
    }

    #[test]
    fn test_chain_id_all_supported() {
        assert!(PendleService::chain_id(Chain::Ethereum).is_ok());
        assert!(PendleService::chain_id(Chain::Arbitrum).is_ok());
        assert!(PendleService::chain_id(Chain::Base).is_ok());
    }

    #[test]
    fn test_chain_id_unsupported() {
        assert!(PendleService::chain_id(Chain::Solana).is_err());
        assert!(PendleService::chain_id(Chain::BNB).is_err());
    }

    #[tokio::test]
    async fn test_get_markets_network_error() {
        let service = PendleService::with_api_url("https://invalid.domain.xyz".to_string());
        let result = service.get_markets(Chain::Ethereum).await;
        assert!(result.is_err());
    }
}
