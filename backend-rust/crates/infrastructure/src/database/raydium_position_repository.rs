use async_trait::async_trait;
use defi10_core::{DeFi10Error, Result};
use defi10_protocols::raydium::position_store::{RaydiumPositionState, RaydiumPositionStore};
use mongodb::{
    bson::{self, doc, to_document, Document},
    options::ReplaceOptions,
    Collection, Database,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct PositionStateDoc {
    nft_mint: String,
    wallet_address: String,
    token_mint_a: String,
    token_mint_b: String,
    last_fees_owed_a: i64,
    last_fees_owed_b: i64,
    accumulated_collected_a: f64,
    accumulated_collected_b: f64,
    last_scanned_signature: Option<String>,
    last_updated_at: bson::DateTime,
}

impl From<&RaydiumPositionState> for PositionStateDoc {
    fn from(s: &RaydiumPositionState) -> Self {
        Self {
            nft_mint: s.nft_mint.clone(),
            wallet_address: s.wallet_address.clone(),
            token_mint_a: s.token_mint_a.clone(),
            token_mint_b: s.token_mint_b.clone(),
            last_fees_owed_a: s.last_fees_owed_a as i64,
            last_fees_owed_b: s.last_fees_owed_b as i64,
            accumulated_collected_a: s.accumulated_collected_a,
            accumulated_collected_b: s.accumulated_collected_b,
            last_scanned_signature: s.last_scanned_signature.clone(),
            last_updated_at: bson::DateTime::from_millis(s.last_updated_at.timestamp_millis()),
        }
    }
}

impl From<PositionStateDoc> for RaydiumPositionState {
    fn from(d: PositionStateDoc) -> Self {
        Self {
            nft_mint: d.nft_mint,
            wallet_address: d.wallet_address,
            token_mint_a: d.token_mint_a,
            token_mint_b: d.token_mint_b,
            last_fees_owed_a: d.last_fees_owed_a as u64,
            last_fees_owed_b: d.last_fees_owed_b as u64,
            accumulated_collected_a: d.accumulated_collected_a,
            accumulated_collected_b: d.accumulated_collected_b,
            last_scanned_signature: d.last_scanned_signature,
            last_updated_at: chrono::DateTime::from_timestamp_millis(
                d.last_updated_at.timestamp_millis(),
            )
            .unwrap_or_default(),
        }
    }
}

pub struct RaydiumPositionRepository {
    collection: Collection<Document>,
}

impl RaydiumPositionRepository {
    pub fn new(db: &Database) -> Self {
        Self {
            collection: db.collection("raydium_position_states"),
        }
    }
}

#[async_trait]
impl RaydiumPositionStore for RaydiumPositionRepository {
    async fn get_by_nft_mint(&self, nft_mint: &str) -> Option<RaydiumPositionState> {
        let filter = doc! { "nft_mint": nft_mint };
        match self.collection.find_one(filter).await {
            Ok(Some(doc)) => {
                let state_doc: PositionStateDoc = mongodb::bson::from_document(doc).ok()?;
                Some(RaydiumPositionState::from(state_doc))
            }
            _ => None,
        }
    }

    async fn upsert(&self, state: &RaydiumPositionState) -> Result<()> {
        let doc_struct = PositionStateDoc::from(state);
        let doc = to_document(&doc_struct).map_err(|e| {
            DeFi10Error::Database(format!("Failed to serialize position state: {}", e))
        })?;

        let filter = doc! { "nft_mint": &state.nft_mint };
        let opts = ReplaceOptions::builder().upsert(true).build();

        self.collection
            .replace_one(filter, doc)
            .with_options(opts)
            .await
            .map_err(|e| {
                DeFi10Error::Database(format!("Failed to upsert position state: {}", e))
            })?;

        Ok(())
    }
}
