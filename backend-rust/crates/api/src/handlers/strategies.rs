use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::Utc;
use defi10_core::{
    SaveStrategiesRequest, SaveStrategiesResponse, StrategySummary, WalletGroupStrategies,
    WalletGroupStrategiesResponse,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::middleware::auth::AuthUser;
use crate::state::AppState;

pub async fn save_strategies(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(request): Json<SaveStrategiesRequest>,
) -> Result<Json<SaveStrategiesResponse>, (StatusCode, String)> {
    if user.user_id != request.wallet_group_id.to_string() {
        tracing::warn!(
            "Wallet group ID mismatch: token={}, requested={}",
            user.user_id,
            request.wallet_group_id
        );
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    let wallet_group = match state.wallet_group_repo.get(&request.wallet_group_id).await {
        Ok(Some(group)) => group,
        Ok(None) => {
            return Err((
                StatusCode::NOT_FOUND,
                format!("Wallet group {} not found", request.wallet_group_id),
            ));
        }
        Err(e) => {
            tracing::error!("Failed to get wallet group: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to get wallet group".to_string(),
            ));
        }
    };

    match state
        .strategy_service
        .save_strategies(
            request.wallet_group_id,
            wallet_group.accounts,
            request.strategies,
        )
        .await
    {
        Ok(result) => {
            let strategies: Vec<StrategySummary> = result
                .strategies
                .iter()
                .map(|s| StrategySummary {
                    id: s.id,
                    strategy_type: s.strategy_type as i32,
                    name: s.name.clone(),
                    allocations_count: s.allocations.as_ref().map_or(0, |a| a.len()),
                    targets_count: s.targets.as_ref().map_or(0, |t| t.len()),
                })
                .collect();

            let response = SaveStrategiesResponse {
                key: result.key,
                strategies_count: result.strategies.len(),
                strategies,
                accounts: result.accounts,
                saved_at: Utc::now(),
            };

            Ok(Json(response))
        }
        Err(e) => {
            tracing::error!("Failed to save strategies: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to save strategies: {}", e),
            ))
        }
    }
}

pub async fn get_strategies(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(wallet_group_id): Path<Uuid>,
) -> Result<Json<WalletGroupStrategiesResponse>, (StatusCode, String)> {
    if user.user_id != wallet_group_id.to_string() {
        tracing::warn!(
            "Wallet group ID mismatch: token={}, requested={}",
            user.user_id,
            wallet_group_id
        );
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    let wallet_group = match state.wallet_group_repo.get(&wallet_group_id).await {
        Ok(Some(group)) => group,
        Ok(None) => {
            return Err((
                StatusCode::NOT_FOUND,
                format!("Wallet group {} not found", wallet_group_id),
            ));
        }
        Err(e) => {
            tracing::error!("Failed to get wallet group: {}", e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to get wallet group".to_string(),
            ));
        }
    };

    match state.strategy_service.get_strategies(wallet_group_id).await {
        Ok(Some(result)) => Ok(Json(WalletGroupStrategiesResponse::from(result))),
        Ok(None) => {
            let empty_result =
                WalletGroupStrategies::new(wallet_group_id, wallet_group.accounts, vec![]);
            Ok(Json(WalletGroupStrategiesResponse::from(empty_result)))
        }
        Err(e) => {
            tracing::error!("Failed to get strategies: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to get strategies: {}", e),
            ))
        }
    }
}
