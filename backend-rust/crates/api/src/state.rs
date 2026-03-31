use defi10_aggregation::PriceAggregator;
use defi10_core::Result;
use defi10_infrastructure::{
    aggregation::JobManager,
    cache::RedisCache,
    config::AppConfig,
    database::{
        MongoDatabase, SnapshotRepository, SnapshotRepositoryTrait, WalletGroupRepository,
        WalletGroupRepositoryTrait,
    },
    messaging::RabbitMqConnection,
    retry::{retry_async, RetryConfig},
    ProofOfWorkService, StrategyService, TokenLogoService,
};
use std::sync::Arc;
use std::time::Duration;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<MongoDatabase>,
    pub cache: Arc<RedisCache>,
    pub messaging: Arc<RabbitMqConnection>,
    pub config: Arc<AppConfig>,
    pub wallet_group_repo: Arc<dyn WalletGroupRepositoryTrait>,
    pub snapshot_repo: Arc<dyn SnapshotRepositoryTrait>,
    pub job_manager: Arc<JobManager>,
    pub pow_service: Arc<ProofOfWorkService>,
    pub strategy_service: Arc<StrategyService>,
    pub token_logo_service: Arc<TokenLogoService>,
    pub price_aggregator: Arc<PriceAggregator>,
}

impl AppState {
    pub async fn new(config: AppConfig) -> Result<Self> {
        tracing::info!(
            "Connecting to MongoDB database: {}",
            config.mongodb.database
        );
        let retry_cfg = RetryConfig::new("MongoDB", 5).with_base_delay(Duration::from_secs(3));
        let db = retry_async(&retry_cfg, || {
            MongoDatabase::new(&config.mongodb.uri, &config.mongodb.database)
        })
        .await?;
        tracing::info!(
            "MongoDB connected successfully to database: {}",
            config.mongodb.database
        );

        let retry_cfg = RetryConfig::new("Redis cache", 5).with_base_delay(Duration::from_secs(3));
        let cache = retry_async(&retry_cfg, || {
            RedisCache::new(&config.redis.url, config.redis.default_ttl_seconds)
        })
        .await?;
        let cache = Arc::new(cache);
        tracing::info!("Redis connected successfully");

        let retry_cfg = RetryConfig::new("RabbitMQ", 5).with_base_delay(Duration::from_secs(3));
        let messaging = retry_async(&retry_cfg, || async {
            RabbitMqConnection::new(&config.rabbitmq.url).await
        })
        .await?;
        tracing::info!("RabbitMQ connected successfully");

        let wallet_group_repo = WalletGroupRepository::new(db.database());
        let snapshot_repo = SnapshotRepository::new(db.database());

        let retry_cfg = RetryConfig::new("JobManager", 5).with_base_delay(Duration::from_secs(3));
        let job_manager = retry_async(&retry_cfg, || async {
            JobManager::new(&config.redis.url)
                .await
                .map_err(|e| defi10_core::DeFi10Error::Cache(e.to_string()))
        })
        .await?;
        tracing::info!("JobManager initialized successfully");

        let pow_service = ProofOfWorkService::new(cache.clone());
        tracing::info!("ProofOfWorkService initialized successfully");

        let strategy_service = StrategyService::new(db.database());
        tracing::info!("StrategyService initialized successfully");

        let db = Arc::new(db);

        let token_logo_service = TokenLogoService::new(cache.clone()).with_mongo(db.clone());
        tracing::info!("TokenLogoService initialized with MongoDB support");

        let coinmarketcap_api_key = std::env::var("COINMARKETCAP_API_KEY")
            .or_else(|_| std::env::var("CoinMarketCap__ApiKey"))
            .unwrap_or_default();
        let price_aggregator = PriceAggregator::new(cache.clone(), coinmarketcap_api_key, 300);
        tracing::info!("PriceAggregator initialized");

        Ok(Self {
            db,
            cache,
            messaging: Arc::new(messaging),
            config: Arc::new(config),
            wallet_group_repo: Arc::new(wallet_group_repo),
            snapshot_repo: Arc::new(snapshot_repo),
            job_manager: Arc::new(job_manager),
            pow_service: Arc::new(pow_service),
            strategy_service: Arc::new(strategy_service),
            token_logo_service: Arc::new(token_logo_service),
            price_aggregator: Arc::new(price_aggregator),
        })
    }

    pub async fn health_check(&self) -> Result<HealthStatus> {
        let db_status = match self.db.health_check().await {
            Ok(_) => ServiceStatus::Healthy,
            Err(e) => ServiceStatus::Unhealthy {
                error: e.to_string(),
            },
        };

        let cache_status = match self.cache.health_check().await {
            Ok(_) => ServiceStatus::Healthy,
            Err(e) => ServiceStatus::Unhealthy {
                error: e.to_string(),
            },
        };

        let messaging_status = match self.messaging.health_check().await {
            Ok(_) => ServiceStatus::Healthy,
            Err(e) => ServiceStatus::Unhealthy {
                error: e.to_string(),
            },
        };

        let overall_healthy = matches!(
            (&db_status, &cache_status, &messaging_status),
            (
                ServiceStatus::Healthy,
                ServiceStatus::Healthy,
                ServiceStatus::Healthy
            )
        );

        Ok(HealthStatus {
            healthy: overall_healthy,
            database: db_status,
            cache: cache_status,
            messaging: messaging_status,
        })
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub database: ServiceStatus,
    pub cache: ServiceStatus,
    pub messaging: ServiceStatus,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum ServiceStatus {
    Healthy,
    Unhealthy { error: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_status_all_healthy() {
        let status = HealthStatus {
            healthy: true,
            database: ServiceStatus::Healthy,
            cache: ServiceStatus::Healthy,
            messaging: ServiceStatus::Healthy,
        };

        assert!(status.healthy);
    }

    #[test]
    fn test_health_status_one_unhealthy() {
        let status = HealthStatus {
            healthy: false,
            database: ServiceStatus::Healthy,
            cache: ServiceStatus::Unhealthy {
                error: "Connection failed".to_string(),
            },
            messaging: ServiceStatus::Healthy,
        };

        assert!(!status.healthy);
    }

    #[test]
    fn test_service_status_serialization() {
        let healthy = ServiceStatus::Healthy;
        let json = serde_json::to_string(&healthy).unwrap();
        assert!(json.contains("healthy"));

        let unhealthy = ServiceStatus::Unhealthy {
            error: "error".to_string(),
        };
        let json = serde_json::to_string(&unhealthy).unwrap();
        assert!(json.contains("unhealthy"));
    }
}
