use crate::external::coingecko::{symbol_to_coingecko_id, CoingeckoClient};
use crate::external::MoralisClient;
use defi10_core::aggregation::AggregationResult;
use defi10_core::Chain;
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
struct CachedPrice {
    price_usd: f64,
    cached_at: chrono::DateTime<chrono::Utc>,
}

impl CachedPrice {
    fn is_expired(&self, ttl_hours: i64) -> bool {
        let age = chrono::Utc::now() - self.cached_at;
        age.num_hours() >= ttl_hours
    }
}

pub struct PriceHydrationService {
    coingecko: CoingeckoClient,
    moralis: Option<MoralisClient>,
    cache: Arc<RwLock<HashMap<String, CachedPrice>>>,
    cache_ttl_hours: i64,
}

impl PriceHydrationService {
    pub fn new() -> Self {
        Self {
            coingecko: CoingeckoClient::new(),
            moralis: None,
            cache: Arc::new(RwLock::new(HashMap::new())),
            cache_ttl_hours: 1,
        }
    }

    pub fn with_moralis(moralis_api_key: &str) -> Self {
        Self {
            coingecko: CoingeckoClient::new(),
            moralis: Some(MoralisClient::new(moralis_api_key.to_string())),
            cache: Arc::new(RwLock::new(HashMap::new())),
            cache_ttl_hours: 1,
        }
    }

    pub fn with_client(client: Arc<Client>) -> Self {
        Self {
            coingecko: CoingeckoClient::with_client(client.clone()),
            moralis: None,
            cache: Arc::new(RwLock::new(HashMap::new())),
            cache_ttl_hours: 1,
        }
    }

    pub fn with_client_and_moralis(client: Arc<Client>, moralis_api_key: &str) -> Self {
        Self {
            coingecko: CoingeckoClient::with_client(client.clone()),
            moralis: Some(MoralisClient::with_client(
                client,
                moralis_api_key.to_string(),
            )),
            cache: Arc::new(RwLock::new(HashMap::new())),
            cache_ttl_hours: 1,
        }
    }

    pub async fn hydrate_prices(&self, results: &mut [AggregationResult]) -> HydrationStats {
        let mut stats = HydrationStats::default();

        let mut symbols_needing_price: Vec<(usize, String, String, String)> = Vec::new();
        let mut already_priced: HashMap<String, f64> = HashMap::new();

        for (idx, result) in results.iter().enumerate() {
            let key = format!(
                "{}|{}",
                result.token_symbol.to_lowercase(),
                result.chain.to_lowercase()
            );

            if result.price_usd > 0.0 {
                already_priced.insert(key.clone(), result.price_usd);
                stats.already_priced += 1;
            } else if result.balance > 0.0 {
                symbols_needing_price.push((
                    idx,
                    result.token_symbol.clone(),
                    result.chain.clone(),
                    result.token_address.clone(),
                ));
            }
        }

        if symbols_needing_price.is_empty() {
            tracing::debug!(
                "[PriceHydration] All {} tokens already have prices",
                stats.already_priced
            );
            return stats;
        }

        tracing::debug!(
            "[PriceHydration] {} tokens need prices, {} already priced",
            symbols_needing_price.len(),
            stats.already_priced
        );

        for (idx, symbol, chain, token_address) in &symbols_needing_price {
            let key = format!("{}|{}", symbol.to_lowercase(), chain.to_lowercase());

            if let Some(&price) = already_priced.get(&key) {
                results[*idx].price_usd = price;
                results[*idx].value_usd = results[*idx].balance * price;
                stats.inferred_from_peers += 1;
                tracing::debug!(
                    "[PriceHydration] Inferred price for {} from peer: ${}",
                    symbol,
                    price
                );
                continue;
            }

            if let Some(price) = self.get_cached_price(&key).await {
                results[*idx].price_usd = price;
                results[*idx].value_usd = results[*idx].balance * price;
                stats.from_cache += 1;
                tracing::debug!("[PriceHydration] Cache hit for {}: ${}", symbol, price);
                continue;
            }

            if let Some(price) = self
                .try_fetch_price_with_address(symbol, chain, token_address)
                .await
            {
                results[*idx].price_usd = price;
                results[*idx].value_usd = results[*idx].balance * price;
                self.cache_price(&key, price).await;
                stats.fetched_from_api += 1;
                tracing::debug!("[PriceHydration] Fetched price for {}: ${}", symbol, price);
                continue;
            }

            if let Some(price) = self.try_fallback_price(symbol, &already_priced) {
                results[*idx].price_usd = price;
                results[*idx].value_usd = results[*idx].balance * price;
                stats.fallback_applied += 1;
                tracing::debug!("[PriceHydration] Fallback price for {}: ${}", symbol, price);
                continue;
            }

            stats.not_found += 1;
            tracing::warn!("[PriceHydration] Could not find price for {}", symbol);
        }

        tracing::info!(
            "[PriceHydration] Hydration complete: {} already priced, {} inferred, {} cached, {} fetched, {} fallback, {} not found",
            stats.already_priced,
            stats.inferred_from_peers,
            stats.from_cache,
            stats.fetched_from_api,
            stats.fallback_applied,
            stats.not_found
        );

        stats
    }

    async fn get_cached_price(&self, key: &str) -> Option<f64> {
        let cache = self.cache.read().await;
        cache
            .get(key)
            .filter(|p| !p.is_expired(self.cache_ttl_hours))
            .map(|p| p.price_usd)
    }

    async fn cache_price(&self, key: &str, price: f64) {
        let mut cache = self.cache.write().await;
        cache.insert(
            key.to_string(),
            CachedPrice {
                price_usd: price,
                cached_at: chrono::Utc::now(),
            },
        );
    }

    async fn try_fetch_price(&self, symbol: &str, chain: &str) -> Option<f64> {
        if let Some(coingecko_id) = symbol_to_coingecko_id(symbol) {
            match self.coingecko.get_prices(&[coingecko_id]).await {
                Ok(prices) => {
                    if let Some(&price) = prices.get(coingecko_id) {
                        return Some(price);
                    }
                }
                Err(e) => {
                    tracing::warn!(
                        "[PriceHydration] Coingecko fetch failed for {}: {}",
                        symbol,
                        e
                    );
                }
            }
        }
        None
    }

    async fn try_fetch_price_with_address(
        &self,
        symbol: &str,
        chain: &str,
        token_address: &str,
    ) -> Option<f64> {
        if let Some(price) = self.try_fetch_price(symbol, chain).await {
            return Some(price);
        }

        if let Some(ref moralis) = self.moralis {
            if !token_address.is_empty() {
                if chain.to_lowercase() == "solana" {
                    match moralis.get_solana_token_price(token_address).await {
                        Ok(Some(price)) => {
                            tracing::debug!(
                                "[PriceHydration] Moralis Solana price for {}: ${}",
                                symbol,
                                price
                            );
                            return Some(price);
                        }
                        Ok(None) => {}
                        Err(e) => {
                            tracing::debug!(
                                "[PriceHydration] Moralis Solana price error for {}: {}",
                                symbol,
                                e
                            );
                        }
                    }
                } else if let Ok(chain_enum) = chain.parse::<Chain>() {
                    match moralis.get_evm_token_price(chain_enum, token_address).await {
                        Ok(Some(price)) => {
                            tracing::debug!(
                                "[PriceHydration] Moralis EVM price for {}: ${}",
                                symbol,
                                price
                            );
                            return Some(price);
                        }
                        Ok(None) => {}
                        Err(e) => {
                            tracing::debug!(
                                "[PriceHydration] Moralis EVM price error for {}: {}",
                                symbol,
                                e
                            );
                        }
                    }
                }
            }
        }

        None
    }

    fn try_fallback_price(
        &self,
        symbol: &str,
        existing_prices: &HashMap<String, f64>,
    ) -> Option<f64> {
        let symbol_lower = symbol.to_lowercase();

        let base_prefixes = ["ve", "s", "w", "c", "a", "st"];
        for prefix in base_prefixes {
            if symbol_lower.starts_with(prefix) && symbol_lower.len() > prefix.len() {
                let base_symbol = &symbol_lower[prefix.len()..];
                for (key, &price) in existing_prices {
                    if key.starts_with(base_symbol) {
                        tracing::debug!(
                            "[PriceHydration] Fallback: using {} price for {}",
                            base_symbol,
                            symbol
                        );
                        return Some(price);
                    }
                }
            }
        }

        let stablecoin_markers = ["usd", "dai", "usdt", "usdc", "busd", "frax", "lusd", "gusd"];
        if stablecoin_markers.iter().any(|m| symbol_lower.contains(m)) {
            return Some(1.0);
        }

        None
    }
}

impl Default for PriceHydrationService {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Default)]
pub struct HydrationStats {
    pub already_priced: usize,
    pub inferred_from_peers: usize,
    pub from_cache: usize,
    pub fetched_from_api: usize,
    pub fallback_applied: usize,
    pub not_found: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_result(symbol: &str, chain: &str, price: f64, balance: f64) -> AggregationResult {
        AggregationResult {
            account: "test".to_string(),
            chain: chain.to_string(),
            protocol: "test".to_string(),
            position_type: "wallet".to_string(),
            balance,
            balance_raw: "0".to_string(),
            decimals: 18,
            value_usd: balance * price,
            price_usd: price,
            token_symbol: symbol.to_string(),
            token_name: symbol.to_string(),
            token_address: "0x".to_string(),
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
        }
    }

    #[tokio::test]
    async fn test_already_priced_tokens_unchanged() {
        let service = PriceHydrationService::new();
        let mut results = vec![
            create_result("USDC", "ethereum", 1.0, 100.0),
            create_result("ETH", "ethereum", 3000.0, 1.0),
        ];

        let stats = service.hydrate_prices(&mut results).await;

        assert_eq!(stats.already_priced, 2);
        assert_eq!(stats.not_found, 0);
        assert_eq!(results[0].price_usd, 1.0);
        assert_eq!(results[1].price_usd, 3000.0);
    }

    #[tokio::test]
    async fn test_infer_price_from_peer() {
        let service = PriceHydrationService::new();
        let mut results = vec![
            create_result("USDC", "ethereum", 1.0, 100.0),
            create_result("USDC", "ethereum", 0.0, 50.0),
        ];

        let stats = service.hydrate_prices(&mut results).await;

        assert_eq!(stats.already_priced, 1);
        assert_eq!(stats.inferred_from_peers, 1);
        assert_eq!(results[1].price_usd, 1.0);
        assert_eq!(results[1].value_usd, 50.0);
    }

    #[tokio::test]
    async fn test_stablecoin_fallback() {
        let service = PriceHydrationService::new();
        let mut results = vec![create_result("SOME_USD_TOKEN", "ethereum", 0.0, 100.0)];

        let stats = service.hydrate_prices(&mut results).await;

        assert!(stats.fallback_applied > 0 || stats.fetched_from_api > 0 || stats.not_found > 0);
    }

    #[test]
    fn test_fallback_wrapped_token() {
        let service = PriceHydrationService::new();
        let mut existing = HashMap::new();
        existing.insert("eth|ethereum".to_string(), 3000.0);

        let price = service.try_fallback_price("wETH", &existing);
        assert_eq!(price, Some(3000.0));
    }

    #[test]
    fn test_fallback_staked_token() {
        let service = PriceHydrationService::new();
        let mut existing = HashMap::new();
        existing.insert("eth|ethereum".to_string(), 3000.0);

        let price = service.try_fallback_price("stETH", &existing);
        assert_eq!(price, Some(3000.0));
    }

    #[test]
    fn test_fallback_stablecoin() {
        let service = PriceHydrationService::new();
        let existing = HashMap::new();

        let price = service.try_fallback_price("USDC", &existing);
        assert_eq!(price, Some(1.0));
    }
}
