use super::attach_transaction_history;
use super::service::KaminoService;
use crate::types::{positions_to_results, FetchContext, ProtocolAdapter};
use async_trait::async_trait;
use defi10_blockchain::solana::SolanaProvider;
use defi10_core::aggregation::AggregationResult;
use defi10_core::Chain;
use reqwest::Client;
use std::sync::Arc;

pub struct KaminoAdapter {
    client: Arc<Client>,
}

impl KaminoAdapter {
    pub fn new(client: Arc<Client>) -> Self {
        Self { client }
    }
}

#[async_trait]
impl ProtocolAdapter for KaminoAdapter {
    fn name(&self) -> &str {
        "kamino"
    }

    fn supported_chains(&self) -> Vec<Chain> {
        vec![Chain::Solana]
    }

    async fn fetch_positions(
        &self,
        account: &str,
        _chain: Chain,
        ctx: &FetchContext,
    ) -> anyhow::Result<Vec<AggregationResult>> {
        let kamino_service = KaminoService::with_client(self.client.clone());
        let provider = SolanaProvider::new(&ctx.rpc_url)
            .map_err(|e| anyhow::anyhow!("Solana provider creation failed: {}", e))?;

        let (positions, market_data) = kamino_service
            .get_user_positions(account, Arc::new(provider))
            .await?;
        tracing::info!(
            "Kamino: Found {} positions for {}",
            positions.len(),
            account
        );

        let mut results = positions_to_results(account, positions);

        for r in &mut results {
            r.token_name = r.token_symbol.clone();
            if r.is_collateral.is_none() {
                r.is_collateral = Some(true);
            }
            if r.can_be_collateral.is_none() {
                r.can_be_collateral = Some(true);
            }
        }

        if !results.is_empty() {
            let events = kamino_service
                .get_transaction_history(account, &market_data)
                .await
                .unwrap_or_else(|e| {
                    tracing::warn!("Failed to fetch Kamino transaction history: {}", e);
                    vec![]
                });

            tracing::info!(
                "Kamino: {} transaction events for {}",
                events.len(),
                account
            );
            attach_transaction_history(&mut results, &events);
        }

        Ok(results)
    }
}
