use async_trait::async_trait;
use chrono::{DateTime, Utc};
use defi10_core::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RaydiumPositionState {
    pub nft_mint: String,
    pub wallet_address: String,
    pub token_mint_a: String,
    pub token_mint_b: String,
    pub last_fees_owed_a: u64,
    pub last_fees_owed_b: u64,
    pub accumulated_collected_a: f64,
    pub accumulated_collected_b: f64,
    pub last_scanned_signature: Option<String>,
    pub last_updated_at: DateTime<Utc>,
}

#[async_trait]
pub trait RaydiumPositionStore: Send + Sync {
    async fn get_by_nft_mint(&self, nft_mint: &str) -> Option<RaydiumPositionState>;
    async fn upsert(&self, state: &RaydiumPositionState) -> Result<()>;
}
