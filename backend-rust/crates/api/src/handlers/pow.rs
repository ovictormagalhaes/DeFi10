use axum::{extract::State, http::StatusCode, Json};
use defi10_core::pow::Challenge;
use std::sync::Arc;

use crate::state::AppState;

pub async fn generate_challenge(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Challenge>, (StatusCode, String)> {
    match state.pow_service.generate_challenge().await {
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
