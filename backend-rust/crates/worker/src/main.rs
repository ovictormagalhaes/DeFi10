use anyhow::Result;
use defi10_core::aggregation::{AggregationResult, JobStatus, OperationStatus};
use defi10_core::analytics::compute_analytics;
use defi10_core::snapshot::DailySnapshot;
use defi10_infrastructure::{
    aggregation::{AggregationMessage, JobManager},
    cache::{CacheService, RedisCache, AGGREGATION_CACHE_PREFIX},
    config::load_config,
    database::{
        MongoDatabase, SnapshotRepository, SnapshotRepositoryTrait, WalletGroupRepository,
        WalletGroupRepositoryTrait,
    },
    init_tracing_with_newrelic,
    messaging::RabbitMqConnection,
};
use futures_util::stream::StreamExt;
use lapin::ExchangeKind;
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use tracing::{error, info, warn};
use uuid::Uuid;

mod processor;
use processor::AggregationProcessor;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    let config = load_config().expect("Failed to load configuration");

    let nr_config = config.newrelic.as_ref().map(|nr| {
        let mut c = nr.clone();
        c.service_name = "defi10-worker".to_string();
        c
    });
    init_tracing_with_newrelic(nr_config.as_ref());

    info!("Starting DeFi10 Aggregation Worker...");

    info!("Blockchain RPCs configured:");
    info!(
        "  Ethereum: {}",
        config
            .blockchain
            .ethereum_rpc
            .as_ref()
            .map(|s| &s[..50])
            .unwrap_or("None")
    );
    info!(
        "  Base: {}",
        config
            .blockchain
            .base_rpc
            .as_ref()
            .map(|s| &s[..50])
            .unwrap_or("None")
    );
    info!(
        "  Arbitrum: {}",
        config
            .blockchain
            .arbitrum_rpc
            .as_ref()
            .map(|s| &s[..50])
            .unwrap_or("None")
    );
    info!(
        "  Solana: {}",
        config
            .blockchain
            .solana_rpc
            .as_ref()
            .map(|s| &s[..50])
            .unwrap_or("None")
    );
    info!("Configuration loaded");

    let job_manager = Arc::new(JobManager::new(&config.redis.url).await?);
    info!("Job manager initialized");

    let mongo_db = MongoDatabase::new(&config.mongodb.uri, &config.mongodb.database)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to connect to MongoDB: {}", e))?;
    let snapshot_repo = Arc::new(SnapshotRepository::new(mongo_db.database()));
    info!("MongoDB connected, snapshot repository initialized");

    let processor = Arc::new(AggregationProcessor::new(config.clone()));
    info!("Processor initialized");

    let cache = RedisCache::new(&config.redis.url, config.redis.default_ttl_seconds)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to create Redis cache: {}", e))?;
    let account_cache_ttl = Duration::from_secs(config.redis.account_cache_ttl_seconds);
    info!(
        "Account cache initialized (TTL={}s)",
        config.redis.account_cache_ttl_seconds
    );

    const RECONNECT_BASE_DELAY_SECS: u64 = 2;
    const RECONNECT_MAX_DELAY_SECS: u64 = 30;
    let mut consecutive_failures: u32 = 0;

    {
        let snapshot_repo = Arc::clone(&snapshot_repo);
        let processor = Arc::clone(&processor);
        let cache_clone = cache.clone();
        let wg_repo = Arc::new(WalletGroupRepository::new(mongo_db.database()));
        tokio::spawn(async move {
            daily_sweep_loop(&snapshot_repo, &processor, &cache_clone, wg_repo.as_ref()).await;
        });
    }

    loop {
        match run_consumer(
            &config,
            &job_manager,
            &processor,
            &cache,
            account_cache_ttl,
            &snapshot_repo,
        )
        .await
        {
            Ok(_) => {
                warn!("Consumer stream ended, reconnecting...");
                consecutive_failures = 0;
            }
            Err(e) => {
                consecutive_failures += 1;
                error!("Consumer failed (attempt {}): {}", consecutive_failures, e);
            }
        }

        let delay = std::cmp::min(
            RECONNECT_BASE_DELAY_SECS * consecutive_failures as u64,
            RECONNECT_MAX_DELAY_SECS,
        );
        warn!("Reconnecting to RabbitMQ in {}s...", delay);
        tokio::time::sleep(Duration::from_secs(delay)).await;
    }
}

async fn run_consumer(
    config: &defi10_infrastructure::config::AppConfig,
    job_manager: &Arc<JobManager>,
    processor: &Arc<AggregationProcessor>,
    cache: &RedisCache,
    account_cache_ttl: Duration,
    snapshot_repo: &Arc<SnapshotRepository>,
) -> Result<()> {
    let rabbitmq = RabbitMqConnection::new(&config.rabbitmq.url).await?;
    info!("Connected to RabbitMQ");

    let exchange = "aggregation.requests";
    let queue = "aggregation.queue";

    rabbitmq
        .declare_exchange(exchange, ExchangeKind::Topic, true)
        .await?;
    info!("Exchange '{}' declared", exchange);

    rabbitmq.declare_queue(queue, true).await?;
    info!("Queue '{}' declared", queue);

    rabbitmq
        .bind_queue(queue, exchange, "aggregation.*")
        .await?;
    info!("Queue bound to exchange with pattern 'aggregation.*'");

    let channel = rabbitmq.create_channel().await?;
    channel
        .basic_qos(
            config.rabbitmq.prefetch_count,
            lapin::options::BasicQosOptions { global: false },
        )
        .await?;
    info!(
        "QoS set with prefetch_count={}",
        config.rabbitmq.prefetch_count
    );

    let mut consumer = channel
        .basic_consume(
            queue,
            "defi10-worker",
            lapin::options::BasicConsumeOptions::default(),
            lapin::types::FieldTable::default(),
        )
        .await?;

    let concurrency = config.rabbitmq.worker_concurrency as usize;
    let semaphore = Arc::new(Semaphore::new(concurrency));
    info!(
        "Starting message consumption from queue '{}' (concurrency={})...",
        queue, concurrency
    );

    while let Some(delivery) = consumer.next().await {
        match delivery {
            Ok(delivery) => match serde_json::from_slice::<AggregationMessage>(&delivery.data) {
                Ok(message) => {
                    let permit = semaphore.clone().acquire_owned().await.unwrap();
                    let job_manager = Arc::clone(job_manager);
                    let processor = Arc::clone(processor);
                    let cache_clone = cache.clone();
                    let snapshot_repo = Arc::clone(snapshot_repo);

                    tokio::spawn(async move {
                        info!(
                            "Processing job {} for account {} on chain {}",
                            message.job_id, message.account, message.chain
                        );

                        match process_message(
                            message,
                            job_manager,
                            processor,
                            &cache_clone,
                            account_cache_ttl,
                            &snapshot_repo,
                        )
                        .await
                        {
                            Ok(_) => {
                                info!("Message processed successfully");
                                if let Err(e) = delivery
                                    .ack(lapin::options::BasicAckOptions::default())
                                    .await
                                {
                                    error!("Failed to ack message: {}", e);
                                }
                            }
                            Err(e) => {
                                error!("Failed to process message: {}", e);
                                if let Err(e) = delivery
                                    .nack(lapin::options::BasicNackOptions {
                                        requeue: true,
                                        ..Default::default()
                                    })
                                    .await
                                {
                                    error!("Failed to nack message: {}", e);
                                }
                            }
                        }

                        drop(permit);
                    });
                }
                Err(e) => {
                    error!("Failed to parse message: {}", e);
                    if let Err(e) = delivery
                        .ack(lapin::options::BasicAckOptions::default())
                        .await
                    {
                        error!("Failed to ack invalid message: {}", e);
                    }
                }
            },
            Err(e) => {
                error!("Consumer error: {}", e);
                return Err(anyhow::anyhow!("Consumer stream error: {}", e));
            }
        }
    }

    Ok(())
}

const MAX_PROCESS_RETRIES: u32 = 3;
const RETRY_BASE_DELAY_MS: u64 = 500;

async fn process_message(
    message: AggregationMessage,
    job_manager: Arc<JobManager>,
    processor: Arc<AggregationProcessor>,
    cache: &RedisCache,
    account_cache_ttl: Duration,
    snapshot_repo: &SnapshotRepository,
) -> Result<()> {
    let cache_key = format!(
        "{}:{}",
        message.account.to_lowercase(),
        message.chain.to_lowercase()
    );

    let cached: Option<Vec<AggregationResult>> = cache
        .get(AGGREGATION_CACHE_PREFIX, &cache_key)
        .await
        .ok()
        .flatten();

    if let Some(cached_results) = cached {
        info!(
            "Job {}: Cache HIT for {}/{} ({} results)",
            message.job_id,
            message.account,
            message.chain,
            cached_results.len()
        );

        let operations: Vec<OperationStatus> = cached_results
            .iter()
            .map(|r| r.protocol.as_str())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .map(|proto| OperationStatus::success(&message.account, &message.chain, proto))
            .collect();

        let result_count = cached_results.len();
        let total_value: f64 = cached_results.iter().map(|r| r.value_usd).sum();

        for result in cached_results {
            job_manager.add_result(&message.job_id, &result).await?;
        }
        job_manager
            .add_operations(&message.job_id, &operations)
            .await?;
        job_manager
            .increment_counters(&message.job_id, 1, 0, 0)
            .await?;

        info!(
            "Job {}: Added {} results for {}/{} - total value: ${:.2}",
            message.job_id, result_count, message.account, message.chain, total_value
        );
    } else {
        info!(
            "Job {}: Cache MISS for {}/{}, fetching from chain",
            message.job_id, message.account, message.chain
        );

        let mut last_err = None;
        let mut succeeded = false;

        for attempt in 1..=MAX_PROCESS_RETRIES {
            match processor
                .process(&message.account, &message.chain, message.job_id)
                .await
            {
                Ok(output) => {
                    if let Err(e) = cache
                        .set(
                            AGGREGATION_CACHE_PREFIX,
                            &cache_key,
                            &output.results,
                            Some(account_cache_ttl),
                        )
                        .await
                    {
                        warn!(
                            "Failed to cache results for {}/{}: {}",
                            message.account, message.chain, e
                        );
                    }

                    let result_count = output.results.len();
                    let total_value: f64 = output.results.iter().map(|r| r.value_usd).sum();

                    for result in output.results {
                        job_manager.add_result(&message.job_id, &result).await?;
                    }
                    job_manager
                        .add_operations(&message.job_id, &output.operations)
                        .await?;
                    job_manager
                        .increment_counters(&message.job_id, 1, 0, 0)
                        .await?;

                    info!(
                        "Job {}: Added {} results for {}/{} - total value: ${:.2}",
                        message.job_id, result_count, message.account, message.chain, total_value
                    );
                    succeeded = true;
                    break;
                }
                Err(e) => {
                    if attempt < MAX_PROCESS_RETRIES {
                        let delay = RETRY_BASE_DELAY_MS * attempt as u64;
                        warn!(
                            "Job {}: Attempt {}/{} failed for {}/{}: {} — retrying in {}ms",
                            message.job_id,
                            attempt,
                            MAX_PROCESS_RETRIES,
                            message.account,
                            message.chain,
                            e,
                            delay
                        );
                        tokio::time::sleep(Duration::from_millis(delay)).await;
                    }
                    last_err = Some(e);
                }
            }
        }

        if !succeeded {
            warn!(
                "Job {}: All {} attempts failed for {}/{}: {}",
                message.job_id,
                MAX_PROCESS_RETRIES,
                message.account,
                message.chain,
                last_err.as_ref().map(|e| e.to_string()).unwrap_or_default()
            );
            job_manager
                .increment_counters(&message.job_id, 0, 1, 0)
                .await?;
        }
    }

    check_job_completion(&message.job_id, &job_manager, snapshot_repo).await?;

    Ok(())
}

async fn check_job_completion(
    job_id: &Uuid,
    job_manager: &JobManager,
    snapshot_repo: &SnapshotRepository,
) -> Result<()> {
    if let Some(snapshot) = job_manager.get_snapshot(job_id).await? {
        let total_processed = snapshot.succeeded + snapshot.failed + snapshot.timed_out;

        info!(
            "Job {} progress: {}/{} (succeeded: {}, failed: {}, timed_out: {})",
            job_id,
            total_processed,
            snapshot.expected_total,
            snapshot.succeeded,
            snapshot.failed,
            snapshot.timed_out
        );

        if total_processed >= snapshot.expected_total {
            let final_status = if snapshot.succeeded == snapshot.expected_total {
                JobStatus::Completed
            } else if snapshot.succeeded > 0 {
                JobStatus::Completed
            } else {
                JobStatus::Failed
            };

            job_manager
                .update_job_status(job_id, final_status.clone())
                .await?;

            job_manager.mark_final(job_id).await?;

            info!(
                "Job {} completed with status {:?} - Total value: ${:.2}",
                job_id, final_status, snapshot.total_value_usd
            );

            if let Some(wg_id) = snapshot.wallet_group_id {
                if snapshot.succeeded > 0 {
                    save_daily_snapshot(wg_id, &snapshot.results, snapshot_repo).await;
                }
            }
        }
    }

    Ok(())
}

async fn save_daily_snapshot(
    wallet_group_id: Uuid,
    results: &[AggregationResult],
    snapshot_repo: &SnapshotRepository,
) {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let daily_snapshot = DailySnapshot::from_results(wallet_group_id, &today, results);

    if let Err(e) = snapshot_repo.upsert_snapshot(&daily_snapshot).await {
        error!(
            "Failed to save daily snapshot for wallet group {}: {}",
            wallet_group_id, e
        );
        return;
    }

    info!(
        "Saved daily snapshot for wallet group {} - date: {}, value: ${:.2}",
        wallet_group_id, today, daily_snapshot.total_value_usd
    );

    let previous = match snapshot_repo
        .get_analytics(&wallet_group_id, &yesterday(&today))
        .await
    {
        Ok(p) => p,
        Err(e) => {
            warn!("Failed to fetch previous analytics: {}", e);
            None
        }
    };

    let first_snapshot = match snapshot_repo.get_first_snapshot(&wallet_group_id).await {
        Ok(f) => f,
        Err(e) => {
            warn!("Failed to fetch first snapshot: {}", e);
            None
        }
    };

    let recent_totals = match snapshot_repo.get_recent_totals(&wallet_group_id, 8).await {
        Ok(t) => t,
        Err(e) => {
            warn!("Failed to fetch recent totals: {}", e);
            vec![]
        }
    };

    let analytics = compute_analytics(
        &daily_snapshot,
        previous.as_ref(),
        first_snapshot.as_ref(),
        &recent_totals,
    );

    if let Err(e) = snapshot_repo.upsert_analytics(&analytics).await {
        error!(
            "Failed to save portfolio analytics for wallet group {}: {}",
            wallet_group_id, e
        );
        return;
    }

    info!(
        "Saved portfolio analytics for wallet group {} - P&L: ${:.2} ({:.2}%)",
        wallet_group_id, analytics.daily_pnl, analytics.daily_pnl_percent
    );
}

fn yesterday(date: &str) -> String {
    if let Ok(d) = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d") {
        (d - chrono::Duration::days(1))
            .format("%Y-%m-%d")
            .to_string()
    } else {
        String::new()
    }
}

const SWEEP_CACHE_PREFIX: &str = "sweep_snapshot";
const SWEEP_CACHE_TTL: Duration = Duration::from_secs(6 * 3600);

async fn daily_sweep_loop(
    snapshot_repo: &SnapshotRepository,
    processor: &AggregationProcessor,
    cache: &RedisCache,
    wg_repo: &WalletGroupRepository,
) {
    info!("Daily snapshot sweep task started");

    loop {
        let now = chrono::Utc::now();
        let tomorrow = (now + chrono::Duration::days(1))
            .date_naive()
            .and_hms_opt(0, 30, 0)
            .unwrap();
        let sleep_duration = (tomorrow - now.naive_utc())
            .to_std()
            .unwrap_or(Duration::from_secs(3600));

        info!(
            "Next daily sweep scheduled at {} UTC (in {:.1}h)",
            tomorrow,
            sleep_duration.as_secs_f64() / 3600.0
        );

        tokio::time::sleep(sleep_duration).await;

        info!("Running daily snapshot sweep...");
        if let Err(e) = run_daily_sweep(
            snapshot_repo,
            processor,
            cache,
            wg_repo as &dyn WalletGroupRepositoryTrait,
        )
        .await
        {
            error!("Daily sweep failed: {}", e);
        }
    }
}

async fn run_daily_sweep(
    snapshot_repo: &SnapshotRepository,
    processor: &AggregationProcessor,
    cache: &RedisCache,
    wg_repo: &dyn WalletGroupRepositoryTrait,
) -> Result<()> {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let all_groups = wg_repo
        .list(None)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to list wallet groups: {}", e))?;

    if all_groups.is_empty() {
        info!("No wallet groups found, skipping sweep");
        return Ok(());
    }

    let existing_ids: HashSet<String> = snapshot_repo
        .get_wallet_group_ids_with_snapshot(&today)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to get existing snapshots: {}", e))?
        .into_iter()
        .collect();

    let missing: Vec<_> = all_groups
        .into_iter()
        .filter(|wg| !existing_ids.contains(&wg.id.to_string()))
        .collect();

    if missing.is_empty() {
        info!("All wallet groups already have snapshots for today");
        return Ok(());
    }

    info!("Sweep: {} wallet groups need snapshots", missing.len());

    let default_chains = vec![
        "ethereum".to_string(),
        "base".to_string(),
        "arbitrum".to_string(),
        "bnb".to_string(),
        "solana".to_string(),
    ];

    let mut unique_pairs: HashSet<(String, String)> = HashSet::new();
    for wg in &missing {
        for account in &wg.wallets {
            for chain in &default_chains {
                if defi10_core::is_chain_compatible(account, chain) {
                    unique_pairs.insert((account.to_lowercase(), chain.clone()));
                }
            }
        }
    }

    info!(
        "Sweep: {} unique account×chain pairs to process (from {} wallet groups)",
        unique_pairs.len(),
        missing.len()
    );

    let sweep_date_prefix = format!("{}:{}", today, SWEEP_CACHE_PREFIX);
    let mut processed = 0u32;
    let mut cached_hits = 0u32;
    let mut failures = 0u32;

    for (account, chain) in &unique_pairs {
        let cache_key = format!("{}:{}", account, chain);

        let cached: Option<Vec<AggregationResult>> = cache
            .get(&sweep_date_prefix, &cache_key)
            .await
            .ok()
            .flatten();

        if cached.is_some() {
            cached_hits += 1;
            continue;
        }

        match processor.process(account, chain, Uuid::nil()).await {
            Ok(output) => {
                if let Err(e) = cache
                    .set(
                        &sweep_date_prefix,
                        &cache_key,
                        &output.results,
                        Some(SWEEP_CACHE_TTL),
                    )
                    .await
                {
                    warn!("Sweep: failed to cache {}/{}: {}", account, chain, e);
                }
                processed += 1;
            }
            Err(e) => {
                warn!("Sweep: failed to process {}/{}: {}", account, chain, e);
                failures += 1;
            }
        }
    }

    info!(
        "Sweep: account processing done - processed: {}, cache hits: {}, failures: {}",
        processed, cached_hits, failures
    );

    let mut snapshots_saved = 0u32;
    for wg in &missing {
        let mut wg_results: Vec<AggregationResult> = Vec::new();

        for account in &wg.wallets {
            for chain in &default_chains {
                if !defi10_core::is_chain_compatible(account, chain) {
                    continue;
                }

                let cache_key = format!("{}:{}", account.to_lowercase(), chain);
                let cached: Option<Vec<AggregationResult>> = cache
                    .get(&sweep_date_prefix, &cache_key)
                    .await
                    .ok()
                    .flatten();

                if let Some(results) = cached {
                    wg_results.extend(results);
                }
            }
        }

        if wg_results.is_empty() {
            warn!(
                "Sweep: no results for wallet group {}, skipping snapshot",
                wg.id
            );
            continue;
        }

        save_daily_snapshot(wg.id, &wg_results, snapshot_repo).await;
        snapshots_saved += 1;
    }

    info!(
        "Sweep completed: {} snapshots saved for {} wallet groups",
        snapshots_saved,
        missing.len()
    );
    Ok(())
}
