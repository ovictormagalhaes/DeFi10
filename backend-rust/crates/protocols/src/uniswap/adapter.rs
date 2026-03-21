use super::service::{UniswapGraphConfig, UniswapV3Service};
use crate::types::{FetchContext, ProtocolAdapter};
use async_trait::async_trait;
use defi10_blockchain::evm::EvmProvider;
use defi10_core::aggregation::AggregationResult;
use defi10_core::Chain;
use reqwest::Client;
use std::sync::Arc;

pub struct UniswapAdapter {
    service: UniswapV3Service,
}

impl UniswapAdapter {
    pub fn new(client: Arc<Client>, config: UniswapGraphConfig) -> Self {
        Self {
            service: UniswapV3Service::with_client(client, config),
        }
    }
}

#[async_trait]
impl ProtocolAdapter for UniswapAdapter {
    fn name(&self) -> &str {
        "uniswap-v3"
    }

    fn supported_chains(&self) -> Vec<Chain> {
        vec![Chain::Ethereum, Chain::Base, Chain::Arbitrum]
    }

    async fn fetch_positions(
        &self,
        account: &str,
        chain: Chain,
        ctx: &FetchContext,
    ) -> anyhow::Result<Vec<AggregationResult>> {
        if !self.service.is_chain_supported(chain) {
            return Ok(vec![]);
        }

        let provider = EvmProvider::new(chain, &ctx.rpc_url)
            .await
            .map_err(|e| anyhow::anyhow!("EVM provider creation failed: {}", e))?;

        let positions = self
            .service
            .get_user_positions(chain, account, Arc::new(provider))
            .await?;

        let mut results = Vec::new();
        for pos in positions {
            for token in &pos.tokens {
                let balance_f64: f64 = token.balance.parse().unwrap_or(0.0);
                let raw_balance = if balance_f64 > 0.0 {
                    (balance_f64 * 10f64.powi(token.decimals as i32)) as u128
                } else {
                    0u128
                };

                results.push(AggregationResult {
                    account: account.to_string(),
                    chain: format!("{:?}", chain).to_lowercase(),
                    protocol: "uniswap-v3".to_string(),
                    position_type: format!("{:?}", pos.position_type).to_lowercase(),
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
                    metadata: Some(pos.metadata.clone()),
                });
            }
        }

        tracing::info!(
            "Found {} Uniswap token results for {}",
            results.len(),
            account
        );
        Ok(results)
    }
}
