use anyhow::Result;
use defi10_core::aggregation::{AggregationResult, JobStatus, OperationStatus};
use defi10_infrastructure::{
    aggregation::{AggregationMessage, JobManager},
    cache::{CacheService, RedisCache, AGGREGATION_CACHE_PREFIX},
    config::load_config,
    init_tracing_with_newrelic,
    messaging::RabbitMqConnection,
};
use futures_util::stream::StreamExt;
use lapin::ExchangeKind;
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

    loop {
        match run_consumer(
            &config,
            &job_manager,
            &processor,
            &cache,
            account_cache_ttl,
        )
        .await
        {
            Ok(_) => {
                warn!("Consumer stream ended, reconnecting...");
                consecutive_failures = 0;
            }
            Err(e) => {
                consecutive_failures += 1;
                error!(
                    "Consumer failed (attempt {}): {}",
                    consecutive_failures, e
                );
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
        job_manager.add_operations(&message.job_id, &operations).await?;
        job_manager.increment_counters(&message.job_id, 1, 0, 0).await?;

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
                    job_manager.add_operations(&message.job_id, &output.operations).await?;
                    job_manager.increment_counters(&message.job_id, 1, 0, 0).await?;

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
                            message.job_id, attempt, MAX_PROCESS_RETRIES,
                            message.account, message.chain, e, delay
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
                message.job_id, MAX_PROCESS_RETRIES,
                message.account, message.chain,
                last_err.as_ref().map(|e| e.to_string()).unwrap_or_default()
            );
            job_manager.increment_counters(&message.job_id, 0, 1, 0).await?;
        }
    }

    check_job_completion(&message.job_id, &job_manager).await?;

    Ok(())
}

async fn check_job_completion(job_id: &Uuid, job_manager: &JobManager) -> Result<()> {
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

            job_manager.update_job_status(job_id, final_status.clone()).await?;

            job_manager.mark_final(job_id).await?;

            info!(
                "Job {} completed with status {:?} - Total value: ${:.2}",
                job_id, final_status, snapshot.total_value_usd
            );
        }
    }

    Ok(())
}
