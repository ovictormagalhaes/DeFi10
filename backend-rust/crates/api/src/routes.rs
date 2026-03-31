use crate::{
    handlers,
    middleware::{auth_middleware, optional_auth_middleware},
    state::AppState,
};
use axum::http::StatusCode;
use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use defi10_infrastructure::config::AppConfig;
use std::sync::Arc;
use std::time::Duration;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    limit::RequestBodyLimitLayer,
    timeout::TimeoutLayer,
    trace::TraceLayer,
};

pub fn create_router(state: AppState, config: &AppConfig) -> Router {
    let state = Arc::new(state);

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(
            config
                .cors
                .allowed_origins
                .iter()
                .filter_map(|origin| origin.parse().ok())
                .collect::<Vec<_>>(),
        )
        .allow_methods(Any)
        .allow_headers(Any);

    let middleware_stack = ServiceBuilder::new()
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    // Protected routes (require JWT authentication)
    let protected_routes = Router::new()
        .route(
            "/wallet-groups",
            get(handlers::wallet_groups::list_wallet_groups),
        )
        .route(
            "/wallet-groups/:id",
            get(handlers::wallet_groups::get_wallet_group),
        )
        .route(
            "/wallet-groups/:id",
            axum::routing::put(handlers::wallet_groups::update_wallet_group),
        )
        .route(
            "/wallet-groups/:id",
            axum::routing::delete(handlers::wallet_groups::delete_wallet_group),
        )
        // Strategy routes (protected)
        .route("/strategies", post(handlers::strategies::save_strategies))
        .route(
            "/strategies/:wallet_group_id",
            get(handlers::strategies::get_strategies),
        )
        // History & analytics routes (protected)
        .route(
            "/wallet-groups/:id/history",
            get(handlers::history::get_history),
        )
        .route(
            "/wallet-groups/:id/history/positions",
            get(handlers::history::get_position_history),
        )
        .route(
            "/wallet-groups/:id/history/:date",
            get(handlers::history::get_snapshot_detail),
        )
        .route(
            "/wallet-groups/:id/analytics/summary",
            get(handlers::history::get_analytics_summary),
        )
        .route(
            "/wallet-groups/:id/analytics/protocol-allocation",
            get(handlers::history::get_protocol_allocation),
        )
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    let optional_auth_routes = Router::new()
        .route("/aggregations", post(handlers::start_aggregation))
        .route("/aggregations/:job_id", get(handlers::get_job_status))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            optional_auth_middleware,
        ));

    // API v1 routes
    let api_v1 = Router::new()
        .route("/health", get(handlers::health_check))
        .route(
            "/wallets/supported-chains",
            get(handlers::get_supported_chains),
        )
        .merge(protected_routes)
        .merge(optional_auth_routes)
        .route("/pow/challenge", post(handlers::pow::generate_challenge))
        // Wallet auth (public - uses PoW for authentication)
        .route("/auth/wallet", post(handlers::auth::authenticate_wallet))
        // Wallet Group public routes
        .route(
            "/wallet-groups",
            post(handlers::wallet_groups::create_wallet_group),
        )
        .route(
            "/wallet-groups/:id/connect",
            post(handlers::wallet_groups::connect_wallet_group),
        )
        .route(
            "/tokens/logos/:address",
            get(handlers::tokens::get_token_logo),
        )
        .with_state(state.clone());

    Router::new()
        .nest("/api/v1", api_v1)
        .layer(middleware_stack)
        .layer(TimeoutLayer::with_status_code(
            StatusCode::GATEWAY_TIMEOUT,
            Duration::from_secs(30),
        ))
        .layer(RequestBodyLimitLayer::new(1024 * 1024))
}

#[cfg(test)]
mod tests {
    use super::*;
    use defi10_infrastructure::config::*;

    fn create_test_config() -> AppConfig {
        AppConfig {
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 10000,
            },
            mongodb: MongoConfig {
                uri: "mongodb://localhost:27017".to_string(),
                database: "test".to_string(),
            },
            redis: RedisConfig {
                url: "redis://localhost:6379".to_string(),
                pool_size: 10,
                default_ttl_seconds: 300,
                account_cache_ttl_seconds: 120,
            },
            rabbitmq: RabbitMqConfig {
                url: "amqp://localhost:5672".to_string(),
                prefetch_count: 10,
                worker_concurrency: 10,
            },
            jwt: JwtConfig {
                secret: "test_secret".to_string(),
                expiration_hours: 168,
                wallet_expiration_days: 7,
            },
            cors: CorsConfig {
                allowed_origins: vec!["http://localhost:3000".to_string()],
            },
            rate_limiting: RateLimitingConfig {
                enabled: false,
                max_requests: 100,
                window_seconds: 60,
            },
            blockchain: BlockchainConfig {
                ethereum_rpc: None,
                base_rpc: None,
                arbitrum_rpc: None,
                bnb_rpc: None,
                solana_rpc: None,
                alchemy_api_key: None,
            },
            moralis: None,
            graph: None,
            newrelic: None,
        }
    }

    #[test]
    fn test_create_router() {
        let _config = create_test_config();
    }

    #[test]
    fn test_config_cors_origins() {
        let config = create_test_config();
        assert_eq!(config.cors.allowed_origins.len(), 1);
        assert_eq!(config.cors.allowed_origins[0], "http://localhost:3000");
    }
}
