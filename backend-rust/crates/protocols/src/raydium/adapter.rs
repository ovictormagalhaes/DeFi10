use super::service::RaydiumService;
use crate::types::{positions_to_results, FetchContext, ProtocolAdapter};
use async_trait::async_trait;
use defi10_blockchain::solana::SolanaProvider;
use defi10_core::aggregation::AggregationResult;
use defi10_core::Chain;
use reqwest::Client;
use std::sync::Arc;

pub struct RaydiumAdapter {
    client: Arc<Client>,
}

impl RaydiumAdapter {
    pub fn new(client: Arc<Client>) -> Self {
        Self { client }
    }
}

#[async_trait]
impl ProtocolAdapter for RaydiumAdapter {
    fn name(&self) -> &str {
        "raydium"
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
        let raydium_service = RaydiumService::with_client(self.client.clone(), ctx.rpc_url.clone());
        let provider = SolanaProvider::new(&ctx.rpc_url)
            .map_err(|e| anyhow::anyhow!("Solana provider creation failed: {}", e))?;

        let positions = raydium_service
            .get_user_positions(account, Arc::new(provider))
            .await?;
        let results = positions_to_results(account, positions);

        tracing::info!("Found {} Raydium positions for {}", results.len(), account);
        Ok(results)
    }
}
