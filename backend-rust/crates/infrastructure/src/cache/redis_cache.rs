use crate::retry::RetryConfig;
use defi10_core::{DeFi10Error, Result};
use redis::{aio::ConnectionManager, AsyncCommands, Client};
use serde::{de::DeserializeOwned, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

pub const AGGREGATION_CACHE_PREFIX: &str = "aggregation_cache";

const MAX_RETRIES: u32 = 3;
const COMMAND_TIMEOUT_SECS: u64 = 10;

#[derive(Clone)]
pub struct RedisCache {
    connection: Arc<RwLock<ConnectionManager>>,
    client: Client,
    default_ttl: Duration,
}

impl RedisCache {
    pub async fn new(url: &str, default_ttl_seconds: u64) -> Result<Self> {
        let client = Client::open(url)
            .map_err(|e| DeFi10Error::Cache(format!("Failed to create Redis client: {}", e)))?;

        let connection = Self::connect(&client).await?;
        let connection = Arc::new(RwLock::new(connection));

        let keepalive_conn = connection.clone();
        let keepalive_client = client.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(30)).await;
                let mut c = keepalive_conn.read().await.clone();
                let ping: std::result::Result<String, _> =
                    redis::cmd("PING").query_async(&mut c).await;
                if ping.is_err() {
                    tracing::debug!("RedisCache: keepalive ping failed, reconnecting...");
                    if let Ok(new_conn) = Self::connect(&keepalive_client).await {
                        *keepalive_conn.write().await = new_conn;
                        tracing::debug!("RedisCache: keepalive reconnected");
                    }
                }
            }
        });

        Ok(Self {
            connection,
            client,
            default_ttl: Duration::from_secs(default_ttl_seconds),
        })
    }

    async fn connect(client: &Client) -> Result<ConnectionManager> {
        tokio::time::timeout(
            Duration::from_secs(15),
            ConnectionManager::new(client.clone()),
        )
        .await
        .map_err(|_| DeFi10Error::Cache("Redis connection timed out after 15s".to_string()))?
        .map_err(|e| DeFi10Error::Cache(format!("Failed to connect to Redis: {}", e)))
    }

    async fn get_conn(&self) -> ConnectionManager {
        self.connection.read().await.clone()
    }

    async fn reconnect(&self) {
        tracing::info!("RedisCache: reconnecting...");
        match Self::connect(&self.client).await {
            Ok(new_conn) => {
                *self.connection.write().await = new_conn;
                tracing::info!("RedisCache: reconnected");
            }
            Err(e) => {
                tracing::warn!("RedisCache: reconnect failed: {}", e);
            }
        }
    }

    async fn with_retry<F, Fut, T>(&self, mut f: F) -> Result<T>
    where
        F: FnMut(ConnectionManager) -> Fut,
        Fut: std::future::Future<Output = Result<T>>,
    {
        let config = RetryConfig::new("RedisCache", MAX_RETRIES)
            .with_timeout(Duration::from_secs(COMMAND_TIMEOUT_SECS));

        let mut last_err = None;
        for attempt in 1..=config.max_attempts {
            let conn = self.get_conn().await;
            let result = match config.timeout {
                Some(timeout) => match tokio::time::timeout(timeout, f(conn)).await {
                    Ok(r) => r,
                    Err(_) => {
                        tracing::warn!(
                            "{}: attempt {}/{} timed out ({}s)",
                            config.name,
                            attempt,
                            config.max_attempts,
                            timeout.as_secs()
                        );
                        last_err = Some(DeFi10Error::Cache(format!(
                            "Redis command timed out after {}s",
                            timeout.as_secs()
                        )));
                        if attempt < config.max_attempts {
                            self.reconnect().await;
                        }
                        continue;
                    }
                },
                None => f(conn).await,
            };

            match result {
                Ok(v) => return Ok(v),
                Err(e) => {
                    tracing::warn!(
                        "{}: attempt {}/{} failed: {}",
                        config.name,
                        attempt,
                        config.max_attempts,
                        e
                    );
                    last_err = Some(e);
                    if attempt < config.max_attempts {
                        self.reconnect().await;
                    }
                }
            }
        }
        Err(last_err.unwrap())
    }

    pub async fn health_check(&self) -> Result<()> {
        let mut conn = self.get_conn().await;
        redis::cmd("PING")
            .query_async::<String>(&mut conn)
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
    async fn get<T: DeserializeOwned>(&self, prefix: &str, key: &str) -> Result<Option<T>>;

    async fn set<T: Serialize>(
        &self,
        prefix: &str,
        key: &str,
        value: &T,
        ttl: Option<Duration>,
    ) -> Result<()>;

    async fn delete(&self, prefix: &str, key: &str) -> Result<bool>;

    async fn exists(&self, prefix: &str, key: &str) -> Result<bool>;

    async fn set_with_expiry(
        &self,
        prefix: &str,
        key: &str,
        value: String,
        ttl: Duration,
    ) -> Result<()>;
}

impl CacheService for RedisCache {
    async fn get<T: DeserializeOwned>(&self, prefix: &str, key: &str) -> Result<Option<T>> {
        let full_key = self.build_key(prefix, key);

        self.with_retry(|mut conn| {
            let fk = full_key.clone();
            async move {
                let value: Option<String> = conn
                    .get(&fk)
                    .await
                    .map_err(|e| DeFi10Error::Cache(format!("Get failed: {}", e)))?;

                match value {
                    Some(v) => {
                        let deserialized = serde_json::from_str(&v).map_err(|e| {
                            DeFi10Error::Cache(format!("Deserialization failed: {}", e))
                        })?;
                        Ok(Some(deserialized))
                    }
                    None => Ok(None),
                }
            }
        })
        .await
    }

    async fn set<T: Serialize>(
        &self,
        prefix: &str,
        key: &str,
        value: &T,
        ttl: Option<Duration>,
    ) -> Result<()> {
        let full_key = self.build_key(prefix, key);
        let serialized = serde_json::to_string(value)
            .map_err(|e| DeFi10Error::Cache(format!("Serialization failed: {}", e)))?;
        let ttl = ttl.unwrap_or(self.default_ttl);

        self.with_retry(|mut conn| {
            let fk = full_key.clone();
            let s = serialized.clone();
            async move {
                conn.set_ex::<_, _, ()>(&fk, s, ttl.as_secs())
                    .await
                    .map_err(|e| DeFi10Error::Cache(format!("Set failed: {}", e)))?;
                Ok(())
            }
        })
        .await
    }

    async fn delete(&self, prefix: &str, key: &str) -> Result<bool> {
        let full_key = self.build_key(prefix, key);

        self.with_retry(|mut conn| {
            let fk = full_key.clone();
            async move {
                let deleted: i32 = conn
                    .del(&fk)
                    .await
                    .map_err(|e| DeFi10Error::Cache(format!("Delete failed: {}", e)))?;
                Ok(deleted > 0)
            }
        })
        .await
    }

    async fn exists(&self, prefix: &str, key: &str) -> Result<bool> {
        let full_key = self.build_key(prefix, key);

        self.with_retry(|mut conn| {
            let fk = full_key.clone();
            async move {
                conn.exists(&fk)
                    .await
                    .map_err(|e| DeFi10Error::Cache(format!("Exists check failed: {}", e)))
            }
        })
        .await
    }

    async fn set_with_expiry(
        &self,
        prefix: &str,
        key: &str,
        value: String,
        ttl: Duration,
    ) -> Result<()> {
        let full_key = self.build_key(prefix, key);

        self.with_retry(|mut conn| {
            let fk = full_key.clone();
            let v = value.clone();
            async move {
                conn.set_ex::<_, _, ()>(&fk, v, ttl.as_secs())
                    .await
                    .map_err(|e| DeFi10Error::Cache(format!("Set with expiry failed: {}", e)))?;
                Ok(())
            }
        })
        .await
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
        let (cache, _container) = setup_redis().await;
        assert!(cache.health_check().await.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_cache_set_and_get() {
        let (cache, _container) = setup_redis().await;

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
        let (cache, _container) = setup_redis().await;

        let retrieved: Option<TestData> = cache.get("test_prefix", "nonexistent").await.unwrap();

        assert!(retrieved.is_none());
    }

    #[tokio::test]
    #[ignore]
    async fn test_cache_delete() {
        let (cache, _container) = setup_redis().await;

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
        let (cache, _container) = setup_redis().await;

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
        let (cache, _container) = setup_redis().await;

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
        let (cache, _container) = setup_redis().await;

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
        assert_eq!(build_key("price", "BTC"), "price:BTC");
    }
}
