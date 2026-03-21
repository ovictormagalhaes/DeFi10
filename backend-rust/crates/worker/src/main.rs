use anyhow::Result;
use defi10_core::aggregation::JobStatus;
use defi10_infrastructure::{
    aggregation::{AggregationMessage, JobManager},
    config::load_config,
    messaging::RabbitMqConnection,
};
use futures_util::stream::StreamExt;
use lapin::ExchangeKind;
use std::sync::Arc;
use tracing::{error, info, warn};
use uuid::Uuid;

mod processor;
use processor::AggregationProcessor;

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env file
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .with_thread_ids(true)
        .init();

    info!("Starting DeFi10 Aggregation Worker...");

    // Load configuration from environment and config files
    let config = load_config().expect("Failed to load configuration");

    // Log blockchain configuration for debugging
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

    // Connect to RabbitMQ
    let rabbitmq = RabbitMqConnection::new(&config.rabbitmq.url).await?;
    info!("Connected to RabbitMQ");

    // Declare exchange and queue
    let exchange = "aggregation.requests";
    let queue = "aggregation.queue";

    rabbitmq
        .declare_exchange(exchange, ExchangeKind::Topic, true)
        .await?;
    info!("Exchange '{}' declared", exchange);

    rabbitmq.declare_queue(queue, true).await?;
    info!("Queue '{}' declared", queue);

    // Bind queue to exchange with routing key pattern
    rabbitmq
        .bind_queue(queue, exchange, "aggregation.*")
        .await?;
    info!("Queue bound to exchange with pattern 'aggregation.*'");

    // Create job manager
    let job_manager = Arc::new(JobManager::new(&config.redis.url)?);
    info!("Job manager initialized");

    // Create processor
    let processor = Arc::new(AggregationProcessor::new(config.clone()));
    info!("Processor initialized");

    // Get channel and create consumer
    let channel = rabbitmq.create_channel().await?;
    let mut consumer = channel
        .basic_consume(
            queue,
            "defi10-worker",
            lapin::options::BasicConsumeOptions::default(),
            lapin::types::FieldTable::default(),
        )
        .await?;

    info!("Starting message consumption from queue '{}'...", queue);

    // Consume messages
    while let Some(delivery) = consumer.next().await {
        match delivery {
            Ok(delivery) => {
                // Parse message
                match serde_json::from_slice::<AggregationMessage>(&delivery.data) {
                    Ok(message) => {
                        info!(
                            "Processing job {} for account {} on chain {}",
                            message.job_id, message.account, message.chain
                        );

                        let job_manager = Arc::clone(&job_manager);
                        let processor = Arc::clone(&processor);

                        // Process message
                        match process_message(message, job_manager, processor).await {
                            Ok(_) => {
                                info!("Message processed successfully");
                                // Ack message
                                if let Err(e) = delivery
                                    .ack(lapin::options::BasicAckOptions::default())
                                    .await
                                {
                                    error!("Failed to ack message: {}", e);
                                }
                            }
                            Err(e) => {
                                error!("Failed to process message: {}", e);
                                // Nack and requeue
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
                    }
                    Err(e) => {
                        error!("Failed to parse message: {}", e);
                        // Ack invalid message to remove from queue
                        if let Err(e) = delivery
                            .ack(lapin::options::BasicAckOptions::default())
                            .await
                        {
                            error!("Failed to ack invalid message: {}", e);
                        }
                    }
                }
            }
            Err(e) => {
                error!("Consumer error: {}", e);
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
) -> Result<()> {
    // Process the aggregation
    let results = processor
        .process(&message.account, &message.chain, message.job_id)
        .await;

    match results {
        Ok(agg_results) => {
            // Add each result to job
            let result_count = agg_results.len();
            let total_value: f64 = agg_results.iter().map(|r| r.value_usd).sum();

            for result in agg_results {
                job_manager.add_result(&message.job_id, &result)?;
            }

            // Increment succeeded counter
            job_manager.increment_counters(&message.job_id, 1, 0, 0)?;

            info!(
                "Job {}: Added {} results for {}/{} - total value: ${:.2}",
                message.job_id, result_count, message.account, message.chain, total_value
            );
        }
        Err(e) => {
            warn!(
                "Job {}: Failed to process {}/{}: {}",
                message.job_id, message.account, message.chain, e
            );

            // Increment failed counter
            job_manager.increment_counters(&message.job_id, 0, 1, 0)?;
        }
    }

    // Check if job is complete
    check_job_completion(&message.job_id, &job_manager).await?;

    Ok(())
}

async fn check_job_completion(job_id: &Uuid, job_manager: &JobManager) -> Result<()> {
    // Get job snapshot
    if let Some(snapshot) = job_manager.get_snapshot(job_id)? {
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

        // Check if all tasks are processed
        if total_processed >= snapshot.expected_total {
            // Determine final status
            let final_status = if snapshot.succeeded == snapshot.expected_total {
                JobStatus::Completed
            } else if snapshot.succeeded > 0 {
                JobStatus::Completed // Partial success
            } else {
                JobStatus::Failed
            };

            // Update job status
            job_manager.update_job_status(job_id, final_status.clone())?;

            // Mark as final
            job_manager.mark_final(job_id)?;

            info!(
                "Job {} completed with status {:?} - Total value: ${:.2}",
                job_id, final_status, snapshot.total_value_usd
            );
        }
    }

    Ok(())
}
