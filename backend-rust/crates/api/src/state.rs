use defi10_core::Result;
use defi10_infrastructure::{
    aggregation::JobManager,
    cache::RedisCache,
    config::AppConfig,
    database::{MongoDatabase, WalletGroupRepository, WalletGroupRepositoryTrait},
    messaging::RabbitMqConnection,
    ProofOfWorkService, StrategyService, TokenLogoService,
};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<MongoDatabase>,
    pub cache: Arc<RwLock<RedisCache>>,
    pub messaging: Arc<RabbitMqConnection>,
    pub config: Arc<AppConfig>,
    pub wallet_group_repo: Arc<dyn WalletGroupRepositoryTrait>,
    pub job_manager: Arc<JobManager>,
    pub pow_service: Arc<ProofOfWorkService>,
    pub strategy_service: Arc<StrategyService>,
    pub token_logo_service: Arc<TokenLogoService>,
}

impl AppState {
    pub async fn new(config: AppConfig) -> Result<Self> {
        // Initialize MongoDB
        tracing::info!(
            "Connecting to MongoDB database: {}",
            config.mongodb.database
        );
        let db = MongoDatabase::new(&config.mongodb.uri, &config.mongodb.database).await?;
        tracing::info!(
            "MongoDB connected successfully to database: {}",
            config.mongodb.database
        );

        // Initialize Redis
        let cache = RedisCache::new(&config.redis.url, config.redis.default_ttl_seconds).await?;
        tracing::info!("Redis connected successfully");

        // Initialize RabbitMQ
        let messaging = RabbitMqConnection::new(&config.rabbitmq.url).await?;
        tracing::info!("RabbitMQ connected successfully");

        // Initialize repositories
        let wallet_group_repo = WalletGroupRepository::new(db.database());

        // Initialize job manager
        let job_manager = JobManager::new(&config.redis.url)
            .map_err(|e| defi10_core::DeFi10Error::Cache(e.to_string()))?;
        tracing::info!("JobManager initialized successfully");

        // Initialize PoW service
        let pow_service = ProofOfWorkService::new(&config.redis.url)
            .map_err(|e| defi10_core::DeFi10Error::Cache(e.to_string()))?;
        tracing::info!("ProofOfWorkService initialized successfully");

        // Initialize Strategy service
        let strategy_service = StrategyService::new(db.database());
        tracing::info!("StrategyService initialized successfully");

        // Wrap db in Arc first for reuse
        let db = Arc::new(db);

        // Initialize Token Logo service with MongoDB support
        let token_logo_service = TokenLogoService::new(&config.redis.url)
            .map_err(|e| defi10_core::DeFi10Error::Cache(e.to_string()))?
            .with_mongo(db.clone());
        tracing::info!("TokenLogoService initialized with MongoDB support");

        Ok(Self {
            db,
            cache: Arc::new(RwLock::new(cache)),
            messaging: Arc::new(messaging),
            config: Arc::new(config),
            wallet_group_repo: Arc::new(wallet_group_repo),
            job_manager: Arc::new(job_manager),
            pow_service: Arc::new(pow_service),
            strategy_service: Arc::new(strategy_service),
            token_logo_service: Arc::new(token_logo_service),
        })
    }

    pub async fn health_check(&self) -> Result<HealthStatus> {
        let db_status = match self.db.health_check().await {
            Ok(_) => ServiceStatus::Healthy,
            Err(e) => ServiceStatus::Unhealthy {
                error: e.to_string(),
            },
        };

        let cache_status = match self.cache.write().await.health_check().await {
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
