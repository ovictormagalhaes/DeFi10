use super::service::{AaveGraphConfig, AaveV3Service};
use crate::types::{positions_to_results, FetchContext, ProtocolAdapter};
use async_trait::async_trait;
use defi10_core::aggregation::AggregationResult;
use defi10_core::Chain;
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;

pub struct AaveAdapter {
    service: AaveV3Service,
}

impl AaveAdapter {
    pub fn new(client: Arc<Client>, config: AaveGraphConfig) -> Self {
        Self {
            service: AaveV3Service::with_client(client, config),
        }
    }
}

#[async_trait]
impl ProtocolAdapter for AaveAdapter {
    fn name(&self) -> &str {
        "aave-v3"
    }

    fn supported_chains(&self) -> Vec<Chain> {
        vec![Chain::Ethereum, Chain::Base, Chain::Arbitrum]
    }

    async fn fetch_positions(
        &self,
        account: &str,
        chain: Chain,
        _ctx: &FetchContext,
    ) -> anyhow::Result<Vec<AggregationResult>> {
        if !self.service.is_chain_supported(chain) {
            return Ok(vec![]);
        }

        let positions = self.service.get_user_positions(chain, account).await?;

        let (supplies_history, borrows_history, repays_history, tokens_info) = self
            .service
            .get_transaction_history(chain, account)
            .await
            .unwrap_or_else(|e| {
                tracing::warn!("Failed to fetch Aave transaction history: {}", e);
                (vec![], vec![], vec![], vec![])
            });

        let mut results = positions_to_results(account, positions);

        for r in &mut results {
            r.token_name = r.token_symbol.clone();
        }

        if !supplies_history.is_empty() || !borrows_history.is_empty() || !repays_history.is_empty()
        {
            let mut history_by_token: HashMap<String, (Vec<_>, Vec<_>, Vec<_>)> = HashMap::new();

            for supply in &supplies_history {
                history_by_token
                    .entry(supply.token_address.to_lowercase())
                    .or_default()
                    .0
                    .push(supply.clone());
            }
            for borrow in &borrows_history {
                history_by_token
                    .entry(borrow.token_address.to_lowercase())
                    .or_default()
                    .1
                    .push(borrow.clone());
            }
            for repay in &repays_history {
                history_by_token
                    .entry(repay.token_address.to_lowercase())
                    .or_default()
                    .2
                    .push(repay.clone());
            }

            for (token_addr, (supplies, borrows, repays)) in history_by_token {
                let token_info = tokens_info
                    .iter()
                    .find(|t| t.token_address.to_lowercase() == token_addr)
                    .cloned();

                if let Some(result) = results
                    .iter_mut()
                    .find(|r| r.token_address.to_lowercase() == token_addr)
                {
                    let metadata = result.metadata.get_or_insert_with(|| serde_json::json!({}));

                    if !supplies.is_empty() {
                        metadata["supplies"] = serde_json::to_value(&supplies).unwrap_or_default();
                        if let Some(ref ti) = token_info {
                            metadata["suppliesTokens"] = serde_json::json!([{
                                "tokenAddress": ti.token_address,
                                "mintAddress": ti.mint_address,
                                "symbol": ti.symbol,
                                "name": ti.name,
                                "logoUrl": ti.logo_url,
                                "decimals": ti.decimals
                            }]);
                        }
                    }
                    if !borrows.is_empty() {
                        metadata["borrows"] = serde_json::to_value(&borrows).unwrap_or_default();
                        if let Some(ref ti) = token_info {
                            metadata["borrowsTokens"] = serde_json::json!([{
                                "tokenAddress": ti.token_address,
                                "mintAddress": ti.mint_address,
                                "symbol": ti.symbol,
                                "name": ti.name,
                                "logoUrl": ti.logo_url,
                                "decimals": ti.decimals
                            }]);
                        }
                    }
                    if !repays.is_empty() {
                        metadata["repays"] = serde_json::to_value(&repays).unwrap_or_default();
                        if let Some(ref ti) = token_info {
                            metadata["repaysTokens"] = serde_json::json!([{
                                "tokenAddress": ti.token_address,
                                "mintAddress": ti.mint_address,
                                "symbol": ti.symbol,
                                "name": ti.name,
                                "logoUrl": ti.logo_url,
                                "decimals": ti.decimals
                            }]);
                        }
                    }
                }
            }
        }

        tracing::info!("Found {} Aave positions for {}", results.len(), account);
        Ok(results)
    }
}
