use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use defi10_aggregation::DataAggregator;
use defi10_core::{Chain, Protocol};
use defi10_protocols::ProtocolPosition;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{error, info};

use crate::state::AppState;

#[allow(dead_code)]
fn to_protocol_position(r: defi10_core::aggregation::AggregationResult) -> ProtocolPosition {
    // Parse protocol, default to Moralis (wallet) if cannot parse
    let protocol = r.protocol.parse().unwrap_or(Protocol::Moralis);

    // Parse position_type from string
    let position_type = match r.position_type.to_lowercase().as_str() {
        "lending" => defi10_protocols::PositionType::Lending,
        "borrowing" => defi10_protocols::PositionType::Borrowing,
        "liquidity" | "liquidity-pool" => defi10_protocols::PositionType::LiquidityPool,
        "staking" => defi10_protocols::PositionType::Staking,
        "yield" => defi10_protocols::PositionType::Yield,
        _ => defi10_protocols::PositionType::Lending, // default
    };

    ProtocolPosition {
        protocol,
        chain: r.chain.parse().unwrap_or(Chain::Ethereum),
        wallet_address: r.account,
        position_type,
        tokens: vec![defi10_protocols::PositionToken {
            token_address: String::new(),
            symbol: r.token_symbol.clone(),
            name: r.token_symbol.clone(),
            decimals: 18,
            balance: r.balance.to_string(),
            balance_usd: r.value_usd,
            price_usd: if r.balance > 0.0 {
                r.value_usd / r.balance
            } else {
                0.0
            },
            token_type: None,
        }],
        total_value_usd: r.value_usd,
        metadata: serde_json::json!({"timestamp": r.timestamp}),
    }
}

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

/// GET /api/v1/portfolio/:wallet
/// Returns aggregated portfolio data for a wallet
pub async fn get_portfolio(
    Path(wallet): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    info!("Fetching portfolio for wallet: {}", wallet);

    // Find most recent completed job for this wallet
    let job_id = state
        .job_manager
        .find_latest_job_for_wallet(&wallet)
        .map_err(|e| {
            error!("Failed to find job for wallet: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to query aggregation jobs".to_string(),
                }),
            )
        })?;

    // If no job found, return empty portfolio
    let positions = if let Some(job_id) = job_id {
        let results = state.job_manager.get_results(&job_id).map_err(|e| {
            error!("Failed to get results: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to retrieve results".to_string(),
                }),
            )
        })?;

        // Filter results for this wallet and convert to ProtocolPosition
        results
            .into_iter()
            .filter(|r| r.account.eq_ignore_ascii_case(&wallet))
            .map(|r| ProtocolPosition {
                protocol: r.protocol.parse().unwrap_or(Protocol::Moralis),
                chain: r.chain.parse().unwrap_or(Chain::Ethereum),
                wallet_address: r.account,
                position_type: match r.position_type.to_lowercase().as_str() {
                    "lending" => defi10_protocols::PositionType::Lending,
                    "borrowing" => defi10_protocols::PositionType::Borrowing,
                    "liquidity" | "liquidity-pool" => defi10_protocols::PositionType::LiquidityPool,
                    "staking" => defi10_protocols::PositionType::Staking,
                    "yield" => defi10_protocols::PositionType::Yield,
                    _ => defi10_protocols::PositionType::Lending,
                },
                tokens: vec![defi10_protocols::PositionToken {
                    token_address: String::new(),
                    symbol: r.token_symbol.clone(),
                    name: r.token_symbol,
                    decimals: 18,
                    balance: r.balance.to_string(),
                    balance_usd: r.value_usd,
                    price_usd: if r.balance > 0.0 {
                        r.value_usd / r.balance
                    } else {
                        0.0
                    },
                    token_type: None,
                }],
                total_value_usd: r.value_usd,
                metadata: serde_json::json!({
                    "timestamp": r.timestamp,
                }),
            })
            .collect()
    } else {
        info!("No completed jobs found for wallet: {}", wallet);
        Vec::new()
    };

    let aggregator = DataAggregator::new();
    let portfolio = aggregator
        .aggregate_portfolio(wallet.clone(), positions)
        .map_err(|e| {
            error!("Failed to aggregate portfolio: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to aggregate portfolio".to_string(),
                }),
            )
        })?;

    let response = PortfolioResponse {
        wallet_address: portfolio.wallet_address,
        total_value_usd: portfolio.total_value_usd,
        positions_by_protocol: portfolio
            .positions_by_protocol
            .into_iter()
            .map(|(protocol, positions)| {
                (
                    protocol,
                    positions
                        .into_iter()
                        .map(|p| PositionResponse {
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
                        })
                        .collect(),
                )
            })
            .collect(),
        positions_by_chain: portfolio
            .positions_by_chain
            .into_iter()
            .map(|(chain, positions)| {
                (
                    chain,
                    positions
                        .into_iter()
                        .map(|p| PositionResponse {
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
                        })
                        .collect(),
                )
            })
            .collect(),
        last_updated: portfolio.last_updated.to_rfc3339(),
    };

    info!("Successfully fetched portfolio for wallet: {}", wallet);
    Ok((StatusCode::OK, Json(response)))
}

/// GET /api/v1/portfolio/:wallet/summary
/// Returns portfolio summary with distributions
pub async fn get_portfolio_summary(
    Path(wallet): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    info!("Fetching portfolio summary for wallet: {}", wallet);

    // Find most recent completed job for this wallet
    let job_id = state
        .job_manager
        .find_latest_job_for_wallet(&wallet)
        .map_err(|e| {
            error!("Failed to find job for wallet: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to query aggregation jobs".to_string(),
                }),
            )
        })?;

    // If no job found, return empty summary
    let positions = if let Some(job_id) = job_id {
        let results = state.job_manager.get_results(&job_id).map_err(|e| {
            error!("Failed to get results: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to retrieve results".to_string(),
                }),
            )
        })?;

        // Filter results for this wallet and convert to ProtocolPosition
        results
            .into_iter()
            .filter(|r| r.account.eq_ignore_ascii_case(&wallet))
            .map(|r| ProtocolPosition {
                protocol: r.protocol.parse().unwrap_or(Protocol::Moralis),
                chain: r.chain.parse().unwrap_or(Chain::Ethereum),
                wallet_address: r.account,
                position_type: match r.position_type.to_lowercase().as_str() {
                    "lending" => defi10_protocols::PositionType::Lending,
                    "borrowing" => defi10_protocols::PositionType::Borrowing,
                    "liquidity" | "liquidity-pool" => defi10_protocols::PositionType::LiquidityPool,
                    "staking" => defi10_protocols::PositionType::Staking,
                    "yield" => defi10_protocols::PositionType::Yield,
                    _ => defi10_protocols::PositionType::Lending,
                },
                tokens: vec![defi10_protocols::PositionToken {
                    token_address: String::new(),
                    symbol: r.token_symbol.clone(),
                    name: r.token_symbol,
                    decimals: 18,
                    balance: r.balance.to_string(),
                    balance_usd: r.value_usd,
                    price_usd: if r.balance > 0.0 {
                        r.value_usd / r.balance
                    } else {
                        0.0
                    },
                    token_type: None,
                }],
                total_value_usd: r.value_usd,
                metadata: serde_json::json!({
                    "timestamp": r.timestamp,
                }),
            })
            .collect()
    } else {
        info!("No completed jobs found for wallet: {}", wallet);
        Vec::new()
    };

    let aggregator = DataAggregator::new();
    let portfolio = aggregator
        .aggregate_portfolio(wallet.clone(), positions)
        .map_err(|e| {
            error!("Failed to aggregate portfolio: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to aggregate portfolio".to_string(),
                }),
            )
        })?;

    let summary = aggregator.create_summary(&portfolio).map_err(|e| {
        error!("Failed to create summary: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Failed to create summary".to_string(),
            }),
        )
    })?;

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

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
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
