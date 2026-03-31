use axum::{extract::State, http::StatusCode, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::middleware::auth::generate_wallet_token;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletAuthRequest {
    pub address: String,
    pub challenge: String,
    pub nonce: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletAuthResponse {
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub address: String,
}

pub async fn authenticate_wallet(
    State(state): State<Arc<AppState>>,
    Json(request): Json<WalletAuthRequest>,
) -> Result<Json<WalletAuthResponse>, (StatusCode, String)> {
    if request.address.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Address is required".to_string()));
    }

    if request.challenge.is_empty() || request.nonce.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Challenge and nonce are required".to_string(),
        ));
    }

    let valid = state
        .pow_service
        .validate_proof(&request.challenge, &request.nonce)
        .await
        .map_err(|e| {
            tracing::error!("PoW validation error: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to validate proof".to_string(),
            )
        })?;

    if !valid {
        return Err((StatusCode::UNAUTHORIZED, "Invalid proof of work".to_string()));
    }

    if let Err(e) = state
        .pow_service
        .invalidate_challenge(&request.challenge)
        .await
    {
        tracing::warn!("Failed to invalidate challenge: {}", e);
    }

    let token_data = generate_wallet_token(
        &request.address,
        &state.config.jwt.secret,
        state.config.jwt.wallet_expiration_days,
    )
    .map_err(|e| {
        tracing::error!("Failed to generate wallet token: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to generate token".to_string(),
        )
    })?;

    tracing::info!(
        "Generated wallet JWT for address {}, expires_at={}",
        request.address,
        token_data.expires_at
    );

    Ok(Json(WalletAuthResponse {
        token: token_data.token,
        expires_at: token_data.expires_at,
        address: request.address,
    }))
}
