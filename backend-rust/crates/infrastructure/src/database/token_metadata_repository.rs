use super::mongo::MongoDatabase;
use defi10_core::{DeFi10Error, Result};
use mongodb::{
    bson::{doc, DateTime},
    options::UpdateOptions,
    Collection,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenMetadataDocument {
    #[serde(rename = "_id")]
    pub id: String,
    pub chain: String,
    pub address: String,
    pub symbol: Option<String>,
    pub name: Option<String>,
    pub decimals: Option<u8>,
    pub logo_url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub price_usd: Option<f64>,
    pub updated_at: DateTime,
}

impl TokenMetadataDocument {
    pub fn new(chain: &str, address: &str) -> Self {
        let id = format!("{}:{}", chain.to_lowercase(), address.to_lowercase());
        Self {
            id,
            chain: chain.to_lowercase(),
            address: address.to_lowercase(),
            symbol: None,
            name: None,
            decimals: None,
            logo_url: None,
            thumbnail_url: None,
            price_usd: None,
            updated_at: DateTime::now(),
        }
    }

    pub fn with_logo(mut self, logo_url: String) -> Self {
        self.logo_url = Some(logo_url.clone());
        self.thumbnail_url = Some(logo_url);
        self
    }

    pub fn with_metadata(mut self, symbol: String, name: String, decimals: u8) -> Self {
        self.symbol = Some(symbol);
        self.name = Some(name);
        self.decimals = Some(decimals);
        self
    }
}

pub struct TokenMetadataRepository {
    collection: Collection<TokenMetadataDocument>,
}

impl TokenMetadataRepository {
    pub fn new(db: Arc<MongoDatabase>) -> Self {
        Self {
            collection: db.collection("token_metadata"),
        }
    }

    pub async fn get_by_address(
        &self,
        chain: &str,
        address: &str,
    ) -> Result<Option<TokenMetadataDocument>> {
        let id = format!("{}:{}", chain.to_lowercase(), address.to_lowercase());
        self.collection
            .find_one(doc! { "_id": &id })
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to find token metadata: {}", e)))
    }

    pub async fn get_logo(&self, address: &str) -> Result<Option<String>> {
        let normalized = address.to_lowercase();
        let doc = self
            .collection
            .find_one(doc! { "address": &normalized })
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to find token logo: {}", e)))?;
        Ok(doc.and_then(|d| d.logo_url))
    }

    pub async fn get_logo_with_chain(&self, chain: &str, address: &str) -> Result<Option<String>> {
        let doc = self.get_by_address(chain, address).await?;
        Ok(doc.and_then(|d| d.logo_url))
    }

    pub async fn upsert(&self, doc: &TokenMetadataDocument) -> Result<()> {
        let options = UpdateOptions::builder().upsert(true).build();

        self.collection
            .update_one(
                doc! { "_id": &doc.id },
                doc! {
                    "$set": {
                        "chain": &doc.chain,
                        "address": &doc.address,
                        "symbol": &doc.symbol,
                        "name": &doc.name,
                        "decimals": doc.decimals.map(|d| d as i32),
                        "logoUrl": &doc.logo_url,
                        "thumbnailUrl": &doc.thumbnail_url,
                        "priceUsd": doc.price_usd,
                        "updatedAt": doc.updated_at,
                    }
                },
            )
            .with_options(options)
            .await
            .map_err(|e| {
                DeFi10Error::Database(format!("Failed to upsert token metadata: {}", e))
            })?;

        Ok(())
    }

    pub async fn set_logo(&self, address: &str, logo_url: &str) -> Result<()> {
        let normalized = address.to_lowercase();
        let id = format!("unknown:{}", normalized);
        let options = UpdateOptions::builder().upsert(true).build();

        self.collection
            .update_one(
                doc! { "_id": &id },
                doc! {
                    "$set": {
                        "chain": "unknown",
                        "address": &normalized,
                        "logoUrl": logo_url,
                        "thumbnailUrl": logo_url,
                        "updatedAt": DateTime::now(),
                    }
                },
            )
            .with_options(options)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to set token logo: {}", e)))?;

        Ok(())
    }

    pub async fn set_logo_with_chain(
        &self,
        chain: &str,
        address: &str,
        logo_url: &str,
    ) -> Result<()> {
        let id = format!("{}:{}", chain.to_lowercase(), address.to_lowercase());
        let options = UpdateOptions::builder().upsert(true).build();

        self.collection
            .update_one(
                doc! { "_id": &id },
                doc! {
                    "$set": {
                        "chain": chain.to_lowercase(),
                        "address": address.to_lowercase(),
                        "logoUrl": logo_url,
                        "thumbnailUrl": logo_url,
                        "updatedAt": DateTime::now(),
                    }
                },
            )
            .with_options(options)
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to set token logo: {}", e)))?;

        Ok(())
    }

    pub async fn get_logos_batch(
        &self,
        addresses: &[String],
    ) -> Result<std::collections::HashMap<String, String>> {
        use futures_util::stream::TryStreamExt;

        let normalized: Vec<String> = addresses.iter().map(|a| a.to_lowercase()).collect();

        let cursor = self
            .collection
            .find(doc! { "address": { "$in": &normalized } })
            .await
            .map_err(|e| {
                DeFi10Error::Database(format!("Failed to batch query token logos: {}", e))
            })?;

        let docs: Vec<TokenMetadataDocument> = cursor
            .try_collect()
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to collect token logos: {}", e)))?;

        let mut result = std::collections::HashMap::new();
        for doc in docs {
            if let Some(logo) = doc.logo_url {
                result.insert(doc.address, logo);
            }
        }

        Ok(result)
    }

    pub async fn get_logos_batch_with_chain(
        &self,
        chain: &str,
        addresses: &[String],
    ) -> Result<std::collections::HashMap<String, String>> {
        use futures_util::stream::TryStreamExt;

        let ids: Vec<String> = addresses
            .iter()
            .map(|a| format!("{}:{}", chain.to_lowercase(), a.to_lowercase()))
            .collect();

        let cursor = self
            .collection
            .find(doc! { "_id": { "$in": &ids } })
            .await
            .map_err(|e| {
                DeFi10Error::Database(format!("Failed to batch query token logos: {}", e))
            })?;

        let docs: Vec<TokenMetadataDocument> = cursor
            .try_collect()
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to collect token logos: {}", e)))?;

        let mut result = std::collections::HashMap::new();
        for doc in docs {
            if let Some(logo) = doc.logo_url {
                result.insert(doc.address, logo);
            }
        }

        Ok(result)
    }

    pub async fn get_all_with_logos(&self) -> Result<std::collections::HashMap<String, String>> {
        use futures_util::stream::TryStreamExt;

        let cursor = self
            .collection
            .find(doc! { "logoUrl": { "$ne": null } })
            .await
            .map_err(|e| {
                DeFi10Error::Database(format!("Failed to query all token logos: {}", e))
            })?;

        let docs: Vec<TokenMetadataDocument> = cursor
            .try_collect()
            .await
            .map_err(|e| DeFi10Error::Database(format!("Failed to collect token logos: {}", e)))?;

        let mut result = std::collections::HashMap::new();
        for doc in docs {
            if let Some(logo) = doc.logo_url {
                result.insert(doc.address, logo);
            }
        }

        tracing::info!(
            "TokenMetadataRepository: Loaded {} token logos from MongoDB",
            result.len()
        );
        Ok(result)
    }
}
