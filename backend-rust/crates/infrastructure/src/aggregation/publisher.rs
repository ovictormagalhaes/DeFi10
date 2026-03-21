use crate::messaging::MessagePublisher;
use defi10_core::{is_chain_compatible, DeFi10Error, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AggregationMessage {
    pub job_id: Uuid,
    pub account: String,
    pub chain: String,
    pub wallet_group_id: Option<Uuid>,
}

pub struct AggregationPublisher {
    publisher: MessagePublisher,
    exchange: String,
}

impl AggregationPublisher {
    pub fn new(publisher: MessagePublisher, exchange: Option<String>) -> Self {
        Self {
            publisher,
            exchange: exchange.unwrap_or_else(|| "aggregation.requests".to_string()),
        }
    }

    /// Publish a job to RabbitMQ
    /// Creates one message per account-chain combination
    pub async fn publish_job(
        &self,
        job_id: Uuid,
        accounts: &[String],
        chains: &[String],
        wallet_group_id: Option<Uuid>,
    ) -> Result<usize> {
        let mut published = 0;

        for account in accounts {
            for chain in chains {
                if !is_chain_compatible(account, chain) {
                    tracing::debug!(
                        "Skipping incompatible account-chain combination: {} on {}",
                        account,
                        chain
                    );
                    continue;
                }

                let message = AggregationMessage {
                    job_id,
                    account: account.clone(),
                    chain: chain.clone(),
                    wallet_group_id,
                };

                let routing_key = format!("aggregation.{}", chain);

                self.publisher
                    .publish(&self.exchange, &routing_key, &message)
                    .await
                    .map_err(|e| {
                        DeFi10Error::Internal(format!(
                            "Failed to publish aggregation message for {}/{}: {}",
                            account, chain, e
                        ))
                    })?;

                published += 1;
            }
        }

        Ok(published)
    }

    /// Publish a single message (for retries or specific processing)
    pub async fn publish_single(
        &self,
        job_id: Uuid,
        account: &str,
        chain: &str,
        wallet_group_id: Option<Uuid>,
    ) -> Result<()> {
        let message = AggregationMessage {
            job_id,
            account: account.to_string(),
            chain: chain.to_string(),
            wallet_group_id,
        };

        let routing_key = format!("aggregation.{}", chain);

        self.publisher
            .publish(&self.exchange, &routing_key, &message)
            .await
            .map_err(|e| {
                DeFi10Error::Internal(format!(
                    "Failed to publish message for {}/{}: {}",
                    account, chain, e
                ))
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_serialization() {
        let job_id = Uuid::new_v4();
        let message = AggregationMessage {
            job_id,
            account: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0".to_string(),
            chain: "ethereum".to_string(),
            wallet_group_id: None,
        };

        let json = serde_json::to_string(&message).unwrap();
        assert!(json.contains("jobId"));
        assert!(json.contains("account"));
        assert!(json.contains("chain"));
    }
}
