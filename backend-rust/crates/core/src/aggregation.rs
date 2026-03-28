use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    TimedOut,
}

impl fmt::Display for JobStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            JobStatus::Pending => write!(f, "pending"),
            JobStatus::Processing => write!(f, "processing"),
            JobStatus::Completed => write!(f, "completed"),
            JobStatus::Failed => write!(f, "failed"),
            JobStatus::TimedOut => write!(f, "timedOut"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AggregationJob {
    pub job_id: Uuid,
    pub status: JobStatus,
    pub wallets: Vec<String>,
    pub chains: Vec<String>,
    pub wallet_group_id: Option<Uuid>,
    pub expected_total: u32,
    pub succeeded: u32,
    pub failed: u32,
    pub timed_out: u32,
    pub processed_count: u32,
    pub is_final: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

fn is_evm_address(address: &str) -> bool {
    address.starts_with("0x") && address.len() == 42
}

fn is_solana_address(address: &str) -> bool {
    !address.starts_with("0x")
        && address.len() >= 32
        && address.len() <= 44
        && address
            .chars()
            .all(|c| c.is_ascii_alphanumeric() && c != '0' && c != 'O' && c != 'I' && c != 'l')
}

pub fn is_chain_compatible(account: &str, chain: &str) -> bool {
    match chain {
        "solana" => is_solana_address(account),
        "ethereum" | "base" | "arbitrum" | "bnb" | "polygon" | "optimism" | "avalanche" => {
            is_evm_address(account)
        }
        _ => true,
    }
}

impl AggregationJob {
    pub fn new(wallets: Vec<String>, chains: Vec<String>, wallet_group_id: Option<Uuid>) -> Self {
        let expected: u32 = wallets
            .iter()
            .flat_map(|account| {
                chains
                    .iter()
                    .filter(move |chain| is_chain_compatible(account, chain))
            })
            .count() as u32;
        let now = Utc::now();
        let expires_at = now + chrono::Duration::hours(24);

        Self {
            job_id: Uuid::new_v4(),
            status: JobStatus::Pending,
            wallets,
            chains,
            wallet_group_id,
            expected_total: expected,
            succeeded: 0,
            failed: 0,
            timed_out: 0,
            processed_count: 0,
            is_final: false,
            created_at: now,
            updated_at: now,
            expires_at: Some(expires_at),
        }
    }

    pub fn is_active(&self) -> bool {
        !self.is_final && matches!(self.status, JobStatus::Pending | JobStatus::Processing)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AggregationResult {
    pub account: String,
    pub chain: String,
    pub protocol: String,
    pub position_type: String,
    pub balance: f64,
    pub balance_raw: String,
    pub decimals: u8,
    pub value_usd: f64,
    pub price_usd: f64,
    pub token_symbol: String,
    pub token_name: String,
    pub token_address: String,
    pub timestamp: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub apy: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub apr: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub apr_historical: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health_factor: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_collateral: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub can_be_collateral: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobSnapshot {
    pub job_id: Uuid,
    pub status: JobStatus,
    pub wallets: Vec<String>,
    pub chains: Vec<String>,
    pub wallet_group_id: Option<Uuid>,
    pub expected_total: u32,
    pub succeeded: u32,
    pub failed: u32,
    pub timed_out: u32,
    pub processed_count: u32,
    pub is_final: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_in_seconds: Option<i64>,
    pub active: bool,
    pub results: Vec<AggregationResult>,
    pub total_value_usd: f64,
    pub operations: Vec<OperationStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum OperationOutcome {
    Success,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationStatus {
    pub account: String,
    pub chain: String,
    pub protocol: String,
    pub status: OperationOutcome,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

impl OperationStatus {
    pub fn success(account: &str, chain: &str, protocol: &str) -> Self {
        Self {
            account: account.to_string(),
            chain: chain.to_string(),
            protocol: protocol.to_string(),
            status: OperationOutcome::Success,
            error: None,
            duration_ms: None,
        }
    }

    pub fn failed(account: &str, chain: &str, protocol: &str, error: &str) -> Self {
        Self {
            account: account.to_string(),
            chain: chain.to_string(),
            protocol: protocol.to_string(),
            status: OperationOutcome::Failed,
            error: Some(error.to_string()),
            duration_ms: None,
        }
    }

    pub fn skipped(account: &str, chain: &str, protocol: &str) -> Self {
        Self {
            account: account.to_string(),
            chain: chain.to_string(),
            protocol: protocol.to_string(),
            status: OperationOutcome::Skipped,
            error: None,
            duration_ms: None,
        }
    }

    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_job_creation() {
        let wallets = vec!["0x1234567890AbcdEF1234567890aBcDeF12345678".to_string()];
        let chains = vec!["ethereum".to_string(), "base".to_string()];
        let job = AggregationJob::new(wallets.clone(), chains.clone(), None);

        assert_eq!(job.wallets, wallets);
        assert_eq!(job.chains, chains);
        assert_eq!(job.expected_total, 2);
        assert_eq!(job.status, JobStatus::Pending);
        assert!(job.is_active());
    }

    #[test]
    fn test_job_status_serialization() {
        let status = JobStatus::Completed;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"completed\"");
    }

    #[test]
    fn test_job_is_active() {
        let mut job = AggregationJob::new(
            vec!["0x123".to_string()],
            vec!["ethereum".to_string()],
            None,
        );
        assert!(job.is_active());

        job.is_final = true;
        assert!(!job.is_active());

        job.is_final = false;
        job.status = JobStatus::Completed;
        assert!(!job.is_active());
    }
}
