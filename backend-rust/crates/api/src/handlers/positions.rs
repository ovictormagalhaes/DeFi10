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
use tracing::info;

use super::shared::{aggregation_result_to_position, log_internal_error, ErrorResponse};
use crate::state::AppState;

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

fn to_position_detail(pos: ProtocolPosition) -> PositionDetail {
    PositionDetail {
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
    }
}

pub async fn get_positions(
    Path(wallet): Path<String>,
    Query(params): Query<PositionsQuery>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    info!(
        "Fetching positions for wallet: {} (protocol: {:?}, chain: {:?})",
        wallet, params.protocol, params.chain
    );

    let job_id = state
        .job_manager
        .find_latest_job_for_wallet(&wallet)
        .await
        .map_err(|e| log_internal_error(e, "Failed to query aggregation jobs"))?;

    let mut positions: Vec<ProtocolPosition> = if let Some(job_id) = job_id {
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

    let position_details: Vec<PositionDetail> =
        positions.into_iter().map(to_position_detail).collect();

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

pub async fn get_positions_by_protocol(
    Path(wallet): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    info!(
        "Fetching positions grouped by protocol for wallet: {}",
        wallet
    );

    let job_id = state
        .job_manager
        .find_latest_job_for_wallet(&wallet)
        .await
        .map_err(|e| log_internal_error(e, "Failed to query aggregation jobs"))?;

    let positions: Vec<ProtocolPosition> = if let Some(job_id) = job_id {
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

    let mut grouped: HashMap<Protocol, Vec<PositionDetail>> = HashMap::new();
    for pos in positions {
        let protocol = pos.protocol;
        grouped
            .entry(protocol)
            .or_default()
            .push(to_position_detail(pos));
    }

    info!("Successfully grouped positions for wallet: {}", wallet);
    Ok((StatusCode::OK, Json(grouped)))
}

pub async fn get_positions_by_chain(
    Path(wallet): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    info!("Fetching positions grouped by chain for wallet: {}", wallet);

    let job_id = state
        .job_manager
        .find_latest_job_for_wallet(&wallet)
        .await
        .map_err(|e| log_internal_error(e, "Failed to query aggregation jobs"))?;

    let positions: Vec<ProtocolPosition> = if let Some(job_id) = job_id {
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

    let mut grouped: HashMap<Chain, Vec<PositionDetail>> = HashMap::new();
    for pos in positions {
        let chain = pos.chain;
        grouped
            .entry(chain)
            .or_default()
            .push(to_position_detail(pos));
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
