use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoingeckoPriceResponse {
    #[serde(flatten)]
    pub prices: HashMap<String, CoinPrice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinPrice {
    pub usd: Option<f64>,
    pub usd_24h_change: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub id: String,
    pub symbol: String,
    pub name: String,
}

#[derive(Debug, Clone)]
pub struct PriceEntry {
    pub price_usd: f64,
    pub fetched_at: chrono::DateTime<chrono::Utc>,
}

impl PriceEntry {
    pub fn is_stale(&self, max_age_hours: i64) -> bool {
        let age = chrono::Utc::now() - self.fetched_at;
        age.num_hours() >= max_age_hours
    }
}
