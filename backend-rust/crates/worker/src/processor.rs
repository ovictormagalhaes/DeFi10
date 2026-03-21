use anyhow::Result;
use defi10_blockchain::evm::EvmProvider;
use defi10_blockchain::solana::SolanaProvider;
use defi10_blockchain::BlockchainProvider;
use defi10_core::aggregation::AggregationResult;
use defi10_core::Chain;
use defi10_infrastructure::config::AppConfig;
use defi10_infrastructure::PriceHydrationService;
use defi10_protocols::aave::AaveGraphConfig;
use defi10_protocols::uniswap::UniswapGraphConfig;
use defi10_protocols::{
    AaveAdapter, FetchContext, KaminoAdapter, PendleAdapter, ProtocolRegistry, RaydiumAdapter,
    UniswapAdapter,
};
use reqwest::Client;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;

pub struct AggregationProcessor {
    config: Arc<AppConfig>,
    http_client: Arc<Client>,
    registry: ProtocolRegistry,
    price_hydration: PriceHydrationService,
}

impl AggregationProcessor {
    pub fn new(config: AppConfig) -> Self {
        let http_client = Arc::new(Client::new());

        let aave_config = config
            .graph
            .as_ref()
            .map(|g| AaveGraphConfig {
                api_key: Some(g.api_key.clone()),
                url_template: Some(g.url_template.clone()),
                base_subgraph_id: g.subgraphs.aave_v3_base.clone(),
                ethereum_subgraph_id: g.subgraphs.aave_v3_ethereum.clone(),
                arbitrum_subgraph_id: g.subgraphs.aave_v3_arbitrum.clone(),
            })
            .unwrap_or_default();

        let uniswap_config = config
            .graph
            .as_ref()
            .map(|g| UniswapGraphConfig {
                api_key: Some(g.api_key.clone()),
                url_template: Some(g.url_template.clone()),
                ethereum_subgraph_id: g.subgraphs.uniswap_v3_ethereum.clone(),
                base_subgraph_id: g.subgraphs.uniswap_v3_base.clone(),
                arbitrum_subgraph_id: g.subgraphs.uniswap_v3_arbitrum.clone(),
                ethereum_rpc: config.blockchain.get_ethereum_rpc(),
                base_rpc: config.blockchain.get_base_rpc(),
                arbitrum_rpc: config.blockchain.get_arbitrum_rpc(),
            })
            .unwrap_or_default();

        let mut registry = ProtocolRegistry::new();
        registry.register(Arc::new(AaveAdapter::new(http_client.clone(), aave_config)));
        registry.register(Arc::new(UniswapAdapter::new(
            http_client.clone(),
            uniswap_config,
        )));
        registry.register(Arc::new(KaminoAdapter::new(http_client.clone())));
        registry.register(Arc::new(RaydiumAdapter::new(http_client.clone())));
        registry.register(Arc::new(PendleAdapter::new(http_client.clone())));

        let price_hydration = PriceHydrationService::with_client(http_client.clone());

        Self {
            config: Arc::new(config),
            http_client,
            registry,
            price_hydration,
        }
    }

    /// Process aggregation for a single account-chain combination
    /// Returns a list of results (one per position found)
    pub async fn process(
        &self,
        account: &str,
        chain: &str,
        _job_id: Uuid,
    ) -> Result<Vec<AggregationResult>> {
        tracing::debug!(
            "Processing aggregation for account {} on chain {}",
            account,
            chain
        );

        // Parse chain
        let chain_enum = Chain::from_str(chain)
            .map_err(|e| anyhow::anyhow!("Invalid chain: {} - {}", chain, e))?;

        // Check if RPC is configured
        let has_rpc = self.get_rpc_url(&chain_enum).is_ok();

        let results = if has_rpc {
            tracing::info!("Using REAL blockchain data for {} on {}", account, chain);

            match chain_enum {
                Chain::Solana => self.fetch_solana_positions(account).await?,
                _ if chain_enum.is_evm() => self.fetch_evm_positions(account, &chain_enum).await?,
                _ => {
                    tracing::warn!("Chain {} not supported yet", chain);
                    vec![]
                }
            }
        } else {
            tracing::warn!("RPC not configured for {} - skipping", chain);
            vec![]
        };

        let mut results = results;
        self.price_hydration.hydrate_prices(&mut results).await;

        Ok(results)
    }

    /// Fetch positions from EVM-compatible chains (Ethereum, Base, Arbitrum, BNB)
    async fn fetch_evm_positions(
        &self,
        account: &str,
        chain: &Chain,
    ) -> Result<Vec<AggregationResult>> {
        let rpc_url = self.get_rpc_url(chain)?;

        tracing::info!(
            "Fetching EVM positions for {} on {:?} using RPC",
            account,
            chain
        );

        let provider = EvmProvider::new(*chain, &rpc_url).await.map_err(|e| {
            tracing::error!("Failed to create EVM provider: {}", e);
            anyhow::anyhow!("EVM provider creation failed: {}", e)
        })?;

        if !provider.health_check().await.unwrap_or(false) {
            tracing::warn!("EVM provider health check failed for {:?}", chain);
            return Ok(vec![]);
        }

        let mut all_results = Vec::new();

        match self.fetch_native_balance(&provider, account, chain).await {
            Ok(Some(result)) => all_results.push(result),
            Ok(None) => {}
            Err(e) => tracing::warn!("Failed to fetch native balance: {}", e),
        }

        let ctx = FetchContext { rpc_url };
        for adapter in self.registry.get_for_chain(*chain) {
            match adapter.fetch_positions(account, *chain, &ctx).await {
                Ok(mut results) => all_results.append(&mut results),
                Err(e) => tracing::warn!("Failed to fetch {} positions: {}", adapter.name(), e),
            }
        }

        tracing::info!(
            "Fetched {} positions for {} on {:?}",
            all_results.len(),
            account,
            chain
        );

        Ok(all_results)
    }

    /// Fetch native token balance (ETH, BNB, etc.)
    async fn fetch_native_balance(
        &self,
        provider: &EvmProvider,
        account: &str,
        chain: &Chain,
    ) -> Result<Option<AggregationResult>> {
        tracing::debug!("Fetching native balance for {} on {:?}", account, chain);

        // Get native balance (in wei)
        let balance_wei = provider
            .get_native_balance(account)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get native balance: {}", e))?;

        // Convert wei to ether (18 decimals)
        let balance_f64: f64 = balance_wei
            .parse::<u128>()
            .map(|wei| wei as f64 / 1e18)
            .unwrap_or(0.0);

        // Skip if balance is zero
        if balance_f64 < 0.0001 {
            tracing::debug!("Native balance is zero or too small, skipping");
            return Ok(None);
        }

        // Get native token symbol
        let symbol = match chain {
            Chain::Ethereum => "ETH",
            Chain::Base => "ETH",
            Chain::Arbitrum => "ETH",
            Chain::BNB => "BNB",
            _ => "NATIVE",
        };

        // Fetch real-time price from Coingecko
        let token_id = match chain {
            Chain::Ethereum | Chain::Base | Chain::Arbitrum => "ethereum",
            Chain::BNB => "binancecoin",
            _ => "ethereum",
        };

        let usd_price = self.fetch_token_price(token_id).await.unwrap_or_else(|e| {
            tracing::warn!(
                "Failed to fetch price for {}: {}, using fallback",
                token_id,
                e
            );
            match chain {
                Chain::Ethereum | Chain::Base | Chain::Arbitrum => 3000.0,
                Chain::BNB => 600.0,
                _ => 1.0,
            }
        });

        let value_usd = balance_f64 * usd_price;

        Ok(Some(AggregationResult {
            account: account.to_string(),
            chain: format!("{:?}", chain).to_lowercase(),
            protocol: "native".to_string(),
            position_type: "wallet".to_string(),
            balance: balance_f64,
            balance_raw: balance_wei.clone(),
            decimals: 18,
            value_usd,
            price_usd: usd_price,
            token_symbol: symbol.to_string(),
            token_name: symbol.to_string(),
            token_address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee".to_string(),
            timestamp: chrono::Utc::now(),
            apy: None,
            apr: None,
            apr_historical: None,
            health_factor: None,
            is_collateral: None,
            can_be_collateral: None,
            logo: None,
            token_type: None,
            metadata: None,
        }))
    }

    /// Fetch positions from Solana
    async fn fetch_solana_positions(&self, account: &str) -> Result<Vec<AggregationResult>> {
        let rpc_url = self
            .config
            .blockchain
            .get_solana_rpc()
            .ok_or_else(|| anyhow::anyhow!("Solana RPC URL not configured"))?;

        tracing::info!("Fetching Solana positions for {}", account);

        let provider = SolanaProvider::new(&rpc_url).map_err(|e| {
            tracing::error!("Failed to create Solana provider: {}", e);
            anyhow::anyhow!("Solana provider creation failed: {}", e)
        })?;

        if !provider.health_check().await.unwrap_or(false) {
            tracing::warn!("Solana provider health check failed");
            return Ok(vec![]);
        }

        let mut all_results: Vec<AggregationResult> = Vec::new();

        let ctx = FetchContext { rpc_url };
        for adapter in self.registry.get_for_chain(Chain::Solana) {
            match adapter.fetch_positions(account, Chain::Solana, &ctx).await {
                Ok(mut results) => all_results.append(&mut results),
                Err(e) => tracing::warn!("Failed to fetch {} positions: {}", adapter.name(), e),
            }
        }

        tracing::info!(
            "Found {} Solana positions for {}",
            all_results.len(),
            account
        );
        Ok(all_results)
    }

    async fn fetch_token_price(&self, token_id: &str) -> Result<f64> {
        let url = format!(
            "https://api.coingecko.com/api/v3/simple/price?ids={}&vs_currencies=usd",
            token_id
        );

        let response: HashMap<String, HashMap<String, f64>> = self
            .http_client
            .get(&url)
            .header("User-Agent", "DeFi10-Aggregator/1.0")
            .send()
            .await?
            .json()
            .await?;

        response
            .get(token_id)
            .and_then(|prices| prices.get("usd"))
            .copied()
            .ok_or_else(|| anyhow::anyhow!("Price not found for {}", token_id))
    }

    /// Get RPC URL for a given chain
    fn get_rpc_url(&self, chain: &Chain) -> Result<String> {
        let url = match chain {
            Chain::Ethereum => {
                tracing::debug!("Ethereum RPC: {:?}", self.config.blockchain.ethereum_rpc);
                self.config.blockchain.ethereum_rpc.as_ref()
            }
            Chain::Base => {
                tracing::debug!("Base RPC: {:?}", self.config.blockchain.base_rpc);
                self.config.blockchain.base_rpc.as_ref()
            }
            Chain::Arbitrum => {
                tracing::debug!("Arbitrum RPC: {:?}", self.config.blockchain.arbitrum_rpc);
                self.config.blockchain.arbitrum_rpc.as_ref()
            }
            Chain::BNB => {
                tracing::debug!("BNB RPC: {:?}", self.config.blockchain.bnb_rpc);
                self.config.blockchain.bnb_rpc.as_ref()
            }
            Chain::Solana => {
                tracing::debug!("Solana RPC: {:?}", self.config.blockchain.solana_rpc);
                self.config.blockchain.solana_rpc.as_ref()
            }
            _ => None,
        };

        url.cloned()
            .ok_or_else(|| anyhow::anyhow!("RPC URL not configured for chain {:?}", chain))
    }

    // Future methods:
    // - calculate_total_value() - Aggregate across protocols
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_processor_creation() {
        let config = AppConfig {
            server: Default::default(),
            mongodb: defi10_infrastructure::config::MongoConfig {
                uri: "mongodb://localhost:27017".to_string(),
                database: "test".to_string(),
            },
            redis: Default::default(),
            rabbitmq: defi10_infrastructure::config::RabbitMqConfig {
                url: "amqp://localhost:5672".to_string(),
                prefetch_count: 10,
            },
            jwt: defi10_infrastructure::config::JwtConfig {
                secret: "test".to_string(),
                expiration_hours: 24,
            },
            cors: defi10_infrastructure::config::CorsConfig {
                allowed_origins: vec!["*".to_string()],
            },
            rate_limiting: Default::default(),
            blockchain: defi10_infrastructure::config::BlockchainConfig {
                ethereum_rpc: None,
                base_rpc: None,
                arbitrum_rpc: None,
                bnb_rpc: None,
                solana_rpc: None,
                alchemy_api_key: None,
            },
            moralis: None,
            graph: None,
        };
        let _processor = AggregationProcessor::new(config);
    }
}
