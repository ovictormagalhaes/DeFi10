use anyhow::Result;
use chrono::Utc;
use defi10_core::aggregation::{AggregationJob, AggregationResult, JobSnapshot, JobStatus};
use redis::Commands;
use serde_json;
use uuid::Uuid;

const KEY_PREFIX: &str = "defi10:agg";
const META_FIELD_STATUS: &str = "status";
const META_FIELD_ACCOUNTS: &str = "accounts";
const META_FIELD_CHAINS: &str = "chains";
const META_FIELD_WALLET_GROUP_ID: &str = "walletGroupId";
const META_FIELD_EXPECTED: &str = "expectedTotal";
const META_FIELD_SUCCEEDED: &str = "succeeded";
const META_FIELD_FAILED: &str = "failed";
const META_FIELD_TIMED_OUT: &str = "timedOut";
const META_FIELD_PROCESSED: &str = "processedCount";
const META_FIELD_FINAL: &str = "finalEmitted";
const META_FIELD_CREATED: &str = "createdAt";
const META_FIELD_UPDATED: &str = "updatedAt";

pub struct JobManager {
    redis: redis::Client,
}

impl JobManager {
    pub fn new(redis_url: &str) -> Result<Self> {
        let redis = redis::Client::open(redis_url)?;
        Ok(Self { redis })
    }

    fn meta_key(&self, job_id: &Uuid) -> String {
        format!("{}:meta:{}", KEY_PREFIX, job_id)
    }

    fn results_key(&self, job_id: &Uuid) -> String {
        format!("{}:results:{}", KEY_PREFIX, job_id)
    }

    pub fn create_job(&self, job: &AggregationJob) -> Result<()> {
        let mut conn = self.redis.get_connection()?;
        let meta_key = self.meta_key(&job.job_id);

        let accounts_json = serde_json::to_string(&job.wallets)?;
        let chains_json = serde_json::to_string(&job.chains)?;
        let wallet_group_id_str = job
            .wallet_group_id
            .map(|id| id.to_string())
            .unwrap_or_default();

        let _: () = conn.hset_multiple(
            &meta_key,
            &[
                (META_FIELD_STATUS, job.status.to_string()),
                (META_FIELD_ACCOUNTS, accounts_json),
                (META_FIELD_CHAINS, chains_json),
                (META_FIELD_WALLET_GROUP_ID, wallet_group_id_str),
                (META_FIELD_EXPECTED, job.expected_total.to_string()),
                (META_FIELD_SUCCEEDED, job.succeeded.to_string()),
                (META_FIELD_FAILED, job.failed.to_string()),
                (META_FIELD_TIMED_OUT, job.timed_out.to_string()),
                (META_FIELD_PROCESSED, job.processed_count.to_string()),
                (
                    META_FIELD_FINAL,
                    if job.is_final { "1" } else { "0" }.to_string(),
                ),
                (META_FIELD_CREATED, job.created_at.to_rfc3339()),
                (META_FIELD_UPDATED, job.updated_at.to_rfc3339()),
            ],
        )?;

        // Set TTL (24 hours)
        let _: () = conn.expire(&meta_key, 86400)?;

        Ok(())
    }

    pub fn get_job(&self, job_id: &Uuid) -> Result<Option<AggregationJob>> {
        let mut conn = self.redis.get_connection()?;
        let meta_key = self.meta_key(job_id);

        let exists: bool = conn.exists(&meta_key)?;
        if !exists {
            return Ok(None);
        }

        let meta: Vec<(String, String)> = conn.hgetall(&meta_key)?;
        let meta_map: std::collections::HashMap<String, String> = meta.into_iter().collect();

        let status = meta_map
            .get(META_FIELD_STATUS)
            .and_then(|s| match s.as_str() {
                "pending" => Some(JobStatus::Pending),
                "processing" => Some(JobStatus::Processing),
                "completed" => Some(JobStatus::Completed),
                "failed" => Some(JobStatus::Failed),
                "timedOut" => Some(JobStatus::TimedOut),
                _ => None,
            })
            .unwrap_or(JobStatus::Pending);

        let accounts: Vec<String> = meta_map
            .get(META_FIELD_ACCOUNTS)
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        let chains: Vec<String> = meta_map
            .get(META_FIELD_CHAINS)
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        let wallet_group_id = meta_map.get(META_FIELD_WALLET_GROUP_ID).and_then(|s| {
            if s.is_empty() {
                None
            } else {
                Uuid::parse_str(s).ok()
            }
        });

        let expected_total = meta_map
            .get(META_FIELD_EXPECTED)
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let succeeded = meta_map
            .get(META_FIELD_SUCCEEDED)
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let failed = meta_map
            .get(META_FIELD_FAILED)
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let timed_out = meta_map
            .get(META_FIELD_TIMED_OUT)
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let processed_count = meta_map
            .get(META_FIELD_PROCESSED)
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let is_final = meta_map
            .get(META_FIELD_FINAL)
            .map(|s| s == "1")
            .unwrap_or(false);

        let created_at = meta_map
            .get(META_FIELD_CREATED)
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);

        let updated_at = meta_map
            .get(META_FIELD_UPDATED)
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or(created_at);

        let ttl: i64 = conn.ttl(&meta_key)?;
        let expires_at = if ttl > 0 {
            Some(Utc::now() + chrono::Duration::seconds(ttl))
        } else {
            None
        };

        Ok(Some(AggregationJob {
            job_id: *job_id,
            status,
            wallets: accounts,
            chains,
            wallet_group_id,
            expected_total,
            succeeded,
            failed,
            timed_out,
            processed_count,
            is_final,
            created_at,
            updated_at,
            expires_at,
        }))
    }

    pub fn update_job_status(&self, job_id: &Uuid, status: JobStatus) -> Result<()> {
        let mut conn = self.redis.get_connection()?;
        let meta_key = self.meta_key(job_id);
        let _: () = conn.hset(&meta_key, META_FIELD_STATUS, status.to_string())?;
        let _: () = conn.hset(&meta_key, META_FIELD_UPDATED, Utc::now().to_rfc3339())?;
        Ok(())
    }

    pub fn add_result(&self, job_id: &Uuid, result: &AggregationResult) -> Result<()> {
        let mut conn = self.redis.get_connection()?;
        let results_key = self.results_key(job_id);
        let result_json = serde_json::to_string(result)?;

        let _: () = conn.rpush(&results_key, result_json)?;
        let _: () = conn.expire(&results_key, 86400)?;

        Ok(())
    }

    pub fn get_results(&self, job_id: &Uuid) -> Result<Vec<AggregationResult>> {
        let mut conn = self.redis.get_connection()?;
        let results_key = self.results_key(job_id);

        let results: Vec<String> = conn.lrange(&results_key, 0, -1)?;
        let parsed_results: Vec<AggregationResult> = results
            .into_iter()
            .filter_map(|s| serde_json::from_str(&s).ok())
            .collect();

        Ok(parsed_results)
    }

    /// Find most recent completed job containing a specific wallet address
    pub fn find_latest_job_for_wallet(&self, wallet: &str) -> Result<Option<Uuid>> {
        let mut conn = self.redis.get_connection()?;

        // Scan for all job meta keys
        let pattern = format!("{}:meta:*", KEY_PREFIX);
        let keys: Vec<String> = conn.keys(&pattern)?;

        let mut matching_jobs = Vec::new();

        for key in keys {
            // Get job metadata
            let accounts_json: Option<String> = conn.hget(&key, META_FIELD_ACCOUNTS).ok();
            let status_str: Option<String> = conn.hget(&key, META_FIELD_STATUS).ok();
            let created_str: Option<String> = conn.hget(&key, META_FIELD_CREATED).ok();

            // Check if job contains this wallet and is completed
            if let (Some(accounts_json), Some(status), Some(created)) =
                (accounts_json, status_str, created_str)
            {
                if status == "completed" {
                    if let Ok(accounts) = serde_json::from_str::<Vec<String>>(&accounts_json) {
                        if accounts.iter().any(|a| a.eq_ignore_ascii_case(wallet)) {
                            // Extract job_id from key: "defi10:agg:meta:{uuid}"
                            if let Some(uuid_str) =
                                key.strip_prefix(&format!("{}:meta:", KEY_PREFIX))
                            {
                                if let Ok(job_id) = Uuid::parse_str(uuid_str) {
                                    if let Ok(created_at) =
                                        chrono::DateTime::parse_from_rfc3339(&created)
                                    {
                                        matching_jobs.push((job_id, created_at));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Sort by creation time (most recent first) and return the first one
        matching_jobs.sort_by(|a, b| b.1.cmp(&a.1));
        Ok(matching_jobs.first().map(|(id, _)| *id))
    }

    pub fn get_snapshot(&self, job_id: &Uuid) -> Result<Option<JobSnapshot>> {
        let job = match self.get_job(job_id)? {
            Some(j) => j,
            None => return Ok(None),
        };

        let results = self.get_results(job_id)?;
        let total_value_usd: f64 = results.iter().map(|r| r.value_usd).sum();

        let expires_in_seconds = job.expires_at.map(|exp| (exp - Utc::now()).num_seconds());
        let is_active = job.is_active();

        Ok(Some(JobSnapshot {
            job_id: job.job_id,
            status: job.status.clone(),
            wallets: job.wallets,
            chains: job.chains,
            wallet_group_id: job.wallet_group_id,
            expected_total: job.expected_total,
            succeeded: job.succeeded,
            failed: job.failed,
            timed_out: job.timed_out,
            processed_count: job.processed_count,
            is_final: job.is_final,
            created_at: job.created_at,
            updated_at: job.updated_at,
            expires_in_seconds,
            active: is_active,
            results,
            total_value_usd,
        }))
    }

    pub fn mark_final(&self, job_id: &Uuid) -> Result<()> {
        let mut conn = self.redis.get_connection()?;
        let meta_key = self.meta_key(job_id);
        let _: () = conn.hset(&meta_key, META_FIELD_FINAL, "1")?;
        let _: () = conn.hset(&meta_key, META_FIELD_UPDATED, Utc::now().to_rfc3339())?;
        Ok(())
    }

    pub fn increment_counters(
        &self,
        job_id: &Uuid,
        succeeded: u32,
        failed: u32,
        timed_out: u32,
    ) -> Result<()> {
        let mut conn = self.redis.get_connection()?;
        let meta_key = self.meta_key(job_id);

        if succeeded > 0 {
            let _: () = conn.hincr(&meta_key, META_FIELD_SUCCEEDED, succeeded)?;
            let _: () = conn.hincr(&meta_key, META_FIELD_PROCESSED, succeeded)?;
        }
        if failed > 0 {
            let _: () = conn.hincr(&meta_key, META_FIELD_FAILED, failed)?;
            let _: () = conn.hincr(&meta_key, META_FIELD_PROCESSED, failed)?;
        }
        if timed_out > 0 {
            let _: () = conn.hincr(&meta_key, META_FIELD_TIMED_OUT, timed_out)?;
            let _: () = conn.hincr(&meta_key, META_FIELD_PROCESSED, timed_out)?;
        }

        let _: () = conn.hset(&meta_key, META_FIELD_UPDATED, Utc::now().to_rfc3339())?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_generation() {
        let job_id = Uuid::new_v4();
        let manager = JobManager::new("redis://localhost:6379").unwrap();

        let meta_key = manager.meta_key(&job_id);
        assert!(meta_key.starts_with("defi10:agg:meta:"));

        let results_key = manager.results_key(&job_id);
        assert!(results_key.starts_with("defi10:agg:results:"));
    }
}
