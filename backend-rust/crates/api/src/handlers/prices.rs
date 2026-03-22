use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use defi10_aggregation::PriceAggregator;
use defi10_infrastructure::cache::RedisCache;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};

use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct PriceResponse {
    pub symbol: String,
    pub price_usd: f64,
    pub sources: Vec<String>,
    pub last_updated: String,
}

#[derive(Debug, Deserialize)]
pub struct BatchPricesQuery {
    pub symbols: String, // Comma-separated list
}

#[derive(Debug, Serialize)]
pub struct BatchPricesResponse {
    pub prices: Vec<PriceResponse>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// GET /api/v1/prices/:symbol
/// Returns aggregated price for a token symbol
pub async fn get_price(
    Path(symbol): Path<String>,
    State(_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    info!("Fetching price for symbol: {}", symbol);

    // Create price aggregator with cache
    let cache = Arc::new(RwLock::new(
        RedisCache::new("redis://localhost:6379", 300)
            .await
            .map_err(|e| {
                error!("Failed to connect to Redis: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: "Cache unavailable".to_string(),
                    }),
                )
            })?,
    ));

    // Get CoinMarketCap API key from environment
    let api_key = std::env::var("COINMARKETCAP_API_KEY")
        .or_else(|_| std::env::var("CoinMarketCap__ApiKey"))
        .unwrap_or_else(|_| {
            tracing::warn!("CoinMarketCap API key not found in environment");
            String::new()
        });

    let aggregator = PriceAggregator::new(
        cache, api_key, 300, // 5 minutes TTL
    );

    let aggregated: defi10_aggregation::AggregatedPrice = aggregator
        .get_aggregated_price(&symbol)
        .await
        .map_err(|e| {
            error!("Failed to fetch price: {}", e);
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Price not found for symbol: {}", symbol),
                }),
            )
        })?;

    let response = PriceResponse {
        symbol: aggregated.symbol,
        price_usd: aggregated.average_price_usd,
        sources: aggregated.prices.iter().map(|p| p.source.clone()).collect(),
        last_updated: aggregated.last_updated.to_rfc3339(),
    };

    info!("Successfully fetched price for symbol: {}", symbol);
    Ok((StatusCode::OK, Json(response)))
}

/// GET /api/v1/prices/batch?symbols=BTC,ETH,SOL
/// Returns prices for multiple tokens
pub async fn get_batch_prices(
    Query(params): Query<BatchPricesQuery>,
    State(_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let symbols: Vec<&str> = params.symbols.split(',').collect();
    info!("Fetching batch prices for {} symbols", symbols.len());

    if symbols.is_empty() || symbols.len() > 50 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Invalid number of symbols (must be 1-50)".to_string(),
            }),
        ));
    }

    // Create price aggregator
    let cache = Arc::new(RwLock::new(
        RedisCache::new("redis://localhost:6379", 300)
            .await
            .map_err(|e| {
                error!("Failed to connect to Redis: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: "Cache unavailable".to_string(),
                    }),
                )
            })?,
    ));

    let aggregator = PriceAggregator::new(
        cache,
        std::env::var("COINMARKETCAP_API_KEY").unwrap_or_default(),
        300,
    );

    // Fetch prices in parallel
    let mut prices = Vec::new();
    for symbol in symbols {
        match aggregator.get_aggregated_price(symbol).await {
            Ok(aggregated) => {
                prices.push(PriceResponse {
                    symbol: aggregated.symbol,
                    price_usd: aggregated.average_price_usd,
                    sources: aggregated.prices.iter().map(|p| p.source.clone()).collect(),
                    last_updated: aggregated.last_updated.to_rfc3339(),
                });
            }
            Err(e) => {
                error!("Failed to fetch price for {}: {}", symbol, e);
                // Continue with other symbols
            }
        }
    }

    info!("Successfully fetched {} prices", prices.len());
    Ok((StatusCode::OK, Json(BatchPricesResponse { prices })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_price_response_serialization() {
        let response = PriceResponse {
            symbol: "BTC".to_string(),
            price_usd: 50000.0,
            sources: vec!["CoinMarketCap".to_string()],
            last_updated: chrono::Utc::now().to_rfc3339(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("symbol"));
        assert!(json.contains("price_usd"));
    }

    #[test]
    fn test_batch_prices_response_serialization() {
        let response = BatchPricesResponse {
            prices: vec![PriceResponse {
                symbol: "ETH".to_string(),
                price_usd: 3000.0,
                sources: vec!["CoinMarketCap".to_string()],
                last_updated: chrono::Utc::now().to_rfc3339(),
            }],
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("prices"));
    }
}
