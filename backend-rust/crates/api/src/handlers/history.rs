use crate::{middleware::auth::AuthUser, middleware::ApiResult, state::AppState};
use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use chrono::Utc;
use defi10_core::{
    AnalyticsSummary, DayPnl, DeFi10Error, HistoryPoint, PortfolioAnalytics, PositionHistoryPoint,
    SyncSnapshotSummary,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use super::verify_user_access;

const HISTORY_DAYS: i64 = 90;

fn date_range_90d() -> (String, String) {
    let to = Utc::now();
    let from = to - chrono::Duration::days(HISTORY_DAYS);
    (
        from.format("%Y-%m-%d").to_string(),
        to.format("%Y-%m-%d").to_string(),
    )
}

#[derive(Debug, Deserialize)]
pub struct PositionHistoryQuery {
    pub token: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryResponse {
    pub wallet_group_id: Uuid,
    pub points: Vec<HistoryPoint>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotDetailResponse {
    pub wallet_group_id: Uuid,
    pub date: String,
    pub total_value_usd: f64,
    pub positions: Vec<defi10_core::aggregation::AggregationResult>,
    pub summary: defi10_core::SnapshotSummary,
    pub analytics: Option<PortfolioAnalytics>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionHistoryResponse {
    pub wallet_group_id: Uuid,
    pub token: String,
    pub points: Vec<PositionHistoryPoint>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolAllocationSeries {
    pub wallet_group_id: Uuid,
    pub series: HashMap<String, Vec<ProtocolAllocationPoint>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolAllocationPoint {
    pub date: String,
    pub percent: f64,
    pub value_usd: f64,
}

pub async fn get_history(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<HistoryResponse>> {
    verify_user_access(&user, &id.to_string()).map_err(crate::middleware::error::ApiError::from)?;
    let (from, to) = date_range_90d();
    let points = state
        .snapshot_repo
        .get_history(&id, &from, &to)
        .await
        .map_err(|e| DeFi10Error::Internal(format!("Failed to fetch history: {}", e)))?;

    Ok(Json(HistoryResponse {
        wallet_group_id: id,
        points,
    }))
}

pub async fn get_snapshot_detail(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((id, date)): Path<(Uuid, String)>,
) -> ApiResult<Json<SnapshotDetailResponse>> {
    verify_user_access(&user, &id.to_string()).map_err(crate::middleware::error::ApiError::from)?;
    let snapshot = state
        .snapshot_repo
        .get_snapshot(&id, &date)
        .await
        .map_err(|e| DeFi10Error::Internal(format!("Failed to fetch snapshot: {}", e)))?
        .ok_or_else(|| DeFi10Error::NotFound(format!("No snapshot found for date {}", date)))?;

    let analytics = state
        .snapshot_repo
        .get_analytics(&id, &date)
        .await
        .unwrap_or(None);

    Ok(Json(SnapshotDetailResponse {
        wallet_group_id: id,
        date: snapshot.date,
        total_value_usd: snapshot.total_value_usd,
        positions: snapshot.positions,
        summary: snapshot.summary,
        analytics,
    }))
}

pub async fn get_position_history(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Query(query): Query<PositionHistoryQuery>,
) -> ApiResult<Json<PositionHistoryResponse>> {
    verify_user_access(&user, &id.to_string()).map_err(crate::middleware::error::ApiError::from)?;
    let (from, to) = date_range_90d();
    let points = state
        .snapshot_repo
        .get_position_history(&id, &query.token, &from, &to)
        .await
        .map_err(|e| DeFi10Error::Internal(format!("Failed to fetch position history: {}", e)))?;

    Ok(Json(PositionHistoryResponse {
        wallet_group_id: id,
        token: query.token,
        points,
    }))
}

pub async fn get_analytics_summary(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<AnalyticsSummary>> {
    verify_user_access(&user, &id.to_string()).map_err(crate::middleware::error::ApiError::from)?;
    let all_analytics = state
        .snapshot_repo
        .get_analytics_range(&id, "2000-01-01", "2099-12-31")
        .await
        .map_err(|e| DeFi10Error::Internal(format!("Failed to fetch analytics: {}", e)))?;

    if all_analytics.is_empty() {
        return Err(DeFi10Error::NotFound("No analytics data found".to_string()).into());
    }

    let latest = all_analytics.last().unwrap();

    let best_day = all_analytics
        .iter()
        .max_by(|a, b| a.daily_pnl.partial_cmp(&b.daily_pnl).unwrap())
        .map(|a| DayPnl {
            date: a.date.clone(),
            pnl: a.daily_pnl,
            pnl_percent: a.daily_pnl_percent,
        });

    let worst_day = all_analytics
        .iter()
        .min_by(|a, b| a.daily_pnl.partial_cmp(&b.daily_pnl).unwrap())
        .map(|a| DayPnl {
            date: a.date.clone(),
            pnl: a.daily_pnl,
            pnl_percent: a.daily_pnl_percent,
        });

    Ok(Json(AnalyticsSummary {
        total_pnl: latest.cumulative_pnl,
        total_pnl_percent: latest.cumulative_pnl_percent,
        high_water_mark: latest.high_water_mark,
        drawdown_from_hwm: latest.drawdown_from_hwm,
        best_day,
        worst_day,
        current_value_usd: latest.total_value_usd,
        days_tracked: all_analytics.len() as u32,
    }))
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncHistoryResponse {
    pub wallet_group_id: Uuid,
    pub syncs: Vec<SyncSnapshotSummary>,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncDetailResponse {
    pub wallet_group_id: Uuid,
    pub id: Uuid,
    pub date: String,
    pub synced_at: chrono::DateTime<chrono::Utc>,
    pub total_value_usd: f64,
    pub positions: Vec<defi10_core::aggregation::AggregationResult>,
    pub summary: defi10_core::SnapshotSummary,
}

pub async fn get_sync_history(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<SyncHistoryResponse>> {
    verify_user_access(&user, &id.to_string()).map_err(crate::middleware::error::ApiError::from)?;
    let (from, to) = date_range_90d();
    let syncs = state
        .snapshot_repo
        .get_sync_snapshots(&id, &from, &to)
        .await
        .map_err(|e| DeFi10Error::Internal(format!("Failed to fetch sync history: {}", e)))?;

    Ok(Json(SyncHistoryResponse {
        wallet_group_id: id,
        syncs,
    }))
}

pub async fn get_sync_detail(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((id, sync_id)): Path<(Uuid, String)>,
) -> ApiResult<Json<SyncDetailResponse>> {
    verify_user_access(&user, &id.to_string()).map_err(crate::middleware::error::ApiError::from)?;
    let snapshot = state
        .snapshot_repo
        .get_sync_snapshot_detail(&id, &sync_id)
        .await
        .map_err(|e| DeFi10Error::Internal(format!("Failed to fetch sync detail: {}", e)))?
        .ok_or_else(|| {
            DeFi10Error::NotFound(format!("No sync snapshot found for id {}", sync_id))
        })?;

    Ok(Json(SyncDetailResponse {
        wallet_group_id: id,
        id: snapshot.id,
        date: snapshot.date,
        synced_at: snapshot.synced_at,
        total_value_usd: snapshot.total_value_usd,
        positions: snapshot.positions,
        summary: snapshot.summary,
    }))
}

pub async fn get_protocol_allocation(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<ProtocolAllocationSeries>> {
    verify_user_access(&user, &id.to_string()).map_err(crate::middleware::error::ApiError::from)?;
    let (from, to) = date_range_90d();
    let analytics = state
        .snapshot_repo
        .get_analytics_range(&id, &from, &to)
        .await
        .map_err(|e| DeFi10Error::Internal(format!("Failed to fetch analytics: {}", e)))?;

    let mut series: HashMap<String, Vec<ProtocolAllocationPoint>> = HashMap::new();

    for a in &analytics {
        for (protocol, entry) in &a.protocol_distribution {
            series
                .entry(protocol.clone())
                .or_default()
                .push(ProtocolAllocationPoint {
                    date: a.date.clone(),
                    percent: entry.percent,
                    value_usd: entry.value_usd,
                });
        }
    }

    Ok(Json(ProtocolAllocationSeries {
        wallet_group_id: id,
        series,
    }))
}
