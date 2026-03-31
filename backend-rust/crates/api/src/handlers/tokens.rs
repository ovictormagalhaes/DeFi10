use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenLogoResponse {
    pub address: String,
    pub logo_url: Option<String>,
}

pub async fn get_token_logo(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<Json<TokenLogoResponse>, (StatusCode, String)> {
    match state.token_logo_service.get_token_logo(&address).await {
        Ok(logo_url) => Ok(Json(TokenLogoResponse { address, logo_url })),
        Err(e) => {
            tracing::error!("Failed to get token logo for {}: {}", address, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to get token logo: {}", e),
            ))
        }
    }
}
