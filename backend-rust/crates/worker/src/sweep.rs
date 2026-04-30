use anyhow::Result;
use chrono::Utc;
use defi10_core::aggregation::AggregationResult;
use defi10_infrastructure::{
    cache::{CacheService, RedisCache},
    database::{
        SnapshotRepository, SnapshotRepositoryTrait, WalletGroupRepository,
        WalletGroupRepositoryTrait,
    },
};
use std::collections::HashSet;
use std::time::Duration;
use tracing::{info, warn};
use uuid::Uuid;

use crate::processor::AggregationProcessor;
use crate::snapshot_save::save_daily_snapshot;

const SWEEP_CACHE_PREFIX: &str = "sweep_snapshot";
const SWEEP_CACHE_TTL: Duration = Duration::from_secs(6 * 3600);
const SNAPSHOT_RETENTION_DAYS: i64 = 90;
const ACTIVE_WALLET_DAYS: i64 = 30;

pub async fn run_snapshot_job(
    snapshot_repo: &SnapshotRepository,
    processor: &AggregationProcessor,
    cache: &RedisCache,
    wg_repo: &WalletGroupRepository,
) -> Result<()> {
    match wg_repo.backfill_last_synced_at().await {
        Ok(n) if n > 0 => info!(
            "Backfill: set lastSyncedAt = updatedAt for {} wallet groups",
            n
        ),
        Ok(_) => info!("Backfill: all wallet groups already have lastSyncedAt"),
        Err(e) => warn!("Backfill: failed to backfill lastSyncedAt: {}", e),
    }

    run_sweep(snapshot_repo, processor, cache, wg_repo).await?;
    run_retention(snapshot_repo).await;

    Ok(())
}

async fn run_sweep(
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

    let since = Utc::now() - chrono::Duration::hours(23);
    let existing_ids: HashSet<String> = snapshot_repo
        .get_wallet_group_ids_with_recent_snapshot(since)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to get recent snapshot ids: {}", e))?
        .into_iter()
        .collect();

    let active_threshold = Utc::now() - chrono::Duration::days(ACTIVE_WALLET_DAYS);

    let missing: Vec<_> = all_groups
        .into_iter()
        .filter(|wg| !existing_ids.contains(&wg.id.to_string()))
        .filter(|wg| {
            wg.last_synced_at
                .map(|t| t > active_threshold)
                .unwrap_or(true)
        })
        .collect();

    if missing.is_empty() {
        info!("All active wallet groups already have a recent snapshot");
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

async fn run_retention(snapshot_repo: &SnapshotRepository) {
    let cutoff = (Utc::now() - chrono::Duration::days(SNAPSHOT_RETENTION_DAYS))
        .format("%Y-%m-%d")
        .to_string();

    match snapshot_repo.delete_old_snapshots(&cutoff).await {
        Ok(n) => info!("Retention: deleted {} daily snapshots before {}", n, cutoff),
        Err(e) => warn!("Retention: failed to delete old snapshots: {}", e),
    }
    match snapshot_repo.delete_old_analytics(&cutoff).await {
        Ok(n) => info!(
            "Retention: deleted {} analytics records before {}",
            n, cutoff
        ),
        Err(e) => warn!("Retention: failed to delete old analytics: {}", e),
    }
    match snapshot_repo.delete_old_sync_snapshots(&cutoff).await {
        Ok(n) => info!("Retention: deleted {} sync snapshots before {}", n, cutoff),
        Err(e) => warn!("Retention: failed to delete old sync snapshots: {}", e),
    }
}
