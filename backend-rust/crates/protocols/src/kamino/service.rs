use super::models::*;
use crate::types::{PositionToken, PositionType, ProtocolPosition};
use defi10_blockchain::BlockchainProvider;
use defi10_core::{
    http_helpers::check_and_parse, token_decimals, Chain, DeFi10Error, Protocol, Result,
};
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;

use tokio::time::{sleep, Duration};

const KAMINO_API_BASE: &str = "https://api.kamino.finance";
const MARKET_DELAY_MS: u64 = 500;

fn get_decimals_for_symbol(symbol: &str) -> u8 {
    token_decimals::get_token_decimals(symbol, Chain::Solana, None)
}

pub fn get_decimals_for_symbol_pub(symbol: &str) -> u8 {
    get_decimals_for_symbol(symbol)
}

fn convert_raw_to_human(raw_str: &str, decimals: u8) -> f64 {
    token_decimals::convert_raw_to_human(raw_str, decimals)
}

fn get_unit_price(reserve: Option<&KaminoReserveMetric>) -> f64 {
    reserve
        .and_then(|r| {
            let supply = r.total_supply.as_ref()?.parse::<f64>().ok()?;
            let supply_usd = r.total_supply_usd.as_ref()?.parse::<f64>().ok()?;
            if supply > 0.0 {
                Some(supply_usd / supply)
            } else {
                None
            }
        })
        .unwrap_or(0.0)
}

const KNOWN_MARKETS: &[(&str, &str)] = &[
    (
        "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
        "Main Market",
    ),
    ("ByVuX9fRdEHsZomwLVryQQHRhQi3yMXZ6uz6DA4gutja", "JLP Market"),
    (
        "DxXdAyU3kCjnyggvHmY5nAwg5cRbbmdyX3npfDMjjMek",
        "Altcoins Market",
    ),
];

pub struct KaminoService {
    client: Arc<Client>,
    api_base_url: String,
}

impl KaminoService {
    pub fn new() -> Self {
        Self::with_api_url(KAMINO_API_BASE.to_string())
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
            api_base_url: KAMINO_API_BASE.to_string(),
        }
    }

    pub async fn get_user_positions(
        &self,
        wallet_address: &str,
        _provider: Arc<dyn BlockchainProvider>,
    ) -> Result<Vec<ProtocolPosition>> {
        let mut all_data: Vec<(
            String,
            String,
            KaminoObligationResponse,
            HashMap<String, KaminoReserveMetric>,
        )> = Vec::new();

        for (market_pubkey, market_name) in KNOWN_MARKETS {
            let obligations = self.fetch_obligations(market_pubkey, wallet_address).await;
            let obligations = match obligations {
                Ok(obs) if !obs.is_empty() => obs,
                Ok(_) => {
                    sleep(Duration::from_millis(MARKET_DELAY_MS)).await;
                    continue;
                }
                Err(e) => {
                    tracing::warn!("Kamino obligations error for {}: {}", market_name, e);
                    sleep(Duration::from_millis(MARKET_DELAY_MS)).await;
                    continue;
                }
            };

            let reserves_map = self.fetch_reserves_map(market_pubkey).await;
            tracing::info!(
                "Kamino {}: {} obligations, {} reserves",
                market_name,
                obligations.len(),
                reserves_map.len()
            );

            for obligation in obligations {
                all_data.push((
                    market_pubkey.to_string(),
                    market_name.to_string(),
                    obligation,
                    reserves_map.clone(),
                ));
            }

            sleep(Duration::from_millis(MARKET_DELAY_MS)).await;
        }

        if all_data.is_empty() {
            return Ok(vec![]);
        }

        let mut positions = Vec::new();

        for (_market_pubkey, market_name, obligation, reserves_map) in &all_data {
            let total_deposit_usd = obligation
                .refreshed_stats
                .as_ref()
                .and_then(|s| s.user_total_deposit.as_ref())
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(0.0);

            let total_borrow_usd = obligation
                .refreshed_stats
                .as_ref()
                .and_then(|s| s.user_total_borrow.as_ref())
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(0.0);

            let net_value = obligation
                .refreshed_stats
                .as_ref()
                .and_then(|s| s.net_account_value.as_ref())
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(0.0);

            let ltv = obligation
                .refreshed_stats
                .as_ref()
                .and_then(|s| s.loan_to_value.as_ref())
                .and_then(|v| v.parse::<f64>().ok());

            const ASSUMED_LT: f64 = 0.8;
            let health_factor = if total_borrow_usd > 0.0 {
                Some((total_deposit_usd * ASSUMED_LT) / total_borrow_usd)
            } else {
                None
            };

            let total_market_value_sf: f64 = obligation
                .state
                .deposits
                .iter()
                .filter_map(|d| d.market_value_sf.parse::<f64>().ok())
                .sum();

            for deposit in &obligation.state.deposits {
                let deposit_value_usd = self.calculate_proportional_value(
                    &deposit.market_value_sf,
                    total_market_value_sf,
                    total_deposit_usd,
                );

                if deposit_value_usd < 0.01 {
                    continue;
                }

                let reserve = reserves_map.get(&deposit.deposit_reserve);
                let symbol = reserve
                    .map(|r| r.liquidity_token.clone())
                    .unwrap_or_else(|| "Unknown".to_string());
                let mint = reserve
                    .map(|r| r.liquidity_token_mint.clone())
                    .unwrap_or_else(|| deposit.deposit_reserve.clone());
                let supply_apy = reserve
                    .and_then(|r| r.supply_apy.as_ref())
                    .and_then(|v| v.parse::<f64>().ok())
                    .unwrap_or(0.0);

                let decimals = get_decimals_for_symbol(&symbol);
                let human_amount = convert_raw_to_human(&deposit.deposited_amount, decimals);
                let unit_price = get_unit_price(reserve);
                let price_usd = if unit_price > 0.0 {
                    unit_price
                } else if human_amount > 0.0 {
                    deposit_value_usd / human_amount
                } else {
                    0.0
                };

                let token = PositionToken {
                    token_address: mint,
                    symbol: symbol.clone(),
                    name: symbol,
                    decimals,
                    balance: format!("{}", human_amount),
                    balance_usd: deposit_value_usd,
                    price_usd,
                    token_type: Some("Supplied".to_string()),
                };

                positions.push(ProtocolPosition {
                    protocol: Protocol::Kamino,
                    chain: Chain::Solana,
                    wallet_address: wallet_address.to_string(),
                    position_type: PositionType::Lending,
                    tokens: vec![token],
                    total_value_usd: deposit_value_usd,
                    metadata: serde_json::json!({
                        "market": market_name,
                        "apy": supply_apy * 100.0,
                        "healthFactor": health_factor,
                        "netAccountValue": net_value,
                        "loanToValue": ltv,
                    }),
                });
            }

            let total_borrow_market_sf: f64 = obligation
                .state
                .borrows
                .iter()
                .filter_map(|b| {
                    b.market_value_sf
                        .as_ref()
                        .and_then(|s| s.parse::<f64>().ok())
                })
                .sum();

            for borrow in &obligation.state.borrows {
                let borrow_value_usd = if total_borrow_market_sf > 0.0 {
                    let sf = borrow
                        .market_value_sf
                        .as_ref()
                        .and_then(|s| s.parse::<f64>().ok())
                        .unwrap_or(0.0);
                    if sf > 0.0 {
                        (sf / total_borrow_market_sf) * total_borrow_usd
                    } else {
                        total_borrow_usd / obligation.state.borrows.len() as f64
                    }
                } else if !obligation.state.borrows.is_empty() {
                    total_borrow_usd / obligation.state.borrows.len() as f64
                } else {
                    0.0
                };

                if borrow_value_usd < 0.01 {
                    continue;
                }

                let reserve = reserves_map.get(&borrow.borrow_reserve);
                let symbol = reserve
                    .map(|r| r.liquidity_token.clone())
                    .unwrap_or_else(|| "Unknown".to_string());
                let mint = reserve
                    .map(|r| r.liquidity_token_mint.clone())
                    .unwrap_or_else(|| borrow.borrow_reserve.clone());
                let borrow_apy = reserve
                    .and_then(|r| r.borrow_apy.as_ref())
                    .and_then(|v| v.parse::<f64>().ok())
                    .unwrap_or(0.0);

                let decimals = get_decimals_for_symbol(&symbol);
                let unit_price = get_unit_price(reserve);

                let raw_amount_str = borrow
                    .borrowed_amount_outside_elevation_groups
                    .as_deref()
                    .filter(|s| !s.is_empty() && *s != "0")
                    .unwrap_or("0");

                let human_amount = if raw_amount_str != "0" {
                    convert_raw_to_human(raw_amount_str, decimals)
                } else if unit_price > 0.0 {
                    borrow_value_usd / unit_price
                } else {
                    0.0
                };

                let price_usd = if unit_price > 0.0 {
                    unit_price
                } else if human_amount > 0.0 {
                    borrow_value_usd / human_amount
                } else {
                    0.0
                };

                let token = PositionToken {
                    token_address: mint,
                    symbol: symbol.clone(),
                    name: symbol,
                    decimals,
                    balance: format!("{}", human_amount),
                    balance_usd: borrow_value_usd,
                    price_usd,
                    token_type: Some("Borrowed".to_string()),
                };

                positions.push(ProtocolPosition {
                    protocol: Protocol::Kamino,
                    chain: Chain::Solana,
                    wallet_address: wallet_address.to_string(),
                    position_type: PositionType::Borrowing,
                    tokens: vec![token],
                    total_value_usd: borrow_value_usd,
                    metadata: serde_json::json!({
                        "market": market_name,
                        "apy": borrow_apy * 100.0,
                        "healthFactor": health_factor,
                        "netAccountValue": net_value,
                        "loanToValue": ltv,
                    }),
                });
            }
        }

        tracing::info!(
            "Kamino: found {} positions for wallet {}",
            positions.len(),
            wallet_address
        );

        Ok(positions)
    }

    async fn fetch_obligations(
        &self,
        market_pubkey: &str,
        wallet_address: &str,
    ) -> Result<Vec<KaminoObligationResponse>> {
        let url = format!(
            "{}/kamino-market/{}/users/{}/obligations",
            self.api_base_url, market_pubkey, wallet_address
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(e.to_string()))?;

        if response.status() == reqwest::StatusCode::NOT_FOUND
            || response.status() == reqwest::StatusCode::BAD_REQUEST
        {
            return Ok(vec![]);
        }

        let obligations: Vec<KaminoObligationResponse> =
            check_and_parse(response, "Kamino API").await?;

        Ok(obligations)
    }

    async fn fetch_reserves_map(
        &self,
        market_pubkey: &str,
    ) -> HashMap<String, KaminoReserveMetric> {
        let url = format!(
            "{}/kamino-market/{}/reserves/metrics?env=mainnet-beta",
            self.api_base_url, market_pubkey
        );

        let response = match self.client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("Failed to fetch Kamino reserves: {}", e);
                return HashMap::new();
            }
        };

        if !response.status().is_success() {
            return HashMap::new();
        }

        let reserves: Vec<KaminoReserveMetric> = match response.json().await {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("Failed to parse Kamino reserves: {}", e);
                return HashMap::new();
            }
        };

        reserves
            .into_iter()
            .map(|r| (r.reserve.clone(), r))
            .collect()
    }

    fn calculate_proportional_value(
        &self,
        market_value_sf: &str,
        total_market_value_sf: f64,
        total_usd: f64,
    ) -> f64 {
        if total_market_value_sf <= 0.0 || total_usd <= 0.0 {
            return 0.0;
        }

        let sf = market_value_sf.parse::<f64>().unwrap_or(0.0);
        if sf <= 0.0 {
            return 0.0;
        }

        (sf / total_market_value_sf) * total_usd
    }

    pub async fn get_transaction_history(
        &self,
        wallet_address: &str,
    ) -> Result<Vec<KaminoTransactionEvent>> {
        tracing::info!(
            "Kamino: Starting transaction history fetch for {}",
            wallet_address
        );
        let mut all_events = Vec::new();

        for (market_pubkey, market_name) in KNOWN_MARKETS {
            let obligations = self.fetch_obligations(market_pubkey, wallet_address).await;
            let obligations = match obligations {
                Ok(obs) if !obs.is_empty() => {
                    tracing::info!("Kamino {}: Found {} obligations", market_name, obs.len());
                    obs
                }
                Ok(_) => {
                    tracing::debug!("Kamino {}: No obligations found", market_name);
                    sleep(Duration::from_millis(MARKET_DELAY_MS)).await;
                    continue;
                }
                Err(e) => {
                    tracing::warn!("Kamino {}: Failed to fetch obligations: {}", market_name, e);
                    sleep(Duration::from_millis(MARKET_DELAY_MS)).await;
                    continue;
                }
            };

            let reserves_map = self.fetch_reserves_map(market_pubkey).await;

            for obligation in &obligations {
                let history = self
                    .fetch_obligation_history(market_pubkey, &obligation.obligation_address)
                    .await;
                let snapshots = match history {
                    Ok(h) if h.history.len() >= 2 => {
                        tracing::info!(
                            "Kamino {}: {} snapshots for obligation {}",
                            market_name,
                            h.history.len(),
                            &obligation.obligation_address
                                [..8.min(obligation.obligation_address.len())]
                        );
                        h.history
                    }
                    Ok(h) => {
                        tracing::info!(
                            "Kamino {}: Only {} snapshots (need >=2) for obligation {}",
                            market_name,
                            h.history.len(),
                            &obligation.obligation_address
                                [..8.min(obligation.obligation_address.len())]
                        );
                        sleep(Duration::from_millis(MARKET_DELAY_MS)).await;
                        continue;
                    }
                    Err(e) => {
                        tracing::warn!(
                            "Kamino {}: Failed to fetch obligation history: {}",
                            market_name,
                            e
                        );
                        sleep(Duration::from_millis(MARKET_DELAY_MS)).await;
                        continue;
                    }
                };

                let events = self.infer_transaction_events(&snapshots, &reserves_map);
                tracing::info!(
                    "Kamino {}: {} events inferred for obligation {}",
                    market_name,
                    events.len(),
                    &obligation.obligation_address[..8.min(obligation.obligation_address.len())]
                );
                all_events.extend(events);

                sleep(Duration::from_millis(MARKET_DELAY_MS)).await;
            }

            sleep(Duration::from_millis(MARKET_DELAY_MS)).await;
        }

        tracing::info!(
            "Kamino: Total {} transaction events for {}",
            all_events.len(),
            wallet_address
        );
        all_events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(all_events)
    }

    async fn fetch_obligation_history(
        &self,
        market_pubkey: &str,
        obligation_address: &str,
    ) -> Result<KaminoObligationHistoryResponse> {
        let url = format!(
            "{}/v2/kamino-market/{}/obligations/{}/metrics/history",
            self.api_base_url, market_pubkey, obligation_address
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(e.to_string()))?;

        check_and_parse(response, "Kamino history API").await
    }

    fn infer_transaction_events(
        &self,
        snapshots: &[KaminoHistorySnapshot],
        reserves_map: &HashMap<String, KaminoReserveMetric>,
    ) -> Vec<KaminoTransactionEvent> {
        let mut sorted = snapshots.to_vec();
        sorted.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

        let mut events = Vec::new();
        let mint_to_symbol: HashMap<String, String> = reserves_map
            .values()
            .map(|r| (r.liquidity_token_mint.clone(), r.liquidity_token.clone()))
            .collect();

        for window in sorted.windows(2) {
            let prev = &window[0];
            let curr = &window[1];

            for curr_dep in &curr.deposits {
                let prev_amount = prev
                    .deposits
                    .iter()
                    .find(|d| d.mint_address == curr_dep.mint_address)
                    .map(|d| d.amount.parse::<f64>().unwrap_or(0.0))
                    .unwrap_or(0.0);

                let curr_amount = curr_dep.amount.parse::<f64>().unwrap_or(0.0);
                if curr_amount > prev_amount && (curr_amount - prev_amount) > 0.000001 {
                    let symbol = mint_to_symbol
                        .get(&curr_dep.mint_address)
                        .cloned()
                        .unwrap_or_else(|| "Unknown".to_string());
                    events.push(KaminoTransactionEvent {
                        event_type: "deposit".to_string(),
                        mint_address: curr_dep.mint_address.clone(),
                        token_symbol: symbol,
                        amount: curr_amount,
                        amount_change: curr_amount - prev_amount,
                        timestamp: curr.timestamp.clone(),
                    });
                }
            }

            for curr_bor in &curr.borrows {
                let prev_amount = prev
                    .borrows
                    .iter()
                    .find(|b| b.mint_address == curr_bor.mint_address)
                    .map(|b| b.amount.parse::<f64>().unwrap_or(0.0))
                    .unwrap_or(0.0);

                let curr_amount = curr_bor.amount.parse::<f64>().unwrap_or(0.0);
                if curr_amount > prev_amount && (curr_amount - prev_amount) > 0.000001 {
                    let symbol = mint_to_symbol
                        .get(&curr_bor.mint_address)
                        .cloned()
                        .unwrap_or_else(|| "Unknown".to_string());
                    events.push(KaminoTransactionEvent {
                        event_type: "borrow".to_string(),
                        mint_address: curr_bor.mint_address.clone(),
                        token_symbol: symbol,
                        amount: curr_amount,
                        amount_change: curr_amount - prev_amount,
                        timestamp: curr.timestamp.clone(),
                    });
                }
            }
        }

        events
    }
}

impl Default for KaminoService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_creation() {
        let service = KaminoService::new();
        assert_eq!(service.api_base_url, KAMINO_API_BASE);
    }

    #[test]
    fn test_custom_api_url() {
        let service = KaminoService::with_api_url("https://custom.api".to_string());
        assert_eq!(service.api_base_url, "https://custom.api");
    }

    #[test]
    fn test_proportional_value() {
        let service = KaminoService::new();

        let value = service.calculate_proportional_value("5000", 10000.0, 200.0);
        assert_eq!(value, 100.0);

        let value = service.calculate_proportional_value("0", 10000.0, 200.0);
        assert_eq!(value, 0.0);

        let value = service.calculate_proportional_value("5000", 0.0, 200.0);
        assert_eq!(value, 0.0);
    }

    #[test]
    fn test_known_markets_count() {
        assert_eq!(KNOWN_MARKETS.len(), 3);
    }

    #[test]
    fn test_service_default() {
        let service1 = KaminoService::new();
        let service2 = KaminoService::default();
        assert_eq!(service1.api_base_url, service2.api_base_url);
    }
}
