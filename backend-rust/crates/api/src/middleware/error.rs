use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use defi10_core::DeFi10Error;
use serde_json::json;
use std::fmt;

#[derive(Debug)]
pub struct ApiError(pub DeFi10Error);

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status_code =
            StatusCode::from_u16(self.0.status_code()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

        let body = Json(json!({
            "error": self.0.to_string(),
            "code": status_code.as_u16(),
        }));

        (status_code, body).into_response()
    }
}

impl From<DeFi10Error> for ApiError {
    fn from(err: DeFi10Error) -> Self {
        ApiError(err)
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_error_display() {
        let error = ApiError(DeFi10Error::NotFound("User not found".to_string()));
        assert_eq!(error.to_string(), "Not found: User not found");
    }

    #[test]
    fn test_api_error_from_defi10_error() {
        let defi_error = DeFi10Error::Validation("Invalid input".to_string());
        let api_error: ApiError = defi_error.into();
        assert_eq!(api_error.0.status_code(), 400);
    }

    #[tokio::test]
    async fn test_api_error_into_response() {
        let error = ApiError(DeFi10Error::NotFound("Resource".to_string()));
        let response = error.into_response();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
