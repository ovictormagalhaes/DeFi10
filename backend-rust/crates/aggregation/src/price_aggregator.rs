use defi10_core::{http_helpers::check_and_parse, Chain, DeFi10Error, Result};
use defi10_infrastructure::cache::{CacheService, RedisCache};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPrice {
    pub symbol: String,
    pub price_usd: f64,
    pub chain: Chain,
    pub last_updated: chrono::DateTime<chrono::Utc>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregatedPrice {
    pub symbol: String,
    pub average_price_usd: f64,
    pub prices: Vec<TokenPrice>,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

pub struct PriceAggregator {
    client: Arc<Client>,
    cache: Arc<RedisCache>,
    coinmarketcap_api_key: String,
    cache_ttl_seconds: u64,
}

impl PriceAggregator {
    pub fn new(
        cache: Arc<RedisCache>,
        coinmarketcap_api_key: String,
        cache_ttl_seconds: u64,
    ) -> Self {
        Self {
            client: Arc::new(Client::new()),
            cache,
            coinmarketcap_api_key,
            cache_ttl_seconds,
        }
    }

    pub fn with_client(
        client: Arc<Client>,
        cache: Arc<RedisCache>,
        coinmarketcap_api_key: String,
        cache_ttl_seconds: u64,
    ) -> Self {
        Self {
            client,
            cache,
            coinmarketcap_api_key,
            cache_ttl_seconds,
        }
    }

    /// Get price from CoinMarketCap API
    pub async fn fetch_coinmarketcap_price(&self, symbol: &str) -> Result<TokenPrice> {
        let url = format!(
            "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol={}",
            symbol
        );

        let response = self
            .client
            .get(&url)
            .header("X-CMC_PRO_API_KEY", &self.coinmarketcap_api_key)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(e.to_string()))?;

        #[derive(Deserialize)]
        struct CmcResponse {
            data: HashMap<String, CmcToken>,
        }

        #[derive(Deserialize)]
        struct CmcToken {
            symbol: String,
            quote: HashMap<String, CmcQuote>,
        }

        #[derive(Deserialize)]
        struct CmcQuote {
            price: f64,
            #[allow(dead_code)]
            last_updated: String,
        }

        let data: CmcResponse = check_and_parse(response, "CoinMarketCap API").await?;

        let token = data
            .data
            .get(symbol)
            .ok_or_else(|| DeFi10Error::NotFound(format!("Token {} not found", symbol)))?;

        let usd_quote = token
            .quote
            .get("USD")
            .ok_or_else(|| DeFi10Error::NotFound("USD quote not found".to_string()))?;

        Ok(TokenPrice {
            symbol: token.symbol.clone(),
            price_usd: usd_quote.price,
            chain: Chain::Ethereum, // Default
            last_updated: chrono::Utc::now(),
            source: "CoinMarketCap".to_string(),
        })
    }

    /// Get aggregated price from multiple sources with caching
    pub async fn get_aggregated_price(&self, symbol: &str) -> Result<AggregatedPrice> {
        let cache_key = format!("price:{}", symbol);
        if let Ok(Some(cached)) = self
            .cache
            .get::<AggregatedPrice>("prices", &cache_key)
            .await
        {
            info!("Price for {} retrieved from cache", symbol);
            return Ok(cached);
        }

        let mut prices = Vec::new();
        match self.fetch_coinmarketcap_price(symbol).await {
            Ok(price) => prices.push(price),
            Err(e) => {
                warn!("Failed to fetch price from CoinMarketCap: {}", e);
            }
        }

        if prices.is_empty() {
            return Err(DeFi10Error::NotFound(format!(
                "No price data available for {}",
                symbol
            )));
        }

        let average_price = prices.iter().map(|p| p.price_usd).sum::<f64>() / prices.len() as f64;

        let aggregated = AggregatedPrice {
            symbol: symbol.to_string(),
            average_price_usd: average_price,
            prices,
            last_updated: chrono::Utc::now(),
        };

        match serde_json::to_string(&aggregated) {
            Ok(serialized) => {
                if let Err(e) = self
                    .cache
                    .set(
                        "prices",
                        &cache_key,
                        &serialized,
                        Some(std::time::Duration::from_secs(self.cache_ttl_seconds)),
                    )
                    .await
                {
                    error!("Failed to cache price: {}", e);
                }
            }
            Err(e) => {
                error!("Failed to serialize price for caching: {}", e);
            }
        }

        info!("Price for {} aggregated successfully", symbol);
        Ok(aggregated)
    }

    /// Batch fetch prices for multiple symbols
    pub async fn get_batch_prices(&self, symbols: Vec<String>) -> Result<Vec<AggregatedPrice>> {
        let mut results = Vec::new();

        for symbol in symbols {
            match self.get_aggregated_price(&symbol).await {
                Ok(price) => results.push(price),
                Err(e) => {
                    error!("Failed to get price for {}: {}", symbol, e);
                }
            }
        }

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_token_price_creation() {
        let price = TokenPrice {
            symbol: "BTC".to_string(),
            price_usd: 50000.0,
            chain: Chain::Ethereum,
            last_updated: chrono::Utc::now(),
            source: "Test".to_string(),
        };

        assert_eq!(price.symbol, "BTC");
        assert_eq!(price.price_usd, 50000.0);
    }

    #[tokio::test]
    async fn test_aggregated_price_average() {
        let prices = vec![
            TokenPrice {
                symbol: "ETH".to_string(),
                price_usd: 3000.0,
                chain: Chain::Ethereum,
                last_updated: chrono::Utc::now(),
                source: "Source1".to_string(),
            },
            TokenPrice {
                symbol: "ETH".to_string(),
                price_usd: 3100.0,
                chain: Chain::Ethereum,
                last_updated: chrono::Utc::now(),
                source: "Source2".to_string(),
            },
        ];

        let average = prices.iter().map(|p| p.price_usd).sum::<f64>() / prices.len() as f64;
        assert_eq!(average, 3050.0);
    }
}
