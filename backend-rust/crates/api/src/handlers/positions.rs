use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use defi10_core::{Chain, Protocol};
use defi10_protocols::ProtocolPosition;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{error, info};

use crate::state::AppState;

/// Helper function to convert AggregationResult to ProtocolPosition
fn aggregation_result_to_protocol_position(
    r: defi10_core::aggregation::AggregationResult,
) -> ProtocolPosition {
    // Parse protocol, default to Moralis (wallet) if "native"
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
pub struct PositionsResponse {
    pub wallet_address: String,
    pub total_positions: usize,
    pub positions: Vec<PositionDetail>,
}

#[derive(Debug, Serialize)]
pub struct PositionDetail {
    pub protocol: Protocol,
    pub chain: Chain,
    pub position_type: String,
    pub total_value_usd: f64,
    pub tokens: Vec<TokenDetail>,
}

#[derive(Debug, Serialize)]
pub struct TokenDetail {
    pub token_address: String,
    pub symbol: String,
    pub balance: String,
    pub balance_usd: f64,
    pub price_usd: f64,
}

#[derive(Debug, Deserialize)]
pub struct PositionsQuery {
    pub protocol: Option<String>,
    pub chain: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// GET /api/v1/positions/:wallet
/// Returns all positions for a wallet, optionally filtered by protocol or chain
pub async fn get_positions(
    Path(wallet): Path<String>,
    Query(params): Query<PositionsQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    info!(
        "Fetching positions for wallet: {} (protocol: {:?}, chain: {:?})",
        wallet, params.protocol, params.chain
    );

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

    // If no job found, return empty positions
    let mut positions: Vec<ProtocolPosition> = if let Some(job_id) = job_id {
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
            .map(aggregation_result_to_protocol_position)
            .collect()
    } else {
        info!("No completed jobs found for wallet: {}", wallet);
        Vec::new()
    };

    // Apply filters if provided
    if let Some(protocol_str) = &params.protocol {
        if let Ok(protocol) = protocol_str.parse::<Protocol>() {
            positions.retain(|p| p.protocol == protocol);
            info!("Filtered by protocol: {}", protocol_str);
        }
    }

    if let Some(chain_str) = &params.chain {
        if let Ok(chain) = chain_str.parse::<Chain>() {
            positions.retain(|p| p.chain == chain);
            info!("Filtered by chain: {}", chain_str);
        }
    }

    let position_details: Vec<PositionDetail> = positions
        .into_iter()
        .map(|p| PositionDetail {
            protocol: p.protocol,
            chain: p.chain,
            position_type: format!("{:?}", p.position_type),
            total_value_usd: p.total_value_usd,
            tokens: p
                .tokens
                .into_iter()
                .map(|t| TokenDetail {
                    token_address: t.token_address,
                    symbol: t.symbol,
                    balance: t.balance,
                    balance_usd: t.balance_usd,
                    price_usd: t.price_usd,
                })
                .collect(),
        })
        .collect();

    let response = PositionsResponse {
        wallet_address: wallet.clone(),
        total_positions: position_details.len(),
        positions: position_details,
    };

    info!(
        "Successfully fetched {} positions for wallet: {}",
        response.total_positions, wallet
    );
    Ok((StatusCode::OK, Json(response)))
}

/// GET /api/v1/positions/:wallet/protocols
/// Returns positions grouped by protocol
pub async fn get_positions_by_protocol(
    Path(wallet): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    info!(
        "Fetching positions grouped by protocol for wallet: {}",
        wallet
    );

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

    let positions: Vec<ProtocolPosition> = if let Some(job_id) = job_id {
        let results = state.job_manager.get_results(&job_id).map_err(|e| {
            error!("Failed to get results: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to retrieve results".to_string(),
                }),
            )
        })?;

        results
            .into_iter()
            .filter(|r| r.account.eq_ignore_ascii_case(&wallet))
            .map(aggregation_result_to_protocol_position)
            .collect()
    } else {
        info!("No completed jobs found for wallet: {}", wallet);
        Vec::new()
    };

    // Group by protocol
    let mut grouped: HashMap<Protocol, Vec<PositionDetail>> = HashMap::new();
    for pos in positions {
        let detail = PositionDetail {
            protocol: pos.protocol,
            chain: pos.chain,
            position_type: format!("{:?}", pos.position_type),
            total_value_usd: pos.total_value_usd,
            tokens: pos
                .tokens
                .into_iter()
                .map(|t| TokenDetail {
                    token_address: t.token_address,
                    symbol: t.symbol,
                    balance: t.balance,
                    balance_usd: t.balance_usd,
                    price_usd: t.price_usd,
                })
                .collect(),
        };
        grouped
            .entry(pos.protocol)
            .or_default()
            .push(detail);
    }

    info!("Successfully grouped positions for wallet: {}", wallet);
    Ok((StatusCode::OK, Json(grouped)))
}

/// GET /api/v1/positions/:wallet/chains
/// Returns positions grouped by chain
pub async fn get_positions_by_chain(
    Path(wallet): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    info!("Fetching positions grouped by chain for wallet: {}", wallet);

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

    let positions: Vec<ProtocolPosition> = if let Some(job_id) = job_id {
        let results = state.job_manager.get_results(&job_id).map_err(|e| {
            error!("Failed to get results: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Failed to retrieve results".to_string(),
                }),
            )
        })?;

        results
            .into_iter()
            .filter(|r| r.account.eq_ignore_ascii_case(&wallet))
            .map(aggregation_result_to_protocol_position)
            .collect()
    } else {
        info!("No completed jobs found for wallet: {}", wallet);
        Vec::new()
    };

    // Group by chain
    let mut grouped: HashMap<Chain, Vec<PositionDetail>> = HashMap::new();
    for pos in positions {
        let detail = PositionDetail {
            protocol: pos.protocol,
            chain: pos.chain,
            position_type: format!("{:?}", pos.position_type),
            total_value_usd: pos.total_value_usd,
            tokens: pos
                .tokens
                .into_iter()
                .map(|t| TokenDetail {
                    token_address: t.token_address,
                    symbol: t.symbol,
                    balance: t.balance,
                    balance_usd: t.balance_usd,
                    price_usd: t.price_usd,
                })
                .collect(),
        };
        grouped
            .entry(pos.chain)
            .or_default()
            .push(detail);
    }

    info!("Successfully grouped positions for wallet: {}", wallet);
    Ok((StatusCode::OK, Json(grouped)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_positions_response_serialization() {
        let response = PositionsResponse {
            wallet_address: "0x123".to_string(),
            total_positions: 0,
            positions: vec![],
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("wallet_address"));
        assert!(json.contains("total_positions"));
    }

    #[test]
    fn test_position_detail_serialization() {
        let detail = PositionDetail {
            protocol: Protocol::AaveV3,
            chain: Chain::Ethereum,
            position_type: "Lending".to_string(),
            total_value_usd: 1000.0,
            tokens: vec![],
        };

        let json = serde_json::to_string(&detail).unwrap();
        assert!(json.contains("protocol"));
        assert!(json.contains("chain"));
        assert!(json.contains("total_value_usd"));
    }
}
