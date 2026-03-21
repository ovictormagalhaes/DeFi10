use reqwest::Response;
use serde::de::DeserializeOwned;

use crate::{DeFi10Error, Result};

pub async fn check_response(response: Response, context: &str) -> Result<Response> {
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(DeFi10Error::ExternalApiError(format!(
            "{} error {}: {}",
            context, status, text
        )));
    }
    Ok(response)
}

pub async fn parse_json<T: DeserializeOwned>(response: Response) -> Result<T> {
    response
        .json()
        .await
        .map_err(|e| DeFi10Error::ParseError(e.to_string()))
}

pub async fn check_and_parse<T: DeserializeOwned>(response: Response, context: &str) -> Result<T> {
    parse_json(check_response(response, context).await?).await
}
