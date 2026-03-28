use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use defi10_aggregation::DataAggregator;
use defi10_core::{Chain, Protocol};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::info;

use super::shared::{aggregation_result_to_position, log_internal_error, ErrorResponse};
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct PortfolioResponse {
    pub wallet_address: String,
    pub total_value_usd: f64,
    pub positions_by_protocol: HashMap<Protocol, Vec<PositionResponse>>,
    pub positions_by_chain: HashMap<Chain, Vec<PositionResponse>>,
    pub last_updated: String,
}

#[derive(Debug, Serialize)]
pub struct PositionResponse {
    pub protocol: Protocol,
    pub chain: Chain,
    pub total_value_usd: f64,
    pub tokens: Vec<TokenResponse>,
}

#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub token_address: String,
    pub symbol: String,
    pub balance: String,
    pub balance_usd: f64,
}

#[derive(Debug, Serialize)]
pub struct SummaryResponse {
    pub total_value_usd: f64,
    pub total_positions: usize,
    pub protocols_count: usize,
    pub chains: Vec<Chain>,
    pub protocol_distribution: HashMap<Protocol, f64>,
    pub chain_distribution: HashMap<Chain, f64>,
}

fn to_position_response(p: defi10_protocols::ProtocolPosition) -> PositionResponse {
    PositionResponse {
        protocol: p.protocol,
        chain: p.chain,
        total_value_usd: p.total_value_usd,
        tokens: p
            .tokens
            .into_iter()
            .map(|t| TokenResponse {
                token_address: t.token_address,
                symbol: t.symbol,
                balance: t.balance,
                balance_usd: t.balance_usd,
            })
            .collect(),
    }
}

pub async fn get_portfolio(
    Path(wallet): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    info!("Fetching portfolio for wallet: {}", wallet);

    let job_id = state
        .job_manager
        .find_latest_job_for_wallet(&wallet)
        .await
        .map_err(|e| log_internal_error(e, "Failed to query aggregation jobs"))?;

    let positions = if let Some(job_id) = job_id {
        let results = state
            .job_manager
            .get_results(&job_id)
            .await
            .map_err(|e| log_internal_error(e, "Failed to retrieve results"))?;

        results
            .into_iter()
            .filter(|r| r.account.eq_ignore_ascii_case(&wallet))
            .map(aggregation_result_to_position)
            .collect()
    } else {
        info!("No completed jobs found for wallet: {}", wallet);
        Vec::new()
    };

    let aggregator = DataAggregator::new();
    let portfolio = aggregator
        .aggregate_portfolio(wallet.clone(), positions)
        .map_err(|e| log_internal_error(e, "Failed to aggregate portfolio"))?;

    let response = PortfolioResponse {
        wallet_address: portfolio.wallet_address,
        total_value_usd: portfolio.total_value_usd,
        positions_by_protocol: portfolio
            .positions_by_protocol
            .into_iter()
            .map(|(protocol, positions)| {
                (
                    protocol,
                    positions.into_iter().map(to_position_response).collect(),
                )
            })
            .collect(),
        positions_by_chain: portfolio
            .positions_by_chain
            .into_iter()
            .map(|(chain, positions)| {
                (
                    chain,
                    positions.into_iter().map(to_position_response).collect(),
                )
            })
            .collect(),
        last_updated: portfolio.last_updated.to_rfc3339(),
    };

    info!("Successfully fetched portfolio for wallet: {}", wallet);
    Ok((StatusCode::OK, Json(response)))
}

pub async fn get_portfolio_summary(
    Path(wallet): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    info!("Fetching portfolio summary for wallet: {}", wallet);

    let job_id = state
        .job_manager
        .find_latest_job_for_wallet(&wallet)
        .await
        .map_err(|e| log_internal_error(e, "Failed to query aggregation jobs"))?;

    let positions = if let Some(job_id) = job_id {
        let results = state
            .job_manager
            .get_results(&job_id)
            .await
            .map_err(|e| log_internal_error(e, "Failed to retrieve results"))?;

        results
            .into_iter()
            .filter(|r| r.account.eq_ignore_ascii_case(&wallet))
            .map(aggregation_result_to_position)
            .collect()
    } else {
        info!("No completed jobs found for wallet: {}", wallet);
        Vec::new()
    };

    let aggregator = DataAggregator::new();
    let portfolio = aggregator
        .aggregate_portfolio(wallet.clone(), positions)
        .map_err(|e| log_internal_error(e, "Failed to aggregate portfolio"))?;

    let summary = aggregator
        .create_summary(&portfolio)
        .map_err(|e| log_internal_error(e, "Failed to create summary"))?;

    let protocol_dist = aggregator.calculate_protocol_distribution(&portfolio);
    let chain_dist = aggregator.calculate_chain_distribution(&portfolio);

    let response = SummaryResponse {
        total_value_usd: summary.total_value_usd,
        total_positions: summary.total_positions,
        protocols_count: summary.protocols_count,
        chains: summary.chains,
        protocol_distribution: protocol_dist,
        chain_distribution: chain_dist,
    };

    info!("Successfully fetched summary for wallet: {}", wallet);
    Ok((StatusCode::OK, Json(response)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_portfolio_response_serialization() {
        let response = PortfolioResponse {
            wallet_address: "0x123".to_string(),
            total_value_usd: 1000.0,
            positions_by_protocol: HashMap::new(),
            positions_by_chain: HashMap::new(),
            last_updated: chrono::Utc::now().to_rfc3339(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("wallet_address"));
        assert!(json.contains("total_value_usd"));
    }

    #[test]
    fn test_summary_response_serialization() {
        let response = SummaryResponse {
            total_value_usd: 1000.0,
            total_positions: 5,
            protocols_count: 2,
            chains: vec![Chain::Ethereum],
            protocol_distribution: HashMap::new(),
            chain_distribution: HashMap::new(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("total_value_usd"));
        assert!(json.contains("protocols_count"));
    }
}
