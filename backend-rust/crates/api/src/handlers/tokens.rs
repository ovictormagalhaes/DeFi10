use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use super::image_proxy;
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

fn is_valid_address(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 128
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

pub async fn proxy_token_logo(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    if !is_valid_address(&address) {
        return Err((
            StatusCode::BAD_REQUEST,
            "Invalid address format".to_string(),
        ));
    }

    let logo_url = state
        .token_logo_service
        .get_token_logo(&address)
        .await
        .map_err(|e| {
            tracing::error!("Failed to resolve logo URL for {}: {}", address, e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Lookup failed".to_string(),
            )
        })?
        .ok_or((StatusCode::NOT_FOUND, "Logo not found".to_string()))?;

    let parsed = reqwest::Url::parse(&logo_url)
        .map_err(|_| (StatusCode::BAD_GATEWAY, "Invalid upstream URL".to_string()))?;
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err((
            StatusCode::BAD_GATEWAY,
            "Unsupported URL scheme".to_string(),
        ));
    }

    image_proxy::fetch_and_proxy_image(parsed, 86400).await
}
