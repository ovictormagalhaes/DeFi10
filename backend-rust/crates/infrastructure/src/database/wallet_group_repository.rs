use async_trait::async_trait;
use chrono::{DateTime, Utc};
use defi10_core::{DeFi10Error, Result, WalletGroup};
use mongodb::{
    bson::{doc, to_document, Document},
    Collection, Database,
};
use uuid::Uuid;

#[async_trait]
pub trait WalletGroupRepositoryTrait: Send + Sync {
    async fn create(&self, group: &WalletGroup) -> Result<()>;
    async fn get(&self, id: &Uuid) -> Result<Option<WalletGroup>>;
    async fn list(&self, user_id: Option<&str>) -> Result<Vec<WalletGroup>>;
    async fn update(&self, group: &WalletGroup) -> Result<bool>;
    async fn delete(&self, id: &Uuid) -> Result<bool>;
    async fn update_last_synced_at(&self, id: &Uuid, at: DateTime<Utc>) -> Result<()>;
    async fn backfill_last_synced_at(&self) -> Result<u32>;
}

pub struct WalletGroupRepository {
    collection: Collection<Document>,
}

impl WalletGroupRepository {
    pub fn new(db: &Database) -> Self {
        Self {
            collection: db.collection("wallet_groups"),
        }
    }
}

#[async_trait]
impl WalletGroupRepositoryTrait for WalletGroupRepository {
    /// Create a new wallet group
    async fn create(&self, group: &WalletGroup) -> Result<()> {
        let doc = to_document(group).map_err(|e| {
            DeFi10Error::Database(format!("Failed to serialize wallet group: {}", e))
        })?;

        self.collection
            .insert_one(doc)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to insert wallet group: {}", e)))?;

        Ok(())
    }

    /// Get a wallet group by ID
    async fn get(&self, id: &Uuid) -> Result<Option<WalletGroup>> {
        let filter = doc! {
            "_id": id.to_string(),
            "isDeleted": false
        };

        tracing::debug!("Querying wallet_groups with filter: {:?}", filter);

        let doc =
            self.collection.find_one(filter).await.map_err(|e| {
                DeFi10Error::Database(format!("Failed to find wallet group: {}", e))
            })?;

        match doc {
            Some(d) => {
                let group: WalletGroup = mongodb::bson::from_document(d).map_err(|e| {
                    DeFi10Error::Database(format!("Failed to deserialize wallet group: {}", e))
                })?;
                Ok(Some(group))
            }
            None => Ok(None),
        }
    }

    /// List all wallet groups (optionally filtered by user_id)
    async fn list(&self, user_id: Option<&str>) -> Result<Vec<WalletGroup>> {
        let filter = if let Some(uid) = user_id {
            doc! {
                "userId": uid,
                "isDeleted": false
            }
        } else {
            doc! { "isDeleted": false }
        };

        let mut cursor =
            self.collection.find(filter).await.map_err(|e| {
                DeFi10Error::Database(format!("Failed to list wallet groups: {}", e))
            })?;

        let mut groups = Vec::new();
        while cursor
            .advance()
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to iterate cursor: {}", e)))?
        {
            let doc = cursor.current();
            // Deserialize from raw bytes
            let group: WalletGroup = mongodb::bson::from_slice(doc.as_bytes()).map_err(|e| {
                DeFi10Error::Database(format!("Failed to deserialize wallet group: {}", e))
            })?;
            groups.push(group);
        }

        Ok(groups)
    }

    /// Update a wallet group
    async fn update(&self, group: &WalletGroup) -> Result<bool> {
        let filter = doc! {
            "_id": group.id.to_string(),
            "isDeleted": false
        };
        let update = doc! {
            "$set": {
                "displayName": &group.display_name,
                "wallets": &group.wallets,
                "updatedAt": group.updated_at.to_rfc3339(),
            }
        };

        let result = self
            .collection
            .update_one(filter, update)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to update wallet group: {}", e)))?;

        Ok(result.modified_count > 0)
    }

    async fn update_last_synced_at(&self, id: &Uuid, at: DateTime<Utc>) -> Result<()> {
        let filter = doc! { "_id": id.to_string(), "isDeleted": false };
        let update = doc! { "$set": { "lastSyncedAt": at.to_rfc3339() } };
        self.collection
            .update_one(filter, update)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to update lastSyncedAt: {}", e)))?;
        Ok(())
    }

    async fn backfill_last_synced_at(&self) -> Result<u32> {
        use mongodb::bson::from_slice;

        let filter = doc! {
            "isDeleted": false,
            "lastSyncedAt": { "$exists": false },
        };

        let mut cursor = self.collection.find(filter).await.map_err(|e| {
            DeFi10Error::Database(format!("Failed to list groups for backfill: {}", e))
        })?;

        let mut count = 0u32;
        while cursor.advance().await.map_err(|e| {
            DeFi10Error::Database(format!("Failed to iterate backfill cursor: {}", e))
        })? {
            let raw = cursor.current();
            if let Ok(group) = from_slice::<WalletGroup>(raw.as_bytes()) {
                let update_filter = doc! { "_id": group.id.to_string() };
                let update = doc! { "$set": { "lastSyncedAt": group.updated_at.to_rfc3339() } };
                if let Err(e) = self.collection.update_one(update_filter, update).await {
                    tracing::warn!("Backfill: failed to update group {}: {}", group.id, e);
                } else {
                    count += 1;
                }
            }
        }

        Ok(count)
    }

    /// Delete a wallet group (soft delete)
    async fn delete(&self, id: &Uuid) -> Result<bool> {
        let filter = doc! {
            "_id": id.to_string(),
            "isDeleted": false
        };

        let update = doc! {
            "$set": {
                "isDeleted": true,
                "updatedAt": chrono::Utc::now().to_rfc3339()
            }
        };

        let result = self
            .collection
            .update_one(filter, update)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to delete wallet group: {}", e)))?;

        Ok(result.modified_count > 0)
    }
}

#[cfg(test)]
mod tests {
    // Note: Integration tests would require a real MongoDB instance
}
