mod handlers;
mod middleware;
mod routes;
mod state;
mod worker;

use anyhow::Result;
use defi10_infrastructure::{init_tracing, load_config};
use std::net::SocketAddr;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    init_tracing();

    // Load configuration
    let config = load_config()?;
    info!("Configuration loaded successfully");
    info!("CORS allowed origins: {:?}", config.cors.allowed_origins);

    // Start worker in background
    let worker_config = config.clone();
    tokio::spawn(async move {
        if let Err(e) = worker::start_worker(worker_config).await {
            tracing::error!("Worker error: {}", e);
        }
    });
    info!("Worker started in background");

    // Create application state
    let app_state = state::AppState::new(config.clone()).await?;
    info!("Application state initialized");

    // Build router
    let app = routes::create_router(app_state, &config);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server.port));
    info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("Failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received Ctrl+C signal");
        }
        _ = terminate => {
            tracing::info!("Received terminate signal");
        }
    }

    tracing::info!("Shutting down gracefully...");
}
