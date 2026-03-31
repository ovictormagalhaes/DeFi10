use axum::{
    extract::{Path, State},
    http::StatusCode,
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
    let request_id = request.wallet_group_id.clone();
    if user.user_id != request_id {
        tracing::warn!(
            "ID mismatch: token={}, requested={}",
            user.user_id,
            request_id
        );
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    let result = if let Ok(group_id) = Uuid::parse_str(&request_id) {
        let wallet_group = match state.wallet_group_repo.get(&group_id).await {
            Ok(Some(group)) => group,
            Ok(None) => {
                return Err((
                    StatusCode::NOT_FOUND,
                    format!("Wallet group {} not found", group_id),
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

        state
            .strategy_service
            .save_strategies(group_id, wallet_group.wallets, request.strategies)
            .await
    } else {
        let wallets = vec![request_id.clone()];
        state
            .strategy_service
            .save_strategies_by_key(&request_id, wallets, request.strategies)
            .await
    };

    match result {
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
                wallets: result.wallets,
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
    Path(identifier): Path<String>,
) -> Result<Json<WalletGroupStrategiesResponse>, (StatusCode, String)> {
    if user.user_id != identifier {
        tracing::warn!(
            "ID mismatch: token={}, requested={}",
            user.user_id,
            identifier
        );
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    if let Ok(group_id) = Uuid::parse_str(&identifier) {
        let wallet_group = match state.wallet_group_repo.get(&group_id).await {
            Ok(Some(group)) => group,
            Ok(None) => {
                return Err((
                    StatusCode::NOT_FOUND,
                    format!("Wallet group {} not found", group_id),
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

        match state.strategy_service.get_strategies(group_id).await {
            Ok(Some(result)) => Ok(Json(WalletGroupStrategiesResponse::from(result))),
            Ok(None) => {
                let empty_result =
                    WalletGroupStrategies::new(group_id, wallet_group.wallets, vec![]);
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
    } else {
        match state
            .strategy_service
            .get_strategies_by_key(&identifier)
            .await
        {
            Ok(Some(result)) => Ok(Json(WalletGroupStrategiesResponse::from(result))),
            Ok(None) => {
                let wallets = vec![identifier.clone()];
                let empty_result = WalletGroupStrategies::new(Uuid::nil(), wallets, vec![]);
                let mut response = WalletGroupStrategiesResponse::from(empty_result);
                response.key = identifier;
                Ok(Json(response))
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
}
