use anyhow::Result;
use defi10_blockchain::evm::EvmProvider;
use defi10_blockchain::solana::SolanaProvider;
use defi10_blockchain::BlockchainProvider;
use defi10_core::aggregation::AggregationResult;
use defi10_core::Chain;
use defi10_infrastructure::config::AppConfig;
use defi10_infrastructure::MoralisClient;
use defi10_infrastructure::PriceHydrationService;
use defi10_protocols::aave::{AaveGraphConfig, AaveV3Service};
use defi10_protocols::kamino::KaminoService;
use defi10_protocols::pendle::PendleService;
use defi10_protocols::raydium::RaydiumService;
use defi10_protocols::uniswap::{UniswapGraphConfig, UniswapV3Service};
use reqwest::Client;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;

pub struct AggregationProcessor {
    config: Arc<AppConfig>,
    http_client: Arc<Client>,
    moralis_client: Option<MoralisClient>,
    aave_service: AaveV3Service,
    uniswap_service: UniswapV3Service,
    price_hydration: PriceHydrationService,
}

impl AggregationProcessor {
    pub fn new(config: AppConfig) -> Self {
        let http_client = Arc::new(Client::new());

        let moralis_client = config
            .moralis
            .as_ref()
            .filter(|m| m.is_configured())
            .map(|m| {
                tracing::info!(
                    "Moralis configured with API key (first 8 chars): {}...",
                    &m.api_key[..8.min(m.api_key.len())]
                );
                MoralisClient::with_client_and_urls(
                    http_client.clone(),
                    m.api_key.clone(),
                    m.base_url.clone(),
                    m.solana_base_url.clone(),
                )
            });

        if moralis_client.is_none() {
            tracing::warn!("Moralis NOT configured - token fetching will be limited");
        }

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

        let aave_service = AaveV3Service::with_client(http_client.clone(), aave_config);
        let uniswap_service = UniswapV3Service::with_client(http_client.clone(), uniswap_config);
        let price_hydration = PriceHydrationService::with_client(http_client.clone());

        Self {
            config: Arc::new(config),
            http_client,
            moralis_client,
            aave_service,
            uniswap_service,
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
            tracing::warn!("RPC not configured for {} - using mock data", chain);
            self.fetch_mock_data(account, chain).await?
        };

        let mut results = results;
        self.price_hydration.hydrate_prices(&mut results).await;

        Ok(results)
    }

    /// Fetch mock data (placeholder for real implementation)
    async fn fetch_mock_data(&self, account: &str, chain: &str) -> Result<Vec<AggregationResult>> {
        // Simulate some processing time
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Return mock results - simulating 3 positions
        let results = vec![
            AggregationResult {
                account: account.to_string(),
                chain: chain.to_string(),
                protocol: "aave".to_string(),
                position_type: "lending".to_string(),
                balance: 1000.0,
                balance_raw: "1000000000".to_string(),
                decimals: 6,
                value_usd: 1000.0,
                price_usd: 1.0,
                token_symbol: "USDC".to_string(),
                token_name: "USD Coin".to_string(),
                token_address: "".to_string(),
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
            },
            AggregationResult {
                account: account.to_string(),
                chain: chain.to_string(),
                protocol: "uniswap".to_string(),
                position_type: "liquidity".to_string(),
                balance: 500.0,
                balance_raw: "500000000000000000000".to_string(),
                decimals: 18,
                value_usd: 500.0,
                price_usd: 1.0,
                token_symbol: "ETH-USDC".to_string(),
                token_name: "Uniswap V3 LP".to_string(),
                token_address: "".to_string(),
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
            },
        ];

        Ok(results)
    }

    /// Fetch positions from EVM-compatible chains (Ethereum, Base, Arbitrum, BNB)
    async fn fetch_evm_positions(
        &self,
        account: &str,
        chain: &Chain,
    ) -> Result<Vec<AggregationResult>> {
        // Get RPC URL for the chain
        let rpc_url = self.get_rpc_url(chain)?;

        tracing::info!(
            "Fetching EVM positions for {} on {:?} using RPC",
            account,
            chain
        );

        // Create EVM provider
        let provider = EvmProvider::new(*chain, &rpc_url).await.map_err(|e| {
            tracing::error!("Failed to create EVM provider: {}", e);
            anyhow::anyhow!("EVM provider creation failed: {}", e)
        })?;

        // Health check
        if !provider.health_check().await.unwrap_or(false) {
            tracing::warn!("EVM provider health check failed for {:?}", chain);
            return Ok(vec![]); // Return empty instead of failing the whole job
        }

        let mut all_results = Vec::new();

        // 1. Fetch native balance (ETH, BNB, etc.)
        match self.fetch_native_balance(&provider, account, chain).await {
            Ok(Some(result)) => all_results.push(result),
            Ok(None) => {}
            Err(e) => tracing::warn!("Failed to fetch native balance: {}", e),
        }

        // 2. Fetch ERC-20 tokens from Moralis
        match self.fetch_moralis_evm_tokens(account, chain).await {
            Ok(mut results) => all_results.append(&mut results),
            Err(e) => tracing::warn!("Failed to fetch Moralis tokens: {}", e),
        }

        // 3. NFT Screening - detect which protocols to call
        let nft_contracts = self
            .screen_moralis_evm_nfts(account, chain)
            .await
            .unwrap_or_default();

        let has_uniswap_nft = self.has_uniswap_v3_nft(&nft_contracts, chain);
        let has_pendle_nft = self.has_pendle_nft(&nft_contracts, chain);

        // 4. Fetch Aave positions (lending/borrowing)
        match self.fetch_aave_positions(&provider, account, chain).await {
            Ok(mut results) => all_results.append(&mut results),
            Err(e) => tracing::warn!("Failed to fetch Aave positions: {}", e),
        }

        // 5. Fetch Uniswap positions (only if NFT detected)
        if has_uniswap_nft {
            match self
                .fetch_uniswap_positions(&provider, account, chain)
                .await
            {
                Ok(mut results) => all_results.append(&mut results),
                Err(e) => tracing::warn!("Failed to fetch Uniswap positions: {}", e),
            }
        } else {
            tracing::debug!(
                "Skipping Uniswap V3 - no NFT detected for {} on {:?}",
                account,
                chain
            );
        }

        // 6. Fetch Pendle positions (only if NFT detected)
        if has_pendle_nft {
            match self.fetch_pendle_positions(&provider, account, chain).await {
                Ok(mut results) => all_results.append(&mut results),
                Err(e) => tracing::warn!("Failed to fetch Pendle positions: {}", e),
            }
        } else {
            tracing::debug!(
                "Skipping Pendle - no NFT detected for {} on {:?}",
                account,
                chain
            );
        }

        // 7. Fetch Pendle vePENDLE locking positions (Ethereum only, no NFT needed)
        if *chain == Chain::Ethereum {
            match self.fetch_pendle_ve_positions(account, chain).await {
                Ok(mut results) => all_results.append(&mut results),
                Err(e) => tracing::warn!("Failed to fetch Pendle vePENDLE positions: {}", e),
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

        let raw_balance = balance_wei.clone();

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
            balance_raw: raw_balance.to_string(),
            decimals: 18,
            value_usd,
            price_usd: usd_price,
            token_symbol: symbol.to_string(),
            token_name: match chain {
                Chain::Ethereum | Chain::Base | Chain::Arbitrum => "Ether".to_string(),
                Chain::BNB => "BNB".to_string(),
                _ => symbol.to_string(),
            },
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

        tracing::debug!(
            "Fetching Solana positions for {} using RPC: {}",
            account,
            &rpc_url[..50.min(rpc_url.len())]
        );

        let provider = SolanaProvider::new(&rpc_url).map_err(|e| {
            tracing::error!("Failed to create Solana provider: {}", e);
            anyhow::anyhow!("Solana provider creation failed: {}", e)
        })?;

        if !provider.health_check().await.unwrap_or(false) {
            tracing::warn!("Solana provider health check failed");
            return Ok(vec![]);
        }

        let mut all_results: Vec<AggregationResult> = Vec::new();

        // 1. Fetch SPL tokens from Moralis
        match self.fetch_moralis_solana_tokens(account).await {
            Ok(mut positions) => all_results.append(&mut positions),
            Err(e) => tracing::warn!("Failed to fetch Moralis Solana tokens: {}", e),
        }

        // 2. NFT Screening for Solana (not returned in results)
        // Future: detect Raydium CLMM NFTs and trigger conditionally

        // 3. Fetch Kamino positions (lending)
        match self.fetch_kamino_positions(&provider, account).await {
            Ok(mut positions) => all_results.append(&mut positions),
            Err(e) => tracing::warn!("Failed to fetch Kamino positions: {}", e),
        }

        // 4. Fetch Raydium positions (liquidity pools)
        match self.fetch_raydium_positions(&provider, account).await {
            Ok(mut positions) => all_results.append(&mut positions),
            Err(e) => tracing::warn!("Failed to fetch Raydium positions: {}", e),
        }

        tracing::info!(
            "Found {} Solana positions for {}",
            all_results.len(),
            account
        );
        Ok(all_results)
    }

    async fn fetch_aave_positions(
        &self,
        _provider: &EvmProvider,
        account: &str,
        chain: &Chain,
    ) -> Result<Vec<AggregationResult>> {
        tracing::debug!("Fetching Aave V3 positions for {} on {:?}", account, chain);

        if !self.aave_service.is_chain_supported(*chain) {
            tracing::debug!("Aave not configured for chain {:?} - skipping", chain);
            return Ok(vec![]);
        }

        let positions = self
            .aave_service
            .get_user_positions(*chain, account)
            .await
            .map_err(|e| {
                tracing::warn!("Failed to fetch Aave positions: {}", e);
                e
            })?;

        let (supplies_history, borrows_history, repays_history, tokens_info) = self
            .aave_service
            .get_transaction_history(*chain, account)
            .await
            .unwrap_or_else(|e| {
                tracing::warn!("Failed to fetch Aave transaction history: {}", e);
                (vec![], vec![], vec![], vec![])
            });

        let mut results = Vec::new();

        let _health_factor_value = positions
            .first()
            .and_then(|p| p.metadata.get("healthFactor"))
            .and_then(|v| v.as_f64());

        for pos in &positions {
            let apy = pos.metadata.get("apy").and_then(|v| v.as_f64());
            let health_factor = pos.metadata.get("healthFactor").and_then(|v| v.as_f64());
            let is_collateral = pos.metadata.get("is_collateral").and_then(|v| v.as_bool());
            let can_be_collateral = pos
                .metadata
                .get("can_be_collateral")
                .and_then(|v| v.as_bool());

            for token in &pos.tokens {
                let balance = token.balance.parse::<f64>().unwrap_or(0.0);
                if balance > 0.0 {
                    let raw_balance = (balance * 10f64.powi(token.decimals as i32)) as u128;
                    results.push(AggregationResult {
                        account: account.to_string(),
                        chain: format!("{:?}", chain).to_lowercase(),
                        protocol: "aave-v3".to_string(),
                        position_type: format!("{:?}", pos.position_type).to_lowercase(),
                        balance,
                        balance_raw: raw_balance.to_string(),
                        decimals: token.decimals,
                        value_usd: token.balance_usd,
                        price_usd: token.price_usd,
                        token_symbol: token.symbol.clone(),
                        token_name: token_symbol_to_name(&token.symbol),
                        token_address: token.token_address.clone(),
                        timestamp: chrono::Utc::now(),
                        apy,
                        apr: None,
                        apr_historical: None,
                        health_factor,
                        is_collateral,
                        can_be_collateral,
                        logo: None,
                        token_type: token.token_type.clone(),
                        metadata: Some(pos.metadata.clone()),
                    });
                }
            }
        }

        if !supplies_history.is_empty() || !borrows_history.is_empty() || !repays_history.is_empty()
        {
            let mut history_by_token: std::collections::HashMap<String, (Vec<_>, Vec<_>, Vec<_>)> =
                std::collections::HashMap::new();

            for supply in &supplies_history {
                let key = supply.token_address.to_lowercase();
                history_by_token
                    .entry(key)
                    .or_default()
                    .0
                    .push(supply.clone());
            }
            for borrow in &borrows_history {
                let key = borrow.token_address.to_lowercase();
                history_by_token
                    .entry(key)
                    .or_default()
                    .1
                    .push(borrow.clone());
            }
            for repay in &repays_history {
                let key = repay.token_address.to_lowercase();
                history_by_token
                    .entry(key)
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

    /// Fetch Uniswap V3 liquidity positions
    async fn fetch_uniswap_positions(
        &self,
        provider: &EvmProvider,
        account: &str,
        chain: &Chain,
    ) -> Result<Vec<AggregationResult>> {
        tracing::debug!(
            "Fetching Uniswap V3 positions for {} on {:?}",
            account,
            chain
        );

        if !self.uniswap_service.is_chain_supported(*chain) {
            tracing::debug!("Uniswap not configured for chain {:?} - skipping", chain);
            return Ok(vec![]);
        }

        let positions = self
            .uniswap_service
            .get_user_positions(*chain, account, Arc::new(provider.clone()))
            .await
            .map_err(|e| {
                tracing::warn!("Failed to fetch Uniswap positions: {}", e);
                e
            })?;

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
                    token_name: token_symbol_to_name(&token.symbol),
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

    /// Fetch Pendle yield trading positions
    async fn fetch_pendle_positions(
        &self,
        provider: &EvmProvider,
        account: &str,
        chain: &Chain,
    ) -> Result<Vec<AggregationResult>> {
        tracing::debug!("Fetching Pendle positions for {} on {:?}", account, chain);

        let pendle_service = PendleService::with_client(self.http_client.clone());
        let positions = pendle_service
            .get_user_positions(*chain, account)
            .await
            .map_err(|e| {
                tracing::warn!("Failed to fetch Pendle positions: {}", e);
                e
            })?;

        let mut results = Vec::new();

        for pos in positions {
            // Convert ProtocolPosition to AggregationResult
            // For Pendle, we split PT and YT tokens into separate results
            for token in &pos.tokens {
                let balance = token.balance.parse::<f64>().unwrap_or(0.0);
                let raw_balance = (balance * 10f64.powi(token.decimals as i32)) as u128;
                results.push(AggregationResult {
                    account: account.to_string(),
                    chain: format!("{:?}", chain).to_lowercase(),
                    protocol: "pendle".to_string(),
                    position_type: format!("{:?}", pos.position_type).to_lowercase(),
                    balance,
                    balance_raw: raw_balance.to_string(),
                    decimals: token.decimals,
                    value_usd: token.balance_usd,
                    price_usd: token.price_usd,
                    token_symbol: token.symbol.clone(),
                    token_name: token_symbol_to_name(&token.symbol),
                    token_address: token.token_address.clone(),
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
                });
            }
        }

        tracing::info!("Found {} Pendle positions for {}", results.len(), account);
        Ok(results)
    }

    async fn fetch_pendle_ve_positions(
        &self,
        account: &str,
        chain: &Chain,
    ) -> Result<Vec<AggregationResult>> {
        tracing::debug!(
            "Fetching Pendle vePENDLE positions for {} on {:?}",
            account,
            chain
        );

        let rpc_url = self.get_rpc_url(chain)?;
        let pendle_service = PendleService::with_client(self.http_client.clone());
        let positions = pendle_service
            .get_ve_positions(&rpc_url, account)
            .await
            .map_err(|e| {
                tracing::warn!("Failed to fetch Pendle vePENDLE positions: {}", e);
                e
            })?;

        let mut results = Vec::new();

        for pos in positions {
            let unlock_at = pos
                .metadata
                .get("unlockAt")
                .and_then(|v: &serde_json::Value| v.as_i64());

            for token in pos.tokens {
                let balance_f64 = token.balance.parse::<f64>().unwrap_or(0.0);
                if balance_f64 > 0.0 {
                    let raw_balance = (balance_f64 * 10f64.powi(token.decimals as i32)) as u128;
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

        tracing::info!(
            "Found {} Pendle vePENDLE positions for {}",
            results.len(),
            account
        );
        Ok(results)
    }

    async fn fetch_kamino_positions(
        &self,
        provider: &SolanaProvider,
        account: &str,
    ) -> Result<Vec<AggregationResult>> {
        tracing::info!("Fetching Kamino positions for {}", account);

        let kamino_service = KaminoService::with_client(self.http_client.clone());
        let positions = kamino_service
            .get_user_positions(account, Arc::new((*provider).clone()))
            .await?;

        tracing::info!(
            "Kamino: Found {} positions for {}",
            positions.len(),
            account
        );

        let _health_factor_value = positions
            .first()
            .and_then(|p| p.metadata.get("healthFactor"))
            .and_then(|v| v.as_f64());

        let mut results = Vec::new();
        for pos in positions {
            let apy = pos.metadata.get("apy").and_then(|v| v.as_f64());
            let health_factor = pos.metadata.get("healthFactor").and_then(|v| v.as_f64());
            let is_collateral = pos
                .metadata
                .get("isCollateral")
                .and_then(|v| v.as_bool())
                .or(Some(true));

            for token in pos.tokens {
                let balance_f64 = token.balance.parse().unwrap_or(0.0);
                if balance_f64 > 0.0 {
                    let raw_balance = (balance_f64 * 10f64.powi(token.decimals as i32)) as u128;
                    results.push(AggregationResult {
                        account: account.to_string(),
                        chain: "solana".to_string(),
                        protocol: "kamino".to_string(),
                        position_type: format!("{:?}", pos.position_type).to_lowercase(),
                        balance: balance_f64,
                        balance_raw: raw_balance.to_string(),
                        decimals: token.decimals,
                        value_usd: token.balance_usd,
                        price_usd: token.price_usd,
                        token_symbol: token.symbol.clone(),
                        token_name: token_symbol_to_name(&token.symbol),
                        token_address: token.token_address.clone(),
                        timestamp: chrono::Utc::now(),
                        apy,
                        apr: None,
                        apr_historical: None,
                        health_factor,
                        is_collateral,
                        can_be_collateral: Some(true),
                        logo: None,
                        token_type: token.token_type.clone(),
                        metadata: Some(pos.metadata.clone()),
                    });
                }
            }
        }

        let events = kamino_service
            .get_transaction_history(account)
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

        defi10_protocols::kamino::attach_transaction_history(&mut results, &events);

        Ok(results)
    }

    /// Fetch Raydium liquidity positions on Solana
    async fn fetch_raydium_positions(
        &self,
        provider: &SolanaProvider,
        account: &str,
    ) -> Result<Vec<AggregationResult>> {
        tracing::debug!("Fetching Raydium positions for {}", account);

        let rpc_url = self
            .config
            .blockchain
            .get_solana_rpc()
            .unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());
        let raydium_service = RaydiumService::with_client(self.http_client.clone(), rpc_url);
        let provider_arc = std::sync::Arc::new(provider.clone());
        let positions = raydium_service
            .get_user_positions(account, provider_arc)
            .await?;

        let mut results = Vec::new();

        for pos in positions {
            let apr = pos.metadata.get("apr").and_then(|v| v.as_f64());

            for token in &pos.tokens {
                let balance_f64: f64 = token.balance.parse().unwrap_or(0.0);
                if balance_f64 > 0.0 || token.balance_usd > 0.0 {
                    let raw_balance = (balance_f64 * 10f64.powi(token.decimals as i32)) as u128;
                    results.push(AggregationResult {
                        account: account.to_string(),
                        chain: "solana".to_string(),
                        protocol: "raydium".to_string(),
                        position_type: format!("{:?}", pos.position_type).to_lowercase(),
                        balance: balance_f64,
                        balance_raw: raw_balance.to_string(),
                        decimals: token.decimals,
                        value_usd: token.balance_usd,
                        price_usd: token.price_usd,
                        token_symbol: token.symbol.clone(),
                        token_name: token_symbol_to_name(&token.symbol),
                        token_address: token.token_address.clone(),
                        timestamp: chrono::Utc::now(),
                        apy: None,
                        apr,
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
        }

        tracing::info!(
            "Found {} Raydium token results for {}",
            results.len(),
            account
        );
        Ok(results)
    }

    /// Fetch token price from Coingecko API
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
                let rpc = self.config.blockchain.get_ethereum_rpc();
                tracing::debug!("Ethereum RPC configured: {}", rpc.is_some());
                rpc
            }
            Chain::Base => {
                let rpc = self.config.blockchain.get_base_rpc();
                tracing::debug!("Base RPC configured: {}", rpc.is_some());
                rpc
            }
            Chain::Arbitrum => {
                let rpc = self.config.blockchain.get_arbitrum_rpc();
                tracing::debug!("Arbitrum RPC configured: {}", rpc.is_some());
                rpc
            }
            Chain::BNB => {
                tracing::debug!("BNB RPC: {:?}", self.config.blockchain.bnb_rpc);
                self.config.blockchain.bnb_rpc.clone()
            }
            Chain::Solana => {
                let rpc = self.config.blockchain.get_solana_rpc();
                tracing::debug!("Solana RPC configured: {}", rpc.is_some());
                rpc
            }
            _ => None,
        };

        url.ok_or_else(|| anyhow::anyhow!("RPC URL not configured for chain {:?}", chain))
    }

    /// Fetch ERC-20 tokens from Moralis
    async fn fetch_moralis_evm_tokens(
        &self,
        account: &str,
        chain: &Chain,
    ) -> Result<Vec<AggregationResult>> {
        let moralis = self
            .moralis_client
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Moralis not configured"))?;

        tracing::debug!("Fetching Moralis EVM tokens for {} on {:?}", account, chain);

        let tokens = moralis
            .get_evm_tokens(*chain, account)
            .await
            .map_err(|e| anyhow::anyhow!("Moralis tokens error: {}", e))?;

        let mut results = Vec::new();

        for token in tokens {
            if token.possible_spam.unwrap_or(false) {
                tracing::debug!("Filtering out spam token: {:?}", token.symbol);
                continue;
            }

            let symbol = token.symbol.as_deref().unwrap_or("");

            if Self::is_protocol_token(symbol) {
                tracing::debug!("Filtering out protocol token: {}", symbol);
                continue;
            }

            let balance = token
                .balance_formatted
                .or_else(|| {
                    token.decimals.and_then(|decimals| {
                        token
                            .balance
                            .parse::<u128>()
                            .ok()
                            .map(|b| (b as f64) / 10_f64.powi(decimals as i32))
                            .map(|f| f.to_string())
                    })
                })
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0);

            if balance <= 0.0 {
                continue;
            }

            let value_usd = token.usd_value.unwrap_or(0.0);
            let decimals = token.decimals.unwrap_or(18);
            let price_usd = token.usd_price.unwrap_or(0.0);

            if price_usd <= 0.0 {
                tracing::debug!(
                    "Filtering out zero-price token: {} ({})",
                    symbol,
                    token.token_address
                );
                continue;
            }

            results.push(AggregationResult {
                account: account.to_string(),
                chain: format!("{:?}", chain).to_lowercase(),
                protocol: "wallet".to_string(),
                position_type: "token".to_string(),
                balance,
                balance_raw: token.balance.clone(),
                decimals: decimals as u8,
                value_usd,
                price_usd,
                token_symbol: symbol.to_string(),
                token_name: token.name.clone().unwrap_or_else(|| symbol.to_string()),
                token_address: token.token_address.clone(),
                timestamp: chrono::Utc::now(),
                apy: None,
                apr: None,
                apr_historical: None,
                health_factor: None,
                is_collateral: None,
                can_be_collateral: None,
                logo: token.logo.clone(),
                token_type: None,
                metadata: None,
            });
        }

        tracing::info!(
            "Found {} ERC-20 tokens from Moralis (after filtering)",
            results.len()
        );
        Ok(results)
    }

    fn is_protocol_token(symbol: &str) -> bool {
        let symbol_lower = symbol.to_lowercase();

        symbol_lower.starts_with("abas") ||
        symbol_lower.starts_with("abase") ||
        symbol_lower.starts_with("aeth") ||
        symbol_lower.starts_with("aarb") ||
        symbol_lower.starts_with("aopt") ||
        symbol_lower.starts_with("apol") ||
        symbol_lower.starts_with("aava") ||
        symbol_lower.starts_with("variabledebts") ||
        symbol_lower.starts_with("variabledebt") ||
        symbol_lower.starts_with("stabledebt") ||
        symbol_lower.starts_with("amatic") ||
        // Pendle tokens
        symbol_lower.starts_with("pt-") ||
        symbol_lower.starts_with("yt-") ||
        symbol_lower.starts_with("sy-") ||
        // Uniswap LP tokens (though usually NFTs, some chains have ERC20 representations)
        symbol_lower == "uni-v2" ||
        symbol_lower == "uni-v3-pos"
    }

    /// Screen NFTs from Moralis (EVM chains) - returns contract addresses for protocol detection
    async fn screen_moralis_evm_nfts(&self, account: &str, chain: &Chain) -> Result<Vec<String>> {
        let moralis = self
            .moralis_client
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Moralis not configured"))?;

        tracing::debug!("Screening Moralis EVM NFTs for {} on {:?}", account, chain);

        let nfts = moralis
            .get_evm_nfts(*chain, account)
            .await
            .map_err(|e| anyhow::anyhow!("Moralis NFTs error: {}", e))?;

        let mut contract_addresses = Vec::new();

        for nft in &nfts {
            if nft.possible_spam.unwrap_or(false) {
                continue;
            }
            contract_addresses.push(nft.token_address.to_lowercase());
        }

        contract_addresses.sort();
        contract_addresses.dedup();

        tracing::info!(
            "Found {} unique NFT contracts for screening on {:?}",
            contract_addresses.len(),
            chain
        );
        if !contract_addresses.is_empty() {
            tracing::debug!("NFT contracts found: {:?}", contract_addresses);
        }
        Ok(contract_addresses)
    }

    /// Check if account has Uniswap V3 NFT (NonfungiblePositionManager)
    fn has_uniswap_v3_nft(&self, nft_contracts: &[String], chain: &Chain) -> bool {
        let uniswap_contract = match chain {
            Chain::Base => "0x03a520b32c04bf3beef7beb72e919cf822ed34f1",
            Chain::Ethereum => "0xc36442b4a4522e871399cd717abdd847ab11fe88",
            Chain::Arbitrum => "0xc36442b4a4522e871399cd717abdd847ab11fe88",
            _ => return false,
        };

        tracing::debug!(
            "Checking for Uniswap V3 NFT on {:?}. Looking for: {}, Found contracts: {:?}",
            chain,
            uniswap_contract,
            nft_contracts
        );

        let has_nft = nft_contracts
            .iter()
            .any(|addr| addr.to_lowercase() == uniswap_contract.to_lowercase());
        if has_nft {
            tracing::info!(
                "✓ Uniswap V3 NFT detected on {:?} - will fetch positions",
                chain
            );
        } else {
            tracing::debug!("✗ Uniswap V3 NFT NOT detected on {:?}", chain);
        }
        has_nft
    }

    /// Check if account has Pendle NFT
    fn has_pendle_nft(&self, nft_contracts: &[String], chain: &Chain) -> bool {
        // Pendle doesn't use NFTs for position tracking in the same way
        // This is a placeholder for future implementation
        false
    }

    /// Fetch Solana SPL tokens from Moralis
    async fn fetch_moralis_solana_tokens(&self, account: &str) -> Result<Vec<AggregationResult>> {
        let moralis = self
            .moralis_client
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Moralis not configured"))?;

        tracing::debug!("Fetching Moralis Solana tokens for {}", account);

        let tokens = moralis
            .get_solana_tokens(account)
            .await
            .map_err(|e| anyhow::anyhow!("Moralis Solana tokens error: {}", e))?;

        let mut results = Vec::new();

        for token in tokens {
            let balance = token
                .amount
                .parse::<u128>()
                .ok()
                .map(|b| (b as f64) / 10_f64.powi(token.decimals as i32))
                .unwrap_or(0.0);

            if balance <= 0.0 {
                continue;
            }

            let symbol = token
                .symbol
                .clone()
                .unwrap_or_else(|| "UNKNOWN".to_string());
            let name = token.name.clone().unwrap_or_else(|| symbol.clone());

            let mut price_usd = token.usd_price.unwrap_or(0.0);
            let mut value_usd = token.usd_value.unwrap_or(0.0);

            if price_usd == 0.0 {
                if let Ok(Some(fetched_price)) = moralis.get_solana_token_price(&token.mint).await {
                    price_usd = fetched_price;
                    value_usd = balance * price_usd;
                }
            }

            if value_usd == 0.0 && price_usd > 0.0 {
                value_usd = balance * price_usd;
            }

            results.push(AggregationResult {
                account: account.to_string(),
                chain: "solana".to_string(),
                protocol: "wallet".to_string(),
                position_type: "token".to_string(),
                balance,
                balance_raw: token.amount.clone(),
                decimals: token.decimals as u8,
                value_usd,
                price_usd,
                token_symbol: symbol,
                token_name: name,
                token_address: token.mint.clone(),
                timestamp: chrono::Utc::now(),
                apy: None,
                apr: None,
                apr_historical: None,
                health_factor: None,
                is_collateral: None,
                can_be_collateral: None,
                logo: token.logo.clone(),
                token_type: None,
                metadata: None,
            });
        }

        tracing::info!("Found {} SPL tokens from Moralis", results.len());
        Ok(results)
    }

    /// Fetch Solana NFTs from Moralis
    // NOTE: Solana NFTs are for screening only (like Raydium CLMM detection)
    // Not currently used - reserved for future Raydium NFT-based LP detection
    #[allow(dead_code)]
    async fn fetch_moralis_solana_nfts(&self, account: &str) -> Result<Vec<AggregationResult>> {
        let moralis = self
            .moralis_client
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Moralis not configured"))?;

        tracing::debug!("Fetching Moralis Solana NFTs for {}", account);

        let nfts = moralis
            .get_solana_nfts(account)
            .await
            .map_err(|e| anyhow::anyhow!("Moralis Solana NFTs error: {}", e))?;

        let results = vec![AggregationResult {
            account: account.to_string(),
            chain: "solana".to_string(),
            protocol: "wallet".to_string(),
            position_type: "nft".to_string(),
            balance: nfts.len() as f64,
            balance_raw: nfts.len().to_string(),
            decimals: 0,
            value_usd: 0.0,
            price_usd: 0.0,
            token_symbol: "NFT".to_string(),
            token_name: "NFT Collection".to_string(),
            token_address: "".to_string(),
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
        }];

        tracing::info!("Found {} Solana NFTs from Moralis", nfts.len());
        Ok(results)
    }

    // Future methods:
    // - calculate_total_value() - Aggregate across protocols
}

fn token_symbol_to_name(symbol: &str) -> String {
    match symbol.to_uppercase().as_str() {
        "ETH" => "Ether".to_string(),
        "WETH" => "Wrapped Ether".to_string(),
        "BTC" | "WBTC" => "Wrapped Bitcoin".to_string(),
        "CBBTC" => "Coinbase Wrapped BTC".to_string(),
        "USDC" => "USD Coin".to_string(),
        "USDT" => "Tether USD".to_string(),
        "DAI" => "Dai Stablecoin".to_string(),
        "SOL" => "Solana".to_string(),
        "WSOL" => "Wrapped SOL".to_string(),
        "BNB" => "BNB".to_string(),
        "WBNB" => "Wrapped BNB".to_string(),
        _ => symbol.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_processor() {
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
        let processor = AggregationProcessor::new(config);

        let job_id = Uuid::new_v4();
        let results = processor
            .process(
                "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
                "ethereum",
                job_id,
            )
            .await
            .unwrap();

        assert!(!results.is_empty());
        assert_eq!(results[0].chain, "ethereum");
        assert_eq!(results[0].value_usd, 1000.0);
    }

    #[test]
    fn test_is_protocol_token() {
        assert!(AggregationProcessor::is_protocol_token("aBasWETH"));
        assert!(AggregationProcessor::is_protocol_token(
            "variableDebtBasUSDC"
        ));
        assert!(AggregationProcessor::is_protocol_token("aBascbBTC"));
        assert!(AggregationProcessor::is_protocol_token("PT-sUSDE"));
        assert!(AggregationProcessor::is_protocol_token("YT-stETH"));
        assert!(!AggregationProcessor::is_protocol_token("USDC"));
        assert!(!AggregationProcessor::is_protocol_token("WETH"));
        assert!(!AggregationProcessor::is_protocol_token("ETH"));
    }
}
