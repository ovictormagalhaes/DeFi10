use super::service::PendleService;
use crate::types::{positions_to_results, FetchContext, ProtocolAdapter};
use async_trait::async_trait;
use defi10_core::aggregation::AggregationResult;
use defi10_core::Chain;
use reqwest::Client;
use std::sync::Arc;

pub struct PendleAdapter {
    service: PendleService,
}

impl PendleAdapter {
    pub fn new(client: Arc<Client>) -> Self {
        Self {
            service: PendleService::with_client(client),
        }
    }
}

#[async_trait]
impl ProtocolAdapter for PendleAdapter {
    fn name(&self) -> &str {
        "pendle"
    }

    fn supported_chains(&self) -> Vec<Chain> {
        vec![Chain::Ethereum, Chain::Arbitrum, Chain::Base]
    }

    async fn fetch_positions(
        &self,
        account: &str,
        chain: Chain,
        ctx: &FetchContext,
    ) -> anyhow::Result<Vec<AggregationResult>> {
        let mut results = Vec::new();

        let positions = self.service.get_user_positions(chain, account).await?;
        let mut regular_results = positions_to_results(account, positions);

        for r in &mut regular_results {
            r.token_name = r.token_symbol.clone();
            r.metadata = None;
            r.token_type = None;
        }

        results.extend(regular_results);

        if chain == Chain::Ethereum {
            match self.service.get_ve_positions(&ctx.rpc_url, account).await {
                Ok(ve_positions) => {
                    for pos in ve_positions {
                        let unlock_at = pos.metadata.get("unlockAt").and_then(|v| v.as_i64());

                        for token in &pos.tokens {
                            let balance_f64 = token.balance.parse::<f64>().unwrap_or(0.0);
                            if balance_f64 <= 0.0 {
                                continue;
                            }
                            let raw_balance =
                                (balance_f64 * 10f64.powi(token.decimals as i32)) as u128;
                            let mut metadata = serde_json::json!({});
                            if let Some(unlock) = unlock_at {
                                metadata["unlockAt"] = serde_json::json!(unlock);
                            }
                            results.push(AggregationResult {
                                account: account.to_string(),
                                chain: format!("{:?}", chain).to_lowercase(),
                                protocol: "pendle".to_string(),
                                position_type: "locking".to_string(),
                                balance: balance_f64,
                                balance_raw: raw_balance.to_string(),
                                decimals: token.decimals,
                                value_usd: token.balance_usd,
                                price_usd: token.price_usd,
                                token_symbol: token.symbol.clone(),
                                token_name: token.name.clone(),
                                token_address: token.token_address.clone(),
                                timestamp: chrono::Utc::now(),
                                apy: None,
                                apr: None,
                                apr_historical: None,
                                health_factor: None,
                                is_collateral: None,
                                can_be_collateral: None,
                                logo: None,
                                token_type: token.token_type.clone(),
                                metadata: Some(metadata),
                            });
                        }
                    }
                }
                Err(e) => tracing::warn!("Failed to fetch Pendle vePENDLE positions: {}", e),
            }
        }

        tracing::info!("Found {} Pendle positions for {}", results.len(), account);
        Ok(results)
    }
}
