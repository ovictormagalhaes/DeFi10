use axum::{
    body::Bytes,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
};
use std::time::Duration;

pub const MAX_IMAGE_BYTES: usize = 2 * 1024 * 1024;
pub const PROXY_TIMEOUT_SECS: u64 = 5;
pub const ALLOWED_MIME_PREFIX: &str = "image/";

pub async fn fetch_and_proxy_image(
    url: reqwest::Url,
    cache_max_age: u32,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(PROXY_TIMEOUT_SECS))
        .redirect(reqwest::redirect::Policy::limited(3))
        .build()
        .map_err(|e| {
            tracing::error!("Failed to build HTTP client: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Client error".to_string(),
            )
        })?;

    let resp = client.get(url).send().await.map_err(|e| {
        tracing::warn!("Upstream fetch failed: {}", e);
        (StatusCode::BAD_GATEWAY, "Upstream fetch failed".to_string())
    })?;

    if !resp.status().is_success() {
        return Err((
            StatusCode::BAD_GATEWAY,
            format!("Upstream returned {}", resp.status()),
        ));
    }

    let content_type = resp
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    if !content_type.starts_with(ALLOWED_MIME_PREFIX) {
        return Err((
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "Upstream is not an image".to_string(),
        ));
    }

    if let Some(len) = resp.content_length() {
        if len as usize > MAX_IMAGE_BYTES {
            return Err((StatusCode::PAYLOAD_TOO_LARGE, "Image too large".to_string()));
        }
    }

    let bytes = resp.bytes().await.map_err(|e| {
        tracing::warn!("Failed reading upstream body: {}", e);
        (StatusCode::BAD_GATEWAY, "Body read failed".to_string())
    })?;

    if bytes.len() > MAX_IMAGE_BYTES {
        return Err((StatusCode::PAYLOAD_TOO_LARGE, "Image too large".to_string()));
    }

    let cache_control = format!("public, max-age={}, immutable", cache_max_age);
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(&content_type)
            .unwrap_or_else(|_| HeaderValue::from_static("image/png")),
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_str(&cache_control)
            .unwrap_or_else(|_| HeaderValue::from_static("public, max-age=86400, immutable")),
    );

    Ok((StatusCode::OK, headers, Bytes::from(bytes)))
}
