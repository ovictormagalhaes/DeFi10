use anyhow::Result;
use chrono::Utc;
use defi10_core::aggregation::{
    AggregationJob, AggregationResult, JobSnapshot, JobStatus, OperationStatus,
};
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
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

const MAX_RETRIES: u32 = 3;
const COMMAND_TIMEOUT_SECS: u64 = 10;
const JOB_TTL_SECS: i64 = 3600;

pub struct JobManager {
    conn: std::sync::Arc<tokio::sync::RwLock<ConnectionManager>>,
    client: redis::Client,
}

impl JobManager {
    pub async fn new(redis_url: &str) -> Result<Self> {
        let client = redis::Client::open(redis_url)?;
        let conn = Self::connect(&client).await?;
        let conn = std::sync::Arc::new(tokio::sync::RwLock::new(conn));

        let keepalive_conn = conn.clone();
        let keepalive_client = client.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(15)).await;
                let mut c = keepalive_conn.read().await.clone();
                let ping: std::result::Result<String, _> =
                    redis::cmd("PING").query_async(&mut c).await;
                if ping.is_err() {
                    tracing::debug!("Keepalive ping failed, reconnecting...");
                    if let Ok(new_conn) = Self::connect(&keepalive_client).await {
                        *keepalive_conn.write().await = new_conn;
                        tracing::debug!("Keepalive reconnected");
                    }
                }
            }
        });

        Ok(Self { conn, client })
    }

    async fn connect(client: &redis::Client) -> Result<ConnectionManager> {
        tokio::time::timeout(
            std::time::Duration::from_secs(15),
            ConnectionManager::new(client.clone()),
        )
        .await
        .map_err(|_| anyhow::anyhow!("Redis connection timed out after 15s"))?
        .map_err(|e| anyhow::anyhow!("Redis connection failed: {}", e))
    }

    async fn get_conn(&self) -> ConnectionManager {
        self.conn.read().await.clone()
    }

    async fn reconnect(&self) {
        tracing::info!("Reconnecting to Redis...");
        match Self::connect(&self.client).await {
            Ok(new_conn) => {
                *self.conn.write().await = new_conn;
                tracing::info!("Redis reconnected");
            }
            Err(e) => {
                tracing::warn!("Redis reconnect failed: {}", e);
            }
        }
    }

    async fn with_retry<F, Fut, T>(&self, mut f: F) -> Result<T>
    where
        F: FnMut(ConnectionManager) -> Fut,
        Fut: std::future::Future<Output = Result<T>>,
    {
        let mut last_err = None;
        for attempt in 0..MAX_RETRIES {
            let conn = self.get_conn().await;
            match tokio::time::timeout(
                std::time::Duration::from_secs(COMMAND_TIMEOUT_SECS),
                f(conn),
            )
            .await
            {
                Ok(Ok(v)) => return Ok(v),
                Ok(Err(e)) => {
                    tracing::warn!("Redis attempt {}/{} failed: {}", attempt + 1, MAX_RETRIES, e);
                    last_err = Some(e);
                }
                Err(_) => {
                    tracing::warn!(
                        "Redis attempt {}/{} timed out ({}s)",
                        attempt + 1, MAX_RETRIES, COMMAND_TIMEOUT_SECS
                    );
                    last_err = Some(anyhow::anyhow!(
                        "Redis command timed out after {}s",
                        COMMAND_TIMEOUT_SECS
                    ));
                }
            }
            if attempt + 1 < MAX_RETRIES {
                self.reconnect().await;
            }
        }
        Err(last_err.unwrap())
    }

    fn meta_key(&self, job_id: &Uuid) -> String {
        format!("{}:meta:{}", KEY_PREFIX, job_id)
    }

    fn results_key(&self, job_id: &Uuid) -> String {
        format!("{}:results:{}", KEY_PREFIX, job_id)
    }

    fn operations_key(&self, job_id: &Uuid) -> String {
        format!("{}:operations:{}", KEY_PREFIX, job_id)
    }

    fn active_jobs_key() -> String {
        format!("{}:index:active", KEY_PREFIX)
    }

    fn wallet_group_index_key(wallet_group_id: &Uuid) -> String {
        format!("{}:index:wg:{}", KEY_PREFIX, wallet_group_id)
    }

    fn wallet_index_key(wallet: &str) -> String {
        format!("{}:index:wallet:{}", KEY_PREFIX, wallet.to_lowercase())
    }

    pub async fn create_job(&self, job: &AggregationJob) -> Result<()> {
        let meta_key = self.meta_key(&job.job_id);
        let accounts_json = serde_json::to_string(&job.wallets)?;
        let chains_json = serde_json::to_string(&job.chains)?;
        let wallet_group_id_str = job
            .wallet_group_id
            .map(|id| id.to_string())
            .unwrap_or_default();

        let fields = [
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
        ];

        let job_id_str = job.job_id.to_string();
        let wg_id = job.wallet_group_id;
        let active_key = Self::active_jobs_key();

        self.with_retry(|mut c| {
            let mk = meta_key.clone();
            let f = fields.clone();
            let jid = job_id_str.clone();
            let ak = active_key.clone();
            async move {
                let _: () = c.hset_multiple(&mk, &f).await?;
                let _: () = c.expire(&mk, JOB_TTL_SECS).await?;
                let _: () = c.sadd(&ak, &jid).await?;
                Ok(())
            }
        })
        .await?;

        if let Some(wg) = wg_id {
            let wg_key = Self::wallet_group_index_key(&wg);
            self.with_retry(|mut c| {
                let wk = wg_key.clone();
                let jid = job_id_str.clone();
                async move {
                    let _: () = c.set_ex(&wk, &jid, JOB_TTL_SECS as u64).await?;
                    Ok(())
                }
            })
            .await?;
        }

        for wallet in &job.wallets {
            let wk = Self::wallet_index_key(wallet);
            self.with_retry(|mut c| {
                let wk = wk.clone();
                let jid = job_id_str.clone();
                async move {
                    let _: () = c.set_ex(&wk, &jid, JOB_TTL_SECS as u64).await?;
                    Ok(())
                }
            })
            .await?;
        }

        Ok(())
    }

    pub async fn get_job(&self, job_id: &Uuid) -> Result<Option<AggregationJob>> {
        let meta_key = self.meta_key(job_id);
        let jid = *job_id;

        self.with_retry(|mut c| {
            let mk = meta_key.clone();
            async move { Self::get_job_inner(&mut c, &mk, &jid).await }
        })
        .await
    }

    async fn get_job_inner(
        conn: &mut ConnectionManager,
        meta_key: &str,
        job_id: &Uuid,
    ) -> Result<Option<AggregationJob>> {
        let exists: bool = conn.exists(meta_key).await?;
        if !exists {
            return Ok(None);
        }

        let meta: Vec<(String, String)> = conn.hgetall(meta_key).await?;
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

        let ttl: i64 = conn.ttl(meta_key).await?;
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

    pub async fn update_job_status(&self, job_id: &Uuid, status: JobStatus) -> Result<()> {
        let meta_key = self.meta_key(job_id);
        let status_str = status.to_string();
        let is_terminal = matches!(status, JobStatus::Completed | JobStatus::Failed | JobStatus::TimedOut);
        let job_id_str = job_id.to_string();
        let active_key = Self::active_jobs_key();

        self.with_retry(|mut c| {
            let mk = meta_key.clone();
            let ss = status_str.clone();
            let jid = job_id_str.clone();
            let ak = active_key.clone();
            async move {
                let _: () = c.hset(&mk, META_FIELD_STATUS, &ss).await?;
                let _: () = c.hset(&mk, META_FIELD_UPDATED, Utc::now().to_rfc3339()).await?;
                let _: () = c.expire(&mk, JOB_TTL_SECS).await?;
                if is_terminal {
                    let _: () = c.srem(&ak, &jid).await?;
                }
                Ok(())
            }
        })
        .await
    }

    pub async fn add_result(&self, job_id: &Uuid, result: &AggregationResult) -> Result<()> {
        let results_key = self.results_key(job_id);
        let result_json = serde_json::to_string(result)?;

        self.with_retry(|mut c| {
            let rk = results_key.clone();
            let rj = result_json.clone();
            async move {
                let _: () = c.rpush(&rk, &rj).await?;
                let _: () = c.expire(&rk, JOB_TTL_SECS).await?;
                Ok(())
            }
        })
        .await
    }

    pub async fn get_results(&self, job_id: &Uuid) -> Result<Vec<AggregationResult>> {
        let results_key = self.results_key(job_id);

        self.with_retry(|mut c| {
            let rk = results_key.clone();
            async move {
                let results: Vec<String> = c.lrange(&rk, 0, -1).await?;
                Ok(results
                    .into_iter()
                    .filter_map(|s| serde_json::from_str(&s).ok())
                    .collect())
            }
        })
        .await
    }

    pub async fn find_latest_job_for_wallet(&self, wallet: &str) -> Result<Option<Uuid>> {
        let wk = Self::wallet_index_key(wallet);

        let job_id_str: Option<String> = self
            .with_retry(|mut c| {
                let wk = wk.clone();
                async move { Ok(c.get(&wk).await?) }
            })
            .await?;

        match job_id_str {
            Some(jid) => Ok(Uuid::parse_str(&jid).ok()),
            None => Ok(None),
        }
    }

    pub async fn find_active_job(
        &self,
        accounts: &[String],
        wallet_group_id: Option<Uuid>,
    ) -> Result<Option<AggregationJob>> {
        if let Some(wg_id) = wallet_group_id {
            let wg_key = Self::wallet_group_index_key(&wg_id);
            let job_id_str: Option<String> = self
                .with_retry(|mut c| {
                    let wk = wg_key.clone();
                    async move { Ok(c.get(&wk).await?) }
                })
                .await?;

            if let Some(jid) = job_id_str {
                if let Ok(job_id) = Uuid::parse_str(&jid) {
                    if let Some(job) = self.get_job(&job_id).await? {
                        if job.is_active() {
                            return Ok(Some(job));
                        }
                    }
                }
            }
            return Ok(None);
        }

        let active_key = Self::active_jobs_key();
        let accounts = accounts.to_vec();

        self.with_retry(|mut c| {
            let accs = accounts.clone();
            let ak = active_key.clone();
            async move {
                let job_ids: Vec<String> = c.smembers(&ak).await?;

                for jid_str in job_ids {
                    let job_id = match Uuid::parse_str(&jid_str) {
                        Ok(id) => id,
                        Err(_) => continue,
                    };

                    let mk = format!("{}:meta:{}", KEY_PREFIX, job_id);

                    let status_str: Option<String> =
                        c.hget(&mk, META_FIELD_STATUS).await.ok();
                    match status_str.as_deref() {
                        Some("pending" | "processing") => {}
                        _ => {
                            let _: std::result::Result<(), _> = c.srem(&ak, &jid_str).await;
                            continue;
                        }
                    }

                    let updated_str: Option<String> =
                        c.hget(&mk, META_FIELD_UPDATED).await.ok();
                    let processed: Option<String> =
                        c.hget(&mk, META_FIELD_PROCESSED).await.ok();
                    let processed_count: u32 = processed
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0);

                    if let Some(ref ts) = updated_str {
                        if let Ok(updated_at) = chrono::DateTime::parse_from_rfc3339(ts) {
                            let age = Utc::now() - updated_at.with_timezone(&Utc);
                            if age > chrono::Duration::minutes(5) && processed_count == 0 {
                                tracing::warn!(
                                    "Expiring stale job {} (no progress in {}s)",
                                    jid_str, age.num_seconds()
                                );
                                let _: std::result::Result<(), _> = c
                                    .hset::<_, _, _, ()>(&mk, META_FIELD_STATUS, "timedOut")
                                    .await;
                                let _: std::result::Result<(), _> = c.srem(&ak, &jid_str).await;
                                continue;
                            }
                        }
                    }

                    let accounts_json: Option<String> =
                        c.hget(&mk, META_FIELD_ACCOUNTS).await.ok();
                    if let Some(json) = accounts_json {
                        if let Ok(mut stored) = serde_json::from_str::<Vec<String>>(&json) {
                            stored.sort();
                            let mut requested = accs.clone();
                            requested.sort();
                            if stored.iter().map(|s| s.to_lowercase()).collect::<Vec<_>>()
                                == requested
                                    .iter()
                                    .map(|s| s.to_lowercase())
                                    .collect::<Vec<_>>()
                            {
                                return Self::get_job_inner(&mut c, &mk, &job_id).await;
                            }
                        }
                    }
                }

                Ok(None)
            }
        })
        .await
    }

    pub async fn get_snapshot(&self, job_id: &Uuid) -> Result<Option<JobSnapshot>> {
        let job = match self.get_job(job_id).await? {
            Some(j) => j,
            None => return Ok(None),
        };

        let results = self.get_results(job_id).await?;
        let operations = self.get_operations(job_id).await?;
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
            operations,
        }))
    }

    pub async fn mark_final(&self, job_id: &Uuid) -> Result<()> {
        let meta_key = self.meta_key(job_id);

        self.with_retry(|mut c| {
            let mk = meta_key.clone();
            async move {
                let _: () = c.hset(&mk, META_FIELD_FINAL, "1").await?;
                let _: () = c.hset(&mk, META_FIELD_UPDATED, Utc::now().to_rfc3339()).await?;
                let _: () = c.expire(&mk, JOB_TTL_SECS).await?;
                Ok(())
            }
        })
        .await
    }

    pub async fn add_operations(
        &self,
        job_id: &Uuid,
        operations: &[OperationStatus],
    ) -> Result<()> {
        let ops_key = self.operations_key(job_id);
        let ops: Vec<String> = operations
            .iter()
            .filter_map(|op| serde_json::to_string(op).ok())
            .collect();

        self.with_retry(|mut c| {
            let ok = ops_key.clone();
            let o = ops.clone();
            async move {
                for json in &o {
                    let _: () = c.rpush(&ok, json).await?;
                }
                let _: () = c.expire(&ok, JOB_TTL_SECS).await?;
                Ok(())
            }
        })
        .await
    }

    pub async fn get_operations(&self, job_id: &Uuid) -> Result<Vec<OperationStatus>> {
        let ops_key = self.operations_key(job_id);

        self.with_retry(|mut c| {
            let ok = ops_key.clone();
            async move {
                let items: Vec<String> = c.lrange(&ok, 0, -1).await?;
                Ok(items
                    .into_iter()
                    .filter_map(|s| serde_json::from_str(&s).ok())
                    .collect())
            }
        })
        .await
    }

    pub async fn increment_counters(
        &self,
        job_id: &Uuid,
        succeeded: u32,
        failed: u32,
        timed_out: u32,
    ) -> Result<()> {
        let meta_key = self.meta_key(job_id);

        self.with_retry(|mut c| {
            let mk = meta_key.clone();
            async move {
                if succeeded > 0 {
                    let _: () = c.hincr(&mk, META_FIELD_SUCCEEDED, succeeded).await?;
                    let _: () = c.hincr(&mk, META_FIELD_PROCESSED, succeeded).await?;
                }
                if failed > 0 {
                    let _: () = c.hincr(&mk, META_FIELD_FAILED, failed).await?;
                    let _: () = c.hincr(&mk, META_FIELD_PROCESSED, failed).await?;
                }
                if timed_out > 0 {
                    let _: () = c.hincr(&mk, META_FIELD_TIMED_OUT, timed_out).await?;
                    let _: () = c.hincr(&mk, META_FIELD_PROCESSED, timed_out).await?;
                }
                let _: () =
                    c.hset(&mk, META_FIELD_UPDATED, Utc::now().to_rfc3339()).await?;
                let _: () = c.expire(&mk, JOB_TTL_SECS).await?;
                Ok(())
            }
        })
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_key_generation() {
        let job_id = Uuid::new_v4();
        let manager = JobManager::new("redis://localhost:6379").await.unwrap();

        let meta_key = manager.meta_key(&job_id);
        assert!(meta_key.starts_with("defi10:agg:meta:"));

        let results_key = manager.results_key(&job_id);
        assert!(results_key.starts_with("defi10:agg:results:"));
    }
}
