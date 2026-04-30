use anyhow::Result;
use defi10_infrastructure::{
    cache::RedisCache,
    config::load_config,
    database::{
        MongoDatabase, RaydiumPositionRepository, SnapshotRepository, WalletGroupRepository,
    },
    init_tracing_with_newrelic,
};
use defi10_protocols::RaydiumPositionStore;
use defi10_worker::processor::AggregationProcessor;
use defi10_worker::sweep::run_snapshot_job;
use std::sync::Arc;
use tracing::{error, info};

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    let config = load_config().expect("Failed to load configuration");

    let nr_config = config.newrelic.as_ref().map(|nr| {
        let mut c = nr.clone();
        c.service_name = "defi10-snapshot-job".to_string();
        c
    });
    init_tracing_with_newrelic(nr_config.as_ref());

    info!("Starting DeFi10 Snapshot Job (one-shot)...");

    let mongo_db = MongoDatabase::new(&config.mongodb.uri, &config.mongodb.database)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to connect to MongoDB: {}", e))?;
    let snapshot_repo = SnapshotRepository::new(mongo_db.database());
    let wg_repo = WalletGroupRepository::new(mongo_db.database());
    let raydium_repo: Arc<dyn RaydiumPositionStore> =
        Arc::new(RaydiumPositionRepository::new(mongo_db.database()));
    info!("MongoDB connected, repositories initialized");

    let cache = RedisCache::new(&config.redis.url, config.redis.default_ttl_seconds)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to create Redis cache: {}", e))?;
    info!("Redis cache initialized");

    let processor = AggregationProcessor::new(config.clone(), Some(raydium_repo));
    info!("Processor initialized");

    match run_snapshot_job(&snapshot_repo, &processor, &cache, &wg_repo).await {
        Ok(_) => {
            info!("Snapshot job completed successfully");
            Ok(())
        }
        Err(e) => {
            error!("Snapshot job failed: {}", e);
            Err(e)
        }
    }
}
