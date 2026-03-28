use axum::{http::StatusCode, response::Json};
use defi10_core::{Chain, Protocol};
use defi10_protocols::ProtocolPosition;
use serde::Serialize;
use tracing::error;

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

pub fn internal_error(msg: &str) -> (StatusCode, Json<ErrorResponse>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse {
            error: msg.to_string(),
        }),
    )
}

pub fn log_internal_error(
    e: impl std::fmt::Display,
    msg: &str,
) -> (StatusCode, Json<ErrorResponse>) {
    error!("{}: {}", msg, e);
    internal_error(msg)
}

pub fn parse_position_type(s: &str) -> defi10_protocols::PositionType {
    match s.to_lowercase().as_str() {
        "lending" => defi10_protocols::PositionType::Lending,
        "borrowing" => defi10_protocols::PositionType::Borrowing,
        "liquidity" | "liquidity-pool" => defi10_protocols::PositionType::LiquidityPool,
        "staking" => defi10_protocols::PositionType::Staking,
        "yield" => defi10_protocols::PositionType::Yield,
        _ => defi10_protocols::PositionType::Lending,
    }
}

pub fn aggregation_result_to_position(
    r: defi10_core::aggregation::AggregationResult,
) -> ProtocolPosition {
    let protocol = r.protocol.parse().unwrap_or(Protocol::Moralis);
    let position_type = parse_position_type(&r.position_type);

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
