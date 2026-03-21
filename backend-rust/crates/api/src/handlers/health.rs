use crate::{middleware::ApiResult, state::AppState};
use axum::{extract::State, http::StatusCode, Json};
use std::sync::Arc;

pub async fn health_check(
    State(state): State<Arc<AppState>>,
) -> ApiResult<(StatusCode, Json<serde_json::Value>)> {
    let health_status = state.health_check().await?;

    let status_code = if health_status.healthy {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    Ok((
        status_code,
        Json(serde_json::to_value(health_status).unwrap()),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{HealthStatus, ServiceStatus};

    #[test]
    fn test_health_status_serialization() {
        let status = HealthStatus {
            healthy: true,
            database: ServiceStatus::Healthy,
            cache: ServiceStatus::Healthy,
            messaging: ServiceStatus::Healthy,
        };

        let json = serde_json::to_value(&status).unwrap();
        assert_eq!(json["healthy"], true);
        assert_eq!(json["database"]["status"], "healthy");
    }

    #[test]
    fn test_health_status_unhealthy() {
        let status = HealthStatus {
            healthy: false,
            database: ServiceStatus::Unhealthy {
                error: "DB error".to_string(),
            },
            cache: ServiceStatus::Healthy,
            messaging: ServiceStatus::Healthy,
        };

        let json = serde_json::to_value(&status).unwrap();
        assert_eq!(json["healthy"], false);
        assert_eq!(json["database"]["status"], "unhealthy");
    }
}
