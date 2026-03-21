use anyhow::Result;
use redis::Commands;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::database::{MongoDatabase, TokenMetadataRepository};

const TOKEN_LOGO_KEY_PREFIX: &str = "token_logo:";
const DEFAULT_EXPIRATION_SECONDS: u64 = 604800; // 7 days

pub struct TokenLogoService {
    redis: redis::Client,
    memory_cache: Arc<RwLock<HashMap<String, String>>>,
    expiration_seconds: u64,
    initialized: Arc<RwLock<bool>>,
    mongo_repo: Option<Arc<TokenMetadataRepository>>,
}

impl TokenLogoService {
    pub fn new(redis_url: &str) -> Result<Self> {
        let redis = redis::Client::open(redis_url)?;

        Ok(Self {
            redis,
            memory_cache: Arc::new(RwLock::new(HashMap::new())),
            expiration_seconds: DEFAULT_EXPIRATION_SECONDS,
            initialized: Arc::new(RwLock::new(false)),
            mongo_repo: None,
        })
    }

    pub fn with_mongo(mut self, mongo_db: Arc<MongoDatabase>) -> Self {
        self.mongo_repo = Some(Arc::new(TokenMetadataRepository::new(mongo_db)));
        self
    }

    pub fn with_expiration(mut self, seconds: u64) -> Self {
        self.expiration_seconds = seconds;
        self
    }

    pub async fn get_token_logo(&self, token_address: &str) -> Result<Option<String>> {
        self.ensure_initialized().await?;

        let normalized_address = Self::normalize_address(token_address);

        {
            let cache = self.memory_cache.read().await;
            if let Some(logo_url) = cache.get(&normalized_address) {
                return Ok(Some(logo_url.clone()));
            }
        }

        let mut conn = self.redis.get_connection()?;
        let redis_key = Self::generate_redis_key(token_address);
        let redis_value: Option<String> = conn.get(&redis_key)?;

        if let Some(logo_url) = redis_value {
            let mut cache = self.memory_cache.write().await;
            cache.insert(normalized_address, logo_url.clone());
            return Ok(Some(logo_url));
        }

        if let Some(repo) = &self.mongo_repo {
            if let Ok(Some(logo_url)) = repo.get_logo(&normalized_address).await {
                let _: Result<(), _> = conn.set_ex(&redis_key, &logo_url, self.expiration_seconds);
                let mut cache = self.memory_cache.write().await;
                cache.insert(normalized_address, logo_url.clone());
                return Ok(Some(logo_url));
            }
        }

        Ok(None)
    }

    pub async fn set_token_logo(&self, token_address: &str, logo_url: &str) -> Result<()> {
        let normalized_address = Self::normalize_address(token_address);

        let mut conn = self.redis.get_connection()?;
        let redis_key = Self::generate_redis_key(token_address);
        let _: () = conn.set_ex(&redis_key, logo_url, self.expiration_seconds)?;

        if let Some(repo) = &self.mongo_repo {
            let _ = repo.set_logo(&normalized_address, logo_url).await;
        }

        let mut cache = self.memory_cache.write().await;
        cache.insert(normalized_address, logo_url.to_string());

        Ok(())
    }

    pub async fn get_all_token_logos(&self) -> Result<HashMap<String, String>> {
        self.ensure_initialized().await?;

        let cache = self.memory_cache.read().await;
        Ok(cache.clone())
    }

    pub async fn get_token_logos_batch(
        &self,
        token_addresses: &[String],
    ) -> Result<HashMap<String, String>> {
        self.ensure_initialized().await?;

        let mut result = HashMap::new();
        let mut missing_from_cache: Vec<String> = Vec::new();
        let mut conn = self.redis.get_connection()?;

        for token_address in token_addresses {
            let normalized = Self::normalize_address(token_address);

            {
                let cache = self.memory_cache.read().await;
                if let Some(logo_url) = cache.get(&normalized) {
                    result.insert(token_address.clone(), logo_url.clone());
                    continue;
                }
            }

            let redis_key = Self::generate_redis_key(token_address);
            if let Ok(Some(logo_url)) = conn.get::<_, Option<String>>(&redis_key) {
                result.insert(token_address.clone(), logo_url.clone());

                let mut cache = self.memory_cache.write().await;
                cache.insert(normalized, logo_url);
            } else {
                missing_from_cache.push(token_address.clone());
            }
        }

        if !missing_from_cache.is_empty() {
            if let Some(repo) = &self.mongo_repo {
                let normalized_addresses: Vec<String> = missing_from_cache
                    .iter()
                    .map(|a| Self::normalize_address(a))
                    .collect();

                if let Ok(mongo_logos) = repo.get_logos_batch(&normalized_addresses).await {
                    for (addr, logo_url) in mongo_logos {
                        let original_addr = missing_from_cache
                            .iter()
                            .find(|a| Self::normalize_address(a) == addr)
                            .cloned()
                            .unwrap_or(addr.clone());

                        result.insert(original_addr, logo_url.clone());

                        let redis_key = Self::generate_redis_key(&addr);
                        let _: Result<(), _> =
                            conn.set_ex(&redis_key, &logo_url, self.expiration_seconds);

                        let mut cache = self.memory_cache.write().await;
                        cache.insert(addr, logo_url);
                    }
                }
            }
        }

        Ok(result)
    }

    pub async fn set_token_logos_batch(&self, token_logos: HashMap<String, String>) -> Result<()> {
        let mut conn = self.redis.get_connection()?;

        {
            let mut cache = self.memory_cache.write().await;
            for (token_address, logo_url) in &token_logos {
                let redis_key = Self::generate_redis_key(token_address);
                let _: () = conn.set_ex(&redis_key, logo_url, self.expiration_seconds)?;

                let normalized = Self::normalize_address(token_address);
                cache.insert(normalized.clone(), logo_url.clone());
            }
        }

        if let Some(repo) = &self.mongo_repo {
            for (token_address, logo_url) in &token_logos {
                let normalized = Self::normalize_address(token_address);
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

        tracing::info!("TokenLogoService: Loading all tokens into memory cache...");

        let mut conn = self.redis.get_connection()?;
        let pattern = format!("{}*", TOKEN_LOGO_KEY_PREFIX);
        let keys: Vec<String> = conn.keys(&pattern)?;

        let mut cache = self.memory_cache.write().await;
        for key in keys {
            if let Ok(Some(value)) = conn.get::<_, Option<String>>(&key) {
                let token_address = key.trim_start_matches(TOKEN_LOGO_KEY_PREFIX);
                let normalized = Self::normalize_address(token_address);
                cache.insert(normalized, value);
            }
        }

        tracing::info!(
            "TokenLogoService: Loaded {} token logos from Redis",
            cache.len()
        );

        if cache.is_empty() {
            if let Some(repo) = &self.mongo_repo {
                tracing::info!("TokenLogoService: Redis cache empty, loading from MongoDB...");
                match repo.get_all_with_logos().await {
                    Ok(mongo_logos) => {
                        for (address, logo_url) in &mongo_logos {
                            let normalized = Self::normalize_address(address);
                            cache.insert(normalized.clone(), logo_url.clone());

                            let redis_key = Self::generate_redis_key(address);
                            let _: Result<(), _> =
                                conn.set_ex(&redis_key, logo_url, self.expiration_seconds);
                        }
                        tracing::info!(
                            "TokenLogoService: Loaded {} token logos from MongoDB into cache",
                            mongo_logos.len()
                        );
                    }
                    Err(e) => {
                        tracing::warn!("TokenLogoService: Failed to load from MongoDB: {}", e);
                    }
                }
            }
        }

        tracing::info!(
            "TokenLogoService: Total {} token logos in memory cache",
            cache.len()
        );
        *initialized = true;

        Ok(())
    }

    fn normalize_address(address: &str) -> String {
        address.trim().to_lowercase()
    }

    fn generate_redis_key(token_address: &str) -> String {
        let normalized = Self::normalize_address(token_address);
        format!("{}{}", TOKEN_LOGO_KEY_PREFIX, normalized)
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

    #[test]
    fn test_generate_redis_key() {
        assert_eq!(
            TokenLogoService::generate_redis_key("0xABC123"),
            "token_logo:0xabc123"
        );
    }
}
