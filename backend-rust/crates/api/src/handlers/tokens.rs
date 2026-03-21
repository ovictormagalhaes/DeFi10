use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

use crate::state::AppState;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenLogoResponse {
    pub address: String,
    pub logo_url: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTokenLogoRequest {
    pub logo_url: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchTokenLogoResponse {
    pub logos: HashMap<String, String>,
    pub count: usize,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchGetRequest {
    pub addresses: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchSetLogosRequest {
    pub logos: HashMap<String, String>,
}

/// GET /api/v1/tokens/logos/:address - Get logo for a single token
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

/// POST /api/v1/tokens/logos/:address - Set logo for a single token
pub async fn set_token_logo(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
    Json(request): Json<SetTokenLogoRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    if request.logo_url.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Logo URL is required".to_string()));
    }

    match state
        .token_logo_service
        .set_token_logo(&address, &request.logo_url)
        .await
    {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            tracing::error!("Failed to set token logo for {}: {}", address, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to set token logo: {}", e),
            ))
        }
    }
}

/// GET /api/v1/tokens/logos - Get all cached token logos
pub async fn get_all_token_logos(
    State(state): State<Arc<AppState>>,
) -> Result<Json<BatchTokenLogoResponse>, (StatusCode, String)> {
    match state.token_logo_service.get_all_token_logos().await {
        Ok(logos) => {
            let count = logos.len();
            Ok(Json(BatchTokenLogoResponse { logos, count }))
        }
        Err(e) => {
            tracing::error!("Failed to get all token logos: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to get all token logos: {}", e),
            ))
        }
    }
}

/// POST /api/v1/tokens/logos/batch - Get logos for multiple tokens
pub async fn get_token_logos_batch(
    State(state): State<Arc<AppState>>,
    Json(request): Json<BatchGetRequest>,
) -> Result<Json<BatchTokenLogoResponse>, (StatusCode, String)> {
    if request.addresses.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Addresses array is required".to_string(),
        ));
    }

    match state
        .token_logo_service
        .get_token_logos_batch(&request.addresses)
        .await
    {
        Ok(logos) => {
            let count = logos.len();
            Ok(Json(BatchTokenLogoResponse { logos, count }))
        }
        Err(e) => {
            tracing::error!("Failed to get token logos batch: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to get token logos: {}", e),
            ))
        }
    }
}

/// POST /api/v1/tokens/logos/batch/set - Set logos for multiple tokens
pub async fn set_token_logos_batch(
    State(state): State<Arc<AppState>>,
    Json(request): Json<BatchSetLogosRequest>,
) -> Result<Json<BatchTokenLogoResponse>, (StatusCode, String)> {
    if request.logos.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "Logos object is required".to_string(),
        ));
    }

    match state
        .token_logo_service
        .set_token_logos_batch(request.logos.clone())
        .await
    {
        Ok(_) => {
            let count = request.logos.len();
            Ok(Json(BatchTokenLogoResponse {
                logos: request.logos,
                count,
            }))
        }
        Err(e) => {
            tracing::error!("Failed to set token logos batch: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to set token logos: {}", e),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_logo_response_serialization() {
        let response = TokenLogoResponse {
            address: "0x123".to_string(),
            logo_url: Some("https://example.com/logo.png".to_string()),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("logoUrl"));
        assert!(json.contains("address"));
    }

    #[test]
    fn test_batch_request_deserialization() {
        let json = r#"{"addresses": ["0x123", "0x456"]}"#;
        let request: BatchGetRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.addresses.len(), 2);
    }
}
