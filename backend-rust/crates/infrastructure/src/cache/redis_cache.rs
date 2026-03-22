use defi10_core::{DeFi10Error, Result};
use redis::{aio::MultiplexedConnection, AsyncCommands, Client};
use serde::{de::DeserializeOwned, Serialize};
use std::time::Duration;

pub const PRICE_PREFIX: &str = "price";
pub const TOKEN_PREFIX: &str = "token";
pub const WALLET_PREFIX: &str = "wallet";
pub const PROTOCOL_PREFIX: &str = "protocol";

#[derive(Clone)]
pub struct RedisCache {
    _client: Client,
    connection: MultiplexedConnection,
    default_ttl: Duration,
}

impl RedisCache {
    pub async fn new(url: &str, default_ttl_seconds: u64) -> Result<Self> {
        let client = Client::open(url)
            .map_err(|e| DeFi10Error::Cache(format!("Failed to create Redis client: {}", e)))?;

        let connection = client
            .get_multiplexed_async_connection()
            .await
            .map_err(|e| DeFi10Error::Cache(format!("Failed to connect to Redis: {}", e)))?;

        Ok(Self {
            _client: client,
            connection,
            default_ttl: Duration::from_secs(default_ttl_seconds),
        })
    }

    pub async fn health_check(&mut self) -> Result<()> {
        redis::cmd("PING")
            .query_async::<String>(&mut self.connection)
            .await
            .map_err(|e| DeFi10Error::Cache(format!("Health check failed: {}", e)))?;
        Ok(())
    }

    fn build_key(&self, prefix: &str, key: &str) -> String {
        format!("{}:{}", prefix, key)
    }
}

#[allow(async_fn_in_trait)]
pub trait CacheService {
    async fn get<T: DeserializeOwned>(&mut self, prefix: &str, key: &str) -> Result<Option<T>>;

    async fn set<T: Serialize>(
        &mut self,
        prefix: &str,
        key: &str,
        value: &T,
        ttl: Option<Duration>,
    ) -> Result<()>;

    async fn delete(&mut self, prefix: &str, key: &str) -> Result<bool>;

    async fn exists(&mut self, prefix: &str, key: &str) -> Result<bool>;

    async fn set_with_expiry(
        &mut self,
        prefix: &str,
        key: &str,
        value: String,
        ttl: Duration,
    ) -> Result<()>;
}

impl CacheService for RedisCache {
    async fn get<T: DeserializeOwned>(&mut self, prefix: &str, key: &str) -> Result<Option<T>> {
        let full_key = self.build_key(prefix, key);

        let value: Option<String> = self
            .connection
            .get(&full_key)
            .await
            .map_err(|e| DeFi10Error::Cache(format!("Get failed: {}", e)))?;

        match value {
            Some(v) => {
                let deserialized = serde_json::from_str(&v)
                    .map_err(|e| DeFi10Error::Cache(format!("Deserialization failed: {}", e)))?;
                Ok(Some(deserialized))
            }
            None => Ok(None),
        }
    }

    async fn set<T: Serialize>(
        &mut self,
        prefix: &str,
        key: &str,
        value: &T,
        ttl: Option<Duration>,
    ) -> Result<()> {
        let full_key = self.build_key(prefix, key);
        let serialized = serde_json::to_string(value)
            .map_err(|e| DeFi10Error::Cache(format!("Serialization failed: {}", e)))?;

        let ttl = ttl.unwrap_or(self.default_ttl);

        self.connection
            .set_ex::<_, _, ()>(&full_key, serialized, ttl.as_secs())
            .await
            .map_err(|e| DeFi10Error::Cache(format!("Set failed: {}", e)))?;

        Ok(())
    }

    async fn delete(&mut self, prefix: &str, key: &str) -> Result<bool> {
        let full_key = self.build_key(prefix, key);

        let deleted: i32 = self
            .connection
            .del(&full_key)
            .await
            .map_err(|e| DeFi10Error::Cache(format!("Delete failed: {}", e)))?;

        Ok(deleted > 0)
    }

    async fn exists(&mut self, prefix: &str, key: &str) -> Result<bool> {
        let full_key = self.build_key(prefix, key);

        self.connection
            .exists(&full_key)
            .await
            .map_err(|e| DeFi10Error::Cache(format!("Exists check failed: {}", e)))
    }

    async fn set_with_expiry(
        &mut self,
        prefix: &str,
        key: &str,
        value: String,
        ttl: Duration,
    ) -> Result<()> {
        let full_key = self.build_key(prefix, key);

        self.connection
            .set_ex::<_, _, ()>(&full_key, value, ttl.as_secs())
            .await
            .map_err(|e| DeFi10Error::Cache(format!("Set with expiry failed: {}", e)))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};
    use testcontainers::runners::AsyncRunner;
    use testcontainers_modules::redis::Redis;

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestData {
        name: String,
        value: i32,
    }

    async fn setup_redis() -> (RedisCache, testcontainers::ContainerAsync<Redis>) {
        let container = Redis::default()
            .start()
            .await
            .expect("Failed to start Redis container");

        let port = container
            .get_host_port_ipv4(6379)
            .await
            .expect("Failed to get Redis port");

        let url = format!("redis://localhost:{}", port);
        let cache = RedisCache::new(&url, 300).await.unwrap();

        (cache, container)
    }

    #[tokio::test]
    #[ignore]
    async fn test_redis_connection() {
        let (mut cache, _container) = setup_redis().await;
        assert!(cache.health_check().await.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_cache_set_and_get() {
        let (mut cache, _container) = setup_redis().await;

        let data = TestData {
            name: "test".to_string(),
            value: 42,
        };

        cache.set("test_prefix", "key1", &data, None).await.unwrap();

        let retrieved: Option<TestData> = cache.get("test_prefix", "key1").await.unwrap();

        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap(), data);
    }

    #[tokio::test]
    #[ignore]
    async fn test_cache_get_nonexistent() {
        let (mut cache, _container) = setup_redis().await;

        let retrieved: Option<TestData> = cache.get("test_prefix", "nonexistent").await.unwrap();

        assert!(retrieved.is_none());
    }

    #[tokio::test]
    #[ignore]
    async fn test_cache_delete() {
        let (mut cache, _container) = setup_redis().await;

        let data = TestData {
            name: "delete_test".to_string(),
            value: 100,
        };

        cache
            .set("test_prefix", "delete_key", &data, None)
            .await
            .unwrap();

        let deleted = cache.delete("test_prefix", "delete_key").await.unwrap();
        assert!(deleted);

        let retrieved: Option<TestData> = cache.get("test_prefix", "delete_key").await.unwrap();
        assert!(retrieved.is_none());
    }

    #[tokio::test]
    #[ignore]
    async fn test_cache_exists() {
        let (mut cache, _container) = setup_redis().await;

        let data = TestData {
            name: "exists_test".to_string(),
            value: 200,
        };

        cache
            .set("test_prefix", "exists_key", &data, None)
            .await
            .unwrap();

        let exists = cache.exists("test_prefix", "exists_key").await.unwrap();
        assert!(exists);

        let not_exists = cache.exists("test_prefix", "nonexistent").await.unwrap();
        assert!(!not_exists);
    }

    #[tokio::test]
    #[ignore]
    async fn test_cache_ttl_expiry() {
        let (mut cache, _container) = setup_redis().await;

        let data = TestData {
            name: "ttl_test".to_string(),
            value: 300,
        };

        // Set with 1 second TTL
        cache
            .set(
                "test_prefix",
                "ttl_key",
                &data,
                Some(Duration::from_secs(1)),
            )
            .await
            .unwrap();

        // Should exist immediately
        let exists = cache.exists("test_prefix", "ttl_key").await.unwrap();
        assert!(exists);

        // Wait for expiry
        tokio::time::sleep(Duration::from_millis(1100)).await;

        // Should not exist after TTL
        let exists = cache.exists("test_prefix", "ttl_key").await.unwrap();
        assert!(!exists);
    }

    #[tokio::test]
    #[ignore]
    async fn test_cache_set_with_expiry() {
        let (mut cache, _container) = setup_redis().await;

        cache
            .set_with_expiry(
                "test_prefix",
                "expiry_key",
                "test_value".to_string(),
                Duration::from_secs(1),
            )
            .await
            .unwrap();

        let exists = cache.exists("test_prefix", "expiry_key").await.unwrap();
        assert!(exists);

        tokio::time::sleep(Duration::from_millis(1100)).await;

        let exists = cache.exists("test_prefix", "expiry_key").await.unwrap();
        assert!(!exists);
    }

    #[test]
    fn test_build_key() {
        fn build_key(prefix: &str, key: &str) -> String {
            format!("{}:{}", prefix, key)
        }

        assert_eq!(build_key("prefix", "key"), "prefix:key");
        assert_eq!(build_key(PRICE_PREFIX, "BTC"), "price:BTC");
    }

    #[test]
    fn test_cache_prefixes() {
        assert_eq!(PRICE_PREFIX, "price");
        assert_eq!(TOKEN_PREFIX, "token");
        assert_eq!(WALLET_PREFIX, "wallet");
        assert_eq!(PROTOCOL_PREFIX, "protocol");
    }
}
