use axum::{extract::Query, http::StatusCode, response::IntoResponse};
use serde::Deserialize;

use super::image_proxy;

const ALLOWED_HOSTS: &[&str] = &[
    "assets.coingecko.com",
    "coin-images.coingecko.com",
    "raw.githubusercontent.com",
    "s2.coinmarketcap.com",
    "statics.solscan.io",
    "cdn.jsdelivr.net",
    "arweave.net",
    "ipfs.io",
    "cloudflare-ipfs.com",
    "gateway.ipfs.io",
    "assets.smold.app",
    "tokens.1inch.io",
    "logos.covalenthq.com",
    "token-icons.s3.amazonaws.com",
];

#[derive(Debug, Deserialize)]
pub struct ProxyImageQuery {
    pub url: String,
}

pub async fn proxy_image(
    Query(params): Query<ProxyImageQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let parsed = reqwest::Url::parse(&params.url)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid URL".to_string()))?;

    if parsed.scheme() != "https" {
        return Err((StatusCode::BAD_REQUEST, "Only HTTPS allowed".to_string()));
    }

    let host = parsed
        .host_str()
        .ok_or((StatusCode::BAD_REQUEST, "URL missing host".to_string()))?
        .to_lowercase();

    if !ALLOWED_HOSTS.contains(&host.as_str()) {
        return Err((StatusCode::FORBIDDEN, format!("Host not allowed: {}", host)));
    }

    image_proxy::fetch_and_proxy_image(parsed, 604800).await
}
