use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

use crate::cache::{CacheService, RedisCache};
use crate::database::{MongoDatabase, TokenMetadataRepository};

const TOKEN_LOGO_PREFIX: &str = "token_logo";
const DEFAULT_EXPIRATION_SECONDS: u64 = 604800; // 7 days

pub struct TokenLogoService {
    cache: Arc<RedisCache>,
    memory_cache: Arc<RwLock<HashMap<String, String>>>,
    expiration: Duration,
    initialized: Arc<RwLock<bool>>,
    mongo_repo: Option<Arc<TokenMetadataRepository>>,
}

impl TokenLogoService {
    pub fn new(cache: Arc<RedisCache>) -> Self {
        Self {
            cache,
            memory_cache: Arc::new(RwLock::new(HashMap::new())),
            expiration: Duration::from_secs(DEFAULT_EXPIRATION_SECONDS),
            initialized: Arc::new(RwLock::new(false)),
            mongo_repo: None,
        }
    }

    pub fn with_mongo(mut self, mongo_db: Arc<MongoDatabase>) -> Self {
        self.mongo_repo = Some(Arc::new(TokenMetadataRepository::new(mongo_db)));
        self
    }

    pub fn with_expiration(mut self, seconds: u64) -> Self {
        self.expiration = Duration::from_secs(seconds);
        self
    }

    pub async fn get_token_logo(&self, token_address: &str) -> Result<Option<String>> {
        self.ensure_initialized().await?;

        let normalized = Self::normalize_address(token_address);

        {
            let mem = self.memory_cache.read().await;
            if let Some(logo_url) = mem.get(&normalized) {
                return Ok(Some(logo_url.clone()));
            }
        }

        if let Ok(Some(logo_url)) = self.cache.get::<String>(TOKEN_LOGO_PREFIX, &normalized).await {
            let mut mem = self.memory_cache.write().await;
            mem.insert(normalized, logo_url.clone());
            return Ok(Some(logo_url));
        }

        if let Some(repo) = &self.mongo_repo {
            if let Ok(Some(logo_url)) = repo.get_logo(&normalized).await {
                let _ = self.cache
                    .set(TOKEN_LOGO_PREFIX, &normalized, &logo_url, Some(self.expiration))
                    .await;
                let mut mem = self.memory_cache.write().await;
                mem.insert(normalized, logo_url.clone());
                return Ok(Some(logo_url));
            }
        }

        Ok(None)
    }

    pub async fn set_token_logo(&self, token_address: &str, logo_url: &str) -> Result<()> {
        let normalized = Self::normalize_address(token_address);

        self.cache
            .set(TOKEN_LOGO_PREFIX, &normalized, &logo_url.to_string(), Some(self.expiration))
            .await
            .map_err(|e| anyhow::anyhow!("Failed to set token logo in Redis: {}", e))?;

        if let Some(repo) = &self.mongo_repo {
            let _ = repo.set_logo(&normalized, logo_url).await;
        }

        let mut mem = self.memory_cache.write().await;
        mem.insert(normalized, logo_url.to_string());

        Ok(())
    }

    pub async fn get_all_token_logos(&self) -> Result<HashMap<String, String>> {
        self.ensure_initialized().await?;
        let mem = self.memory_cache.read().await;
        Ok(mem.clone())
    }

    pub async fn get_token_logos_batch(
        &self,
        token_addresses: &[String],
    ) -> Result<HashMap<String, String>> {
        self.ensure_initialized().await?;

        let mut result = HashMap::new();
        let mut missing: Vec<(String, String)> = Vec::new();

        {
            let mem = self.memory_cache.read().await;
            for addr in token_addresses {
                let normalized = Self::normalize_address(addr);
                if let Some(logo_url) = mem.get(&normalized) {
                    result.insert(addr.clone(), logo_url.clone());
                } else {
                    missing.push((addr.clone(), normalized));
                }
            }
        }

        if missing.is_empty() {
            return Ok(result);
        }

        let mut still_missing: Vec<(String, String)> = Vec::new();
        {
            let mut mem = self.memory_cache.write().await;
            for (original, normalized) in &missing {
                if let Ok(Some(logo_url)) = self.cache.get::<String>(TOKEN_LOGO_PREFIX, normalized).await
                {
                    result.insert(original.clone(), logo_url.clone());
                    mem.insert(normalized.clone(), logo_url);
                } else {
                    still_missing.push((original.clone(), normalized.clone()));
                }
            }
        }

        if !still_missing.is_empty() {
            if let Some(repo) = &self.mongo_repo {
                let normalized_addrs: Vec<String> =
                    still_missing.iter().map(|(_, n)| n.clone()).collect();

                if let Ok(mongo_logos) = repo.get_logos_batch(&normalized_addrs).await {
                    let mut mem = self.memory_cache.write().await;
                    for (addr, logo_url) in mongo_logos {
                        let original = still_missing
                            .iter()
                            .find(|(_, n)| *n == addr)
                            .map(|(o, _)| o.clone())
                            .unwrap_or(addr.clone());

                        result.insert(original, logo_url.clone());
                        let _ = self.cache
                            .set(TOKEN_LOGO_PREFIX, &addr, &logo_url, Some(self.expiration))
                            .await;
                        mem.insert(addr, logo_url);
                    }
                }
            }
        }

        Ok(result)
    }

    pub async fn set_token_logos_batch(&self, token_logos: HashMap<String, String>) -> Result<()> {
        {
            let mut mem = self.memory_cache.write().await;
            for (addr, logo_url) in &token_logos {
                let normalized = Self::normalize_address(addr);
                let _ = self.cache
                    .set(TOKEN_LOGO_PREFIX, &normalized, logo_url, Some(self.expiration))
                    .await;
                mem.insert(normalized, logo_url.clone());
            }
        }

        if let Some(repo) = &self.mongo_repo {
            for (addr, logo_url) in &token_logos {
                let normalized = Self::normalize_address(addr);
                let _ = repo.set_logo(&normalized, logo_url).await;
            }
        }

        Ok(())
    }

    async fn ensure_initialized(&self) -> Result<()> {
        {
            let initialized = self.initialized.read().await;
            if *initialized {
                return Ok(());
            }
        }

        let mut initialized = self.initialized.write().await;
        if *initialized {
            return Ok(());
        }

        tracing::info!("TokenLogoService: Loading tokens into memory cache...");

        if let Some(repo) = &self.mongo_repo {
            match repo.get_all_with_logos().await {
                Ok(mongo_logos) => {
                    let mut mem = self.memory_cache.write().await;
                    for (address, logo_url) in &mongo_logos {
                        let normalized = Self::normalize_address(address);
                        mem.insert(normalized.clone(), logo_url.clone());
                        let _ = self.cache
                            .set(TOKEN_LOGO_PREFIX, &normalized, logo_url, Some(self.expiration))
                            .await;
                    }
                    tracing::info!(
                        "TokenLogoService: Loaded {} token logos from MongoDB",
                        mongo_logos.len()
                    );
                }
                Err(e) => {
                    tracing::warn!("TokenLogoService: Failed to load from MongoDB: {}", e);
                }
            }
        }

        tracing::info!(
            "TokenLogoService: Total {} token logos in memory cache",
            self.memory_cache.read().await.len()
        );
        *initialized = true;

        Ok(())
    }

    fn normalize_address(address: &str) -> String {
        address.trim().to_lowercase()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_address() {
        assert_eq!(TokenLogoService::normalize_address("0xABC123"), "0xabc123");
        assert_eq!(
            TokenLogoService::normalize_address("  0xDEF456  "),
            "0xdef456"
        );
    }
}
