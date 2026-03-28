use defi10_core::{DeFi10Error, Result};
use lapin::{
    options::*, types::FieldTable, Channel, Connection, ConnectionProperties, Consumer,
    ExchangeKind,
};
use serde::{de::DeserializeOwned, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

const MAX_RETRIES: u32 = 3;

#[derive(Clone)]
pub struct RabbitMqConnection {
    url: String,
    connection: Arc<RwLock<Connection>>,
    channel: Arc<RwLock<Channel>>,
}

impl RabbitMqConnection {
    pub async fn new(url: &str) -> Result<Self> {
        let connection = Self::connect(url).await?;
        let channel = connection
            .create_channel()
            .await
            .map_err(|e| DeFi10Error::Internal(format!("Failed to create channel: {}", e)))?;

        Ok(Self {
            url: url.to_string(),
            connection: Arc::new(RwLock::new(connection)),
            channel: Arc::new(RwLock::new(channel)),
        })
    }

    async fn connect(url: &str) -> Result<Connection> {
        Connection::connect(url, ConnectionProperties::default())
            .await
            .map_err(|e| DeFi10Error::Internal(format!("Failed to connect to RabbitMQ: {}", e)))
    }

    async fn ensure_connected(&self) -> Result<()> {
        let connected = {
            let conn = self.connection.read().await;
            conn.status().connected()
        };

        if !connected {
            tracing::info!("RabbitMQ disconnected, reconnecting...");
            let new_conn = Self::connect(&self.url).await?;
            let new_channel = new_conn
                .create_channel()
                .await
                .map_err(|e| DeFi10Error::Internal(format!("Failed to create channel: {}", e)))?;
            *self.connection.write().await = new_conn;
            *self.channel.write().await = new_channel;
            tracing::info!("RabbitMQ reconnected");
        }

        Ok(())
    }

    async fn with_retry<F, Fut, T>(&self, mut f: F) -> Result<T>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T>>,
    {
        let mut last_err = None;
        for attempt in 1..=MAX_RETRIES {
            if attempt > 1 {
                self.ensure_connected().await.ok();
            }
            match f().await {
                Ok(v) => return Ok(v),
                Err(e) => {
                    tracing::warn!("RabbitMQ attempt {}/{} failed: {}", attempt, MAX_RETRIES, e);
                    last_err = Some(e);
                    if attempt < MAX_RETRIES {
                        tokio::time::sleep(std::time::Duration::from_secs(attempt as u64)).await;
                    }
                }
            }
        }
        Err(last_err.unwrap())
    }

    pub async fn create_channel(&self) -> Result<Channel> {
        self.ensure_connected().await?;
        let conn = self.connection.read().await;
        conn.create_channel()
            .await
            .map_err(|e| DeFi10Error::Internal(format!("Failed to create channel: {}", e)))
    }

    pub async fn declare_queue(&self, queue_name: &str, durable: bool) -> Result<()> {
        let qn = queue_name.to_string();
        self.with_retry(|| {
            let qn = qn.clone();
            let channel = self.channel.clone();
            async move {
                let ch = channel.read().await;
                ch.queue_declare(
                    &qn,
                    QueueDeclareOptions {
                        durable,
                        ..Default::default()
                    },
                    FieldTable::default(),
                )
                .await
                .map_err(|e| DeFi10Error::Internal(format!("Failed to declare queue: {}", e)))?;
                Ok(())
            }
        })
        .await
    }

    pub async fn declare_exchange(
        &self,
        exchange_name: &str,
        exchange_kind: ExchangeKind,
        durable: bool,
    ) -> Result<()> {
        self.ensure_connected().await?;
        let channel = self.channel.read().await;
        channel
            .exchange_declare(
                exchange_name,
                exchange_kind,
                ExchangeDeclareOptions {
                    durable,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await
            .map_err(|e| DeFi10Error::Internal(format!("Failed to declare exchange: {}", e)))?;
        Ok(())
    }

    pub async fn bind_queue(
        &self,
        queue_name: &str,
        exchange_name: &str,
        routing_key: &str,
    ) -> Result<()> {
        let qn = queue_name.to_string();
        let en = exchange_name.to_string();
        let rk = routing_key.to_string();
        self.with_retry(|| {
            let qn = qn.clone();
            let en = en.clone();
            let rk = rk.clone();
            let channel = self.channel.clone();
            async move {
                let ch = channel.read().await;
                ch.queue_bind(
                    &qn,
                    &en,
                    &rk,
                    QueueBindOptions::default(),
                    FieldTable::default(),
                )
                .await
                .map_err(|e| DeFi10Error::Internal(format!("Failed to bind queue: {}", e)))?;
                Ok(())
            }
        })
        .await
    }

    pub async fn health_check(&self) -> Result<()> {
        let conn = self.connection.read().await;
        if conn.status().connected() {
            Ok(())
        } else {
            Err(DeFi10Error::Internal(
                "RabbitMQ connection is not healthy".to_string(),
            ))
        }
    }
}

pub struct MessagePublisher {
    connection: RabbitMqConnection,
}

impl MessagePublisher {
    pub fn new(connection: RabbitMqConnection) -> Self {
        Self { connection }
    }

    pub async fn publish<T: Serialize>(
        &self,
        exchange: &str,
        routing_key: &str,
        message: &T,
    ) -> Result<()> {
        let payload = serde_json::to_vec(message)
            .map_err(|e| DeFi10Error::Internal(format!("Failed to serialize message: {}", e)))?;

        let ex = exchange.to_string();
        let rk = routing_key.to_string();
        self.connection
            .with_retry(|| {
                let ex = ex.clone();
                let rk = rk.clone();
                let payload = payload.clone();
                let channel = self.connection.channel.clone();
                async move {
                    let ch = channel.read().await;
                    ch.basic_publish(
                        &ex,
                        &rk,
                        BasicPublishOptions::default(),
                        &payload,
                        lapin::BasicProperties::default(),
                    )
                    .await
                    .map_err(|e| {
                        DeFi10Error::Internal(format!("Failed to publish message: {}", e))
                    })?;
                    Ok(())
                }
            })
            .await
    }

    pub async fn publish_to_queue<T: Serialize>(
        &self,
        queue_name: &str,
        message: &T,
    ) -> Result<()> {
        self.publish("", queue_name, message).await
    }
}

pub struct MessageConsumer {
    connection: RabbitMqConnection,
}

impl MessageConsumer {
    pub fn new(connection: RabbitMqConnection) -> Self {
        Self { connection }
    }

    pub async fn consume(&self, queue_name: &str, consumer_tag: &str) -> Result<Consumer> {
        self.connection.ensure_connected().await?;
        let channel = self.connection.channel.read().await;

        let consumer = channel
            .basic_consume(
                queue_name,
                consumer_tag,
                BasicConsumeOptions::default(),
                FieldTable::default(),
            )
            .await
            .map_err(|e| DeFi10Error::Internal(format!("Failed to consume queue: {}", e)))?;

        Ok(consumer)
    }

    pub async fn ack(&self, delivery_tag: u64) -> Result<()> {
        let channel = self.connection.channel.read().await;

        channel
            .basic_ack(delivery_tag, BasicAckOptions::default())
            .await
            .map_err(|e| DeFi10Error::Internal(format!("Failed to ack message: {}", e)))?;

        Ok(())
    }

    pub async fn nack(&self, delivery_tag: u64, requeue: bool) -> Result<()> {
        let channel = self.connection.channel.read().await;

        channel
            .basic_nack(
                delivery_tag,
                BasicNackOptions {
                    requeue,
                    ..Default::default()
                },
            )
            .await
            .map_err(|e| DeFi10Error::Internal(format!("Failed to nack message: {}", e)))?;

        Ok(())
    }

    pub fn deserialize_message<T: DeserializeOwned>(&self, payload: &[u8]) -> Result<T> {
        serde_json::from_slice(payload)
            .map_err(|e| DeFi10Error::Internal(format!("Failed to deserialize message: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};
    use testcontainers::runners::AsyncRunner;
    use testcontainers_modules::rabbitmq::RabbitMq;
    use tokio_stream::StreamExt;

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestMessage {
        id: String,
        content: String,
    }

    async fn setup_rabbitmq() -> (RabbitMqConnection, testcontainers::ContainerAsync<RabbitMq>) {
        let container = RabbitMq::default()
            .start()
            .await
            .expect("Failed to start RabbitMQ container");

        let port = container
            .get_host_port_ipv4(5672)
            .await
            .expect("Failed to get RabbitMQ port");

        let url = format!("amqp://guest:guest@localhost:{}", port);

        // Retry connection as RabbitMQ takes time to start
        let mut attempts = 0;
        let connection = loop {
            match RabbitMqConnection::new(&url).await {
                Ok(conn) => break conn,
                Err(_) if attempts < 10 => {
                    attempts += 1;
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                }
                Err(e) => panic!("Failed to connect to RabbitMQ: {}", e),
            }
        };

        (connection, container)
    }

    #[tokio::test]
    #[ignore]
    async fn test_rabbitmq_connection() {
        let (connection, _container) = setup_rabbitmq().await;
        assert!(connection.health_check().await.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_declare_queue() {
        let (connection, _container) = setup_rabbitmq().await;

        let result = connection.declare_queue("test_queue", false).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_publish_and_consume() {
        let (connection, _container) = setup_rabbitmq().await;

        let queue_name = "test_publish_consume";
        connection.declare_queue(queue_name, false).await.unwrap();

        let publisher = MessagePublisher::new(connection.clone());
        let consumer_handler = MessageConsumer::new(connection.clone());

        let message = TestMessage {
            id: "123".to_string(),
            content: "Hello RabbitMQ".to_string(),
        };

        publisher
            .publish_to_queue(queue_name, &message)
            .await
            .unwrap();

        let mut consumer = consumer_handler
            .consume(queue_name, "test_consumer")
            .await
            .unwrap();

        // Wait for message
        if let Some(delivery_result) = consumer.next().await {
            let delivery = delivery_result.expect("Failed to get delivery");
            let received: TestMessage = consumer_handler
                .deserialize_message(&delivery.data)
                .unwrap();

            assert_eq!(received, message);

            consumer_handler.ack(delivery.delivery_tag).await.unwrap();
        } else {
            panic!("No message received");
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_exchange_and_routing() {
        let (connection, _container) = setup_rabbitmq().await;

        let exchange_name = "test_exchange";
        let queue_name = "test_routed_queue";
        let routing_key = "test.routing.key";

        connection
            .declare_exchange(exchange_name, ExchangeKind::Direct, false)
            .await
            .unwrap();

        connection.declare_queue(queue_name, false).await.unwrap();

        connection
            .bind_queue(queue_name, exchange_name, routing_key)
            .await
            .unwrap();

        let publisher = MessagePublisher::new(connection.clone());
        let consumer_handler = MessageConsumer::new(connection.clone());

        let message = TestMessage {
            id: "456".to_string(),
            content: "Routed message".to_string(),
        };

        publisher
            .publish(exchange_name, routing_key, &message)
            .await
            .unwrap();

        let mut consumer = consumer_handler
            .consume(queue_name, "test_routing_consumer")
            .await
            .unwrap();

        if let Some(delivery_result) = consumer.next().await {
            let delivery = delivery_result.expect("Failed to get delivery");
            let received: TestMessage = consumer_handler
                .deserialize_message(&delivery.data)
                .unwrap();

            assert_eq!(received, message);
            consumer_handler.ack(delivery.delivery_tag).await.unwrap();
        }
    }

    #[tokio::test]
    #[ignore]
    async fn test_nack_and_requeue() {
        let (connection, _container) = setup_rabbitmq().await;

        let queue_name = "test_nack_queue";
        connection.declare_queue(queue_name, false).await.unwrap();

        let publisher = MessagePublisher::new(connection.clone());
        let consumer_handler = MessageConsumer::new(connection.clone());

        let message = TestMessage {
            id: "789".to_string(),
            content: "Nack test".to_string(),
        };

        publisher
            .publish_to_queue(queue_name, &message)
            .await
            .unwrap();

        let mut consumer = consumer_handler
            .consume(queue_name, "nack_consumer")
            .await
            .unwrap();

        // First delivery - nack with requeue
        if let Some(delivery_result) = consumer.next().await {
            let delivery = delivery_result.expect("Failed to get delivery");
            consumer_handler
                .nack(delivery.delivery_tag, true)
                .await
                .unwrap();
        }

        // Should receive again due to requeue
        if let Some(delivery_result) = consumer.next().await {
            let delivery = delivery_result.expect("Failed to get delivery");
            let received: TestMessage = consumer_handler
                .deserialize_message(&delivery.data)
                .unwrap();

            assert_eq!(received, message);
            consumer_handler.ack(delivery.delivery_tag).await.unwrap();
        }
    }
}
