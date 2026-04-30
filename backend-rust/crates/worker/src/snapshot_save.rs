use defi10_core::aggregation::AggregationResult;
use defi10_core::analytics::compute_analytics;
use defi10_core::snapshot::DailySnapshot;
use defi10_infrastructure::database::{SnapshotRepository, SnapshotRepositoryTrait};
use tracing::{error, info, warn};
use uuid::Uuid;

pub async fn save_daily_snapshot(
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

pub fn yesterday(date: &str) -> String {
    if let Ok(d) = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d") {
        (d - chrono::Duration::days(1))
            .format("%Y-%m-%d")
            .to_string()
    } else {
        String::new()
    }
}
