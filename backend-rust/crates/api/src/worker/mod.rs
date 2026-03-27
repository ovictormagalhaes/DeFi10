mod processor;

use anyhow::Result;
use defi10_core::aggregation::{AggregationResult, JobStatus};
use defi10_infrastructure::{
    aggregation::{AggregationMessage, JobManager},
    cache::{CacheService, RedisCache, AGGREGATION_CACHE_PREFIX},
    config::AppConfig,
    messaging::RabbitMqConnection,
};
use futures_util::stream::StreamExt;
use lapin::ExchangeKind;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};
use uuid::Uuid;

pub use processor::AggregationProcessor;

/// Start the aggregation worker in background
pub async fn start_worker(config: AppConfig) -> Result<()> {
    info!("Starting aggregation worker...");

    // Connect to RabbitMQ
    let rabbitmq = RabbitMqConnection::new(&config.rabbitmq.url).await?;
    info!("Worker: Connected to RabbitMQ");

    // Declare exchange and queue
    let exchange = "aggregation.requests";
    let queue = "aggregation.queue";

    rabbitmq
        .declare_exchange(exchange, ExchangeKind::Topic, true)
        .await?;
    info!("Worker: Exchange '{}' declared", exchange);

    rabbitmq.declare_queue(queue, true).await?;
    info!("Worker: Queue '{}' declared", queue);

    // Bind queue to exchange with routing key pattern
    rabbitmq
        .bind_queue(queue, exchange, "aggregation.*")
        .await?;
    info!("Worker: Queue bound to exchange with pattern 'aggregation.*'");

    // Create job manager
    let job_manager = Arc::new(JobManager::new(&config.redis.url)?);
    info!("Worker: Job manager initialized");

    let processor = Arc::new(AggregationProcessor::new(config.clone()));
    info!("Worker: Processor initialized");

    let cache = RedisCache::new(&config.redis.url, config.redis.default_ttl_seconds)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to create Redis cache: {}", e))?;
    let account_cache_ttl = Duration::from_secs(config.redis.account_cache_ttl_seconds);
    info!(
        "Worker: Account cache initialized (TTL={}s)",
        config.redis.account_cache_ttl_seconds
    );

    let channel = rabbitmq.create_channel().await?;
    let mut consumer = channel
        .basic_consume(
            queue,
            "defi10-worker",
            lapin::options::BasicConsumeOptions::default(),
            lapin::types::FieldTable::default(),
        )
        .await?;

    info!(
        "Worker: Starting message consumption from queue '{}'...",
        queue
    );

    // Consume messages
    while let Some(delivery) = consumer.next().await {
        match delivery {
            Ok(delivery) => {
                // Parse message
                match serde_json::from_slice::<AggregationMessage>(&delivery.data) {
                    Ok(message) => {
                        info!(
                            "Worker: Processing job {} for account {} on chain {}",
                            message.job_id, message.account, message.chain
                        );

                        let job_manager = Arc::clone(&job_manager);
                        let processor = Arc::clone(&processor);
                        let mut cache_clone = cache.clone();

                        match process_message(
                            message,
                            job_manager,
                            processor,
                            &mut cache_clone,
                            account_cache_ttl,
                        )
                        .await
                        {
                            Ok(_) => {
                                info!("Worker: Message processed successfully");
                                // Ack message
                                if let Err(e) = delivery
                                    .ack(lapin::options::BasicAckOptions::default())
                                    .await
                                {
                                    error!("Worker: Failed to ack message: {}", e);
                                }
                            }
                            Err(e) => {
                                error!("Worker: Failed to process message: {}", e);
                                // Nack and requeue
                                if let Err(e) = delivery
                                    .nack(lapin::options::BasicNackOptions {
                                        requeue: true,
                                        ..Default::default()
                                    })
                                    .await
                                {
                                    error!("Worker: Failed to nack message: {}", e);
                                }
                            }
                        }
                    }
                    Err(e) => {
                        error!("Worker: Failed to parse message: {}", e);
                        // Ack invalid message to remove from queue
                        if let Err(e) = delivery
                            .ack(lapin::options::BasicAckOptions::default())
                            .await
                        {
                            error!("Worker: Failed to ack invalid message: {}", e);
                        }
                    }
                }
            }
            Err(e) => {
                error!("Worker: Consumer error: {}", e);
                break;
            }
        }
    }

    Ok(())
}

async fn process_message(
    message: AggregationMessage,
    job_manager: Arc<JobManager>,
    processor: Arc<AggregationProcessor>,
    cache: &mut RedisCache,
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

    let agg_results = if let Some(cached_results) = cached {
        info!(
            "Worker: Job {}: Cache HIT for {}/{} ({} results)",
            message.job_id,
            message.account,
            message.chain,
            cached_results.len()
        );
        Ok(cached_results)
    } else {
        info!(
            "Worker: Job {}: Cache MISS for {}/{}, fetching from chain",
            message.job_id, message.account, message.chain
        );
        let results = processor
            .process(&message.account, &message.chain, message.job_id)
            .await;

        if let Ok(ref r) = results {
            if let Err(e) = cache
                .set(
                    AGGREGATION_CACHE_PREFIX,
                    &cache_key,
                    r,
                    Some(account_cache_ttl),
                )
                .await
            {
                warn!(
                    "Failed to cache results for {}/{}: {}",
                    message.account, message.chain, e
                );
            }
        }
        results
    };

    match agg_results {
        Ok(agg_results) => {
            let result_count = agg_results.len();
            let total_value: f64 = agg_results.iter().map(|r| r.value_usd).sum();

            for result in agg_results {
                job_manager.add_result(&message.job_id, &result)?;
            }

            job_manager.increment_counters(&message.job_id, 1, 0, 0)?;

            info!(
                "Worker: Job {}: Added {} results for {}/{} - total value: ${:.2}",
                message.job_id, result_count, message.account, message.chain, total_value
            );
        }
        Err(e) => {
            warn!(
                "Worker: Job {}: Failed to process {}/{}: {}",
                message.job_id, message.account, message.chain, e
            );

            job_manager.increment_counters(&message.job_id, 0, 1, 0)?;
        }
    }

    check_job_completion(&message.job_id, &job_manager).await?;

    Ok(())
}

async fn check_job_completion(job_id: &Uuid, job_manager: &JobManager) -> Result<()> {
    if let Some(snapshot) = job_manager.get_snapshot(job_id)? {
        let total_processed = snapshot.succeeded + snapshot.failed + snapshot.timed_out;

        info!(
            "Worker: Job {} progress: {}/{} (succeeded: {}, failed: {}, timed_out: {})",
            job_id,
            total_processed,
            snapshot.expected_total,
            snapshot.succeeded,
            snapshot.failed,
            snapshot.timed_out
        );

        if total_processed >= snapshot.expected_total {
            let final_status = if snapshot.succeeded > 0 {
                JobStatus::Completed
            } else {
                JobStatus::Failed
            };

            job_manager.update_job_status(job_id, final_status.clone())?;
            job_manager.mark_final(job_id)?;

            info!(
                "Worker: Job {} completed with status {:?} - Total value: ${:.2}",
                job_id, final_status, snapshot.total_value_usd
            );
        }
    }

    Ok(())
}
