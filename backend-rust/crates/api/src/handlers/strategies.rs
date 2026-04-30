use axum::{
    extract::{Path, State},
    Extension, Json,
};
use chrono::Utc;
use defi10_core::{
    strategy::StrategyType, DeFi10Error, SaveStrategiesRequest, SaveStrategiesResponse,
    StrategySummary, WalletGroupStrategies, WalletGroupStrategiesResponse,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::middleware::auth::AuthUser;
use crate::middleware::error::ApiResult;
use crate::state::AppState;
use super::verify_user_access;

pub async fn save_strategies(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(request): Json<SaveStrategiesRequest>,
) -> ApiResult<Json<SaveStrategiesResponse>> {
    let request_id = request.wallet_group_id.clone();
    verify_user_access(&user, &request_id).map_err(crate::middleware::error::ApiError::from)?;

    let result = if let Ok(group_id) = Uuid::parse_str(&request_id) {
        let wallet_group = state
            .wallet_group_repo
            .get(&group_id)
            .await?
            .ok_or_else(|| DeFi10Error::NotFound(format!("Wallet group {} not found", group_id)))?;

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
                    purchase_window_count: s
                        .purchase_window_entries
                        .as_ref()
                        .map_or(0, |e| e.len()),
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
            Err(crate::middleware::error::ApiError::from(
                DeFi10Error::Api(format!("Failed to save strategies: {}", e)),
            ))
        }
    }
}

pub async fn get_strategies(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(identifier): Path<String>,
) -> ApiResult<Json<WalletGroupStrategiesResponse>> {
    verify_user_access(&user, &identifier).map_err(crate::middleware::error::ApiError::from)?;

    let mut wgs = if let Ok(group_id) = Uuid::parse_str(&identifier) {
        let wallet_group = state
            .wallet_group_repo
            .get(&group_id)
            .await?
            .ok_or_else(|| DeFi10Error::NotFound(format!("Wallet group {} not found", group_id)))?;

        match state.strategy_service.get_strategies(group_id).await {
            Ok(Some(result)) => result,
            Ok(None) => WalletGroupStrategies::new(group_id, wallet_group.wallets, vec![]),
            Err(e) => {
                tracing::error!("Failed to get strategies: {}", e);
                return Err(crate::middleware::error::ApiError::from(
                    DeFi10Error::Api(format!("Failed to get strategies: {}", e)),
                ));
            }
        }
    } else {
        match state
            .strategy_service
            .get_strategies_by_key(&identifier)
            .await
        {
            Ok(Some(result)) => result,
            Ok(None) => {
                let wallets = vec![identifier.clone()];
                let mut response = WalletGroupStrategiesResponse::from(
                    WalletGroupStrategies::new(Uuid::nil(), wallets, vec![]),
                );
                response.key = identifier;
                return Ok(Json(response));
            }
            Err(e) => {
                tracing::error!("Failed to get strategies: {}", e);
                return Err(crate::middleware::error::ApiError::from(
                    DeFi10Error::Api(format!("Failed to get strategies: {}", e)),
                ));
            }
        }
    };

    for strategy in &mut wgs.strategies {
        if strategy.strategy_type == StrategyType::BestPurchaseWindow {
            if let Some(entries) = &strategy.purchase_window_entries {
                let results = state
                    .purchase_window_service
                    .evaluate_entries(entries)
                    .await;
                strategy.purchase_window_results = Some(results);
            }
        }
    }

    Ok(Json(WalletGroupStrategiesResponse::from(wgs)))
}
