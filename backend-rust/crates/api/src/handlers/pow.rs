use axum::{extract::State, http::StatusCode, Json};
use defi10_core::pow::{Challenge, ProofRequest, ProofResponse};
use std::sync::Arc;

use crate::state::AppState;

pub async fn generate_challenge(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Challenge>, (StatusCode, String)> {
    match state.pow_service.generate_challenge() {
        Ok(challenge) => Ok(Json(challenge)),
        Err(e) => {
            tracing::error!("Failed to generate PoW challenge: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to generate challenge: {}", e),
            ))
        }
    }
}

pub async fn validate_proof(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ProofRequest>,
) -> Result<Json<ProofResponse>, (StatusCode, String)> {
    if request.challenge.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Challenge is required".to_string()));
    }

    if request.nonce.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Nonce is required".to_string()));
    }

    match state
        .pow_service
        .validate_proof(&request.challenge, &request.nonce)
    {
        Ok(valid) => {
            if valid {
                if let Err(e) = state.pow_service.invalidate_challenge(&request.challenge) {
                    tracing::warn!(
                        "Failed to invalidate challenge after successful validation: {}",
                        e
                    );
                }
            }
            Ok(Json(ProofResponse { valid }))
        }
        Err(e) => {
            tracing::error!("Failed to validate PoW proof: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to validate proof: {}", e),
            ))
        }
    }
}
