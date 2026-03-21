use thiserror::Error;

pub type Result<T> = std::result::Result<T, DeFi10Error>;

#[derive(Error, Debug)]
pub enum DeFi10Error {
    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Cache error: {0}")]
    Cache(String),

    #[error("Blockchain error: {0}")]
    Blockchain(String),

    #[error("Protocol error: {0}")]
    Protocol(String),

    #[error("API error: {0}")]
    Api(String),

    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("External service error: {0}")]
    ExternalService(String),

    #[error("External API error: {0}")]
    ExternalApiError(String),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Chain not supported: {0:?}")]
    ChainNotSupported(crate::Chain),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl DeFi10Error {
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            DeFi10Error::ExternalService(_) | DeFi10Error::Blockchain(_) | DeFi10Error::Database(_)
        )
    }

    pub fn status_code(&self) -> u16 {
        match self {
            DeFi10Error::NotFound(_) => 404,
            DeFi10Error::Validation(_) => 400,
            DeFi10Error::Authentication(_) => 401,
            DeFi10Error::Unauthorized(_) => 401,
            DeFi10Error::Forbidden(_) => 403,
            DeFi10Error::RateLimitExceeded => 429,
            DeFi10Error::Api(_) => 400,
            _ => 500,
        }
    }
}

impl From<serde_json::Error> for DeFi10Error {
    fn from(err: serde_json::Error) -> Self {
        DeFi10Error::Serialization(err.to_string())
    }
}

// Axum integration (optional feature)
#[cfg(feature = "axum")]
impl axum::response::IntoResponse for DeFi10Error {
    fn into_response(self) -> axum::response::Response {
        use axum::http::StatusCode;
        use axum::Json;

        let status = match &self {
            DeFi10Error::NotFound(_) => StatusCode::NOT_FOUND,
            DeFi10Error::Validation(_) => StatusCode::BAD_REQUEST,
            DeFi10Error::Authentication(_) => StatusCode::UNAUTHORIZED,
            DeFi10Error::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            DeFi10Error::Forbidden(_) => StatusCode::FORBIDDEN,
            DeFi10Error::RateLimitExceeded => StatusCode::TOO_MANY_REQUESTS,
            DeFi10Error::Api(_) => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };

        let body = Json(serde_json::json!({
            "error": self.to_string(),
            "type": format!("{:?}", self).split('(').next().unwrap_or("Unknown")
        }));

        (status, body).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_is_retryable() {
        assert!(DeFi10Error::ExternalService("test".into()).is_retryable());
        assert!(DeFi10Error::Blockchain("test".into()).is_retryable());
        assert!(DeFi10Error::Database("test".into()).is_retryable());
        assert!(!DeFi10Error::Validation("test".into()).is_retryable());
        assert!(!DeFi10Error::NotFound("test".into()).is_retryable());
    }

    #[test]
    fn test_error_status_codes() {
        assert_eq!(DeFi10Error::NotFound("test".into()).status_code(), 404);
        assert_eq!(DeFi10Error::Validation("test".into()).status_code(), 400);
        assert_eq!(
            DeFi10Error::Authentication("test".into()).status_code(),
            401
        );
        assert_eq!(DeFi10Error::Unauthorized("test".into()).status_code(), 401);
        assert_eq!(DeFi10Error::Forbidden("test".into()).status_code(), 403);
        assert_eq!(DeFi10Error::RateLimitExceeded.status_code(), 429);
        assert_eq!(DeFi10Error::Internal("test".into()).status_code(), 500);
    }

    #[test]
    fn test_error_display() {
        let err = DeFi10Error::Validation("Invalid address".into());
        assert_eq!(err.to_string(), "Validation error: Invalid address");
    }

    #[test]
    fn test_serde_json_error_conversion() {
        let json_err = serde_json::from_str::<serde_json::Value>("{invalid json}").unwrap_err();
        let defi_err: DeFi10Error = json_err.into();

        match defi_err {
            DeFi10Error::Serialization(msg) => {
                assert!(!msg.is_empty());
            }
            _ => panic!("Expected Serialization error"),
        }
    }

    #[test]
    fn test_result_type() {
        fn test_function() -> Result<i32> {
            Ok(42)
        }

        assert_eq!(test_function().unwrap(), 42);
    }
}
