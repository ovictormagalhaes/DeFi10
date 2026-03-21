use async_trait::async_trait;
use defi10_core::aggregation::AggregationResult;
use defi10_core::{Chain, Protocol};
use serde::{Deserialize, Serialize};

pub struct FetchContext {
    pub rpc_url: String,
}

#[async_trait]
pub trait ProtocolAdapter: Send + Sync {
    fn name(&self) -> &str;
    fn supported_chains(&self) -> Vec<Chain>;
    async fn fetch_positions(
        &self,
        account: &str,
        chain: Chain,
        ctx: &FetchContext,
    ) -> anyhow::Result<Vec<AggregationResult>>;
}

pub fn positions_to_results(
    account: &str,
    positions: Vec<ProtocolPosition>,
) -> Vec<AggregationResult> {
    let mut results = Vec::new();
    for pos in positions {
        let apy = pos.metadata.get("apy").and_then(|v| v.as_f64());
        let apr = pos.metadata.get("apr").and_then(|v| v.as_f64());
        let health_factor = pos.metadata.get("healthFactor").and_then(|v| v.as_f64());
        let is_collateral = pos
            .metadata
            .get("isCollateral")
            .and_then(|v| v.as_bool())
            .or_else(|| pos.metadata.get("is_collateral").and_then(|v| v.as_bool()));
        let can_be_collateral = pos
            .metadata
            .get("can_be_collateral")
            .and_then(|v| v.as_bool());

        let chain_str = format!("{:?}", pos.chain).to_lowercase();
        let protocol_str = pos.protocol.key().to_string();
        let position_type_str = format!("{:?}", pos.position_type).to_lowercase();

        for token in &pos.tokens {
            let balance = token.balance.parse::<f64>().unwrap_or(0.0);
            if balance <= 0.0 {
                continue;
            }
            let raw_balance = (balance * 10f64.powi(token.decimals as i32)) as u128;

            results.push(AggregationResult {
                account: account.to_string(),
                chain: chain_str.clone(),
                protocol: protocol_str.clone(),
                position_type: position_type_str.clone(),
                balance,
                balance_raw: raw_balance.to_string(),
                decimals: token.decimals,
                value_usd: token.balance_usd,
                price_usd: token.price_usd,
                token_symbol: token.symbol.clone(),
                token_name: token.name.clone(),
                token_address: token.token_address.clone(),
                timestamp: chrono::Utc::now(),
                apy,
                apr,
                apr_historical: None,
                health_factor,
                is_collateral,
                can_be_collateral,
                logo: None,
                token_type: token.token_type.clone(),
                metadata: Some(pos.metadata.clone()),
            });
        }
    }
    results
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolPosition {
    pub protocol: Protocol,
    pub chain: Chain,
    pub wallet_address: String,
    pub position_type: PositionType,
    pub tokens: Vec<PositionToken>,
    pub total_value_usd: f64,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PositionType {
    Lending,
    Borrowing,
    LiquidityPool,
    Staking,
    Yield,
    Locking,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionToken {
    pub token_address: String,
    pub symbol: String,
    pub name: String,
    pub decimals: u8,
    pub balance: String,
    pub balance_usd: f64,
    pub price_usd: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_type: Option<String>,
}

/// APY/APR information for a protocol position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YieldInfo {
    pub apy: f64,
    pub apr: f64,
    pub breakdown: Vec<YieldComponent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YieldComponent {
    pub name: String,
    pub apy: f64,
    pub token_symbol: Option<String>,
}

/// Market information for a protocol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketInfo {
    pub protocol: Protocol,
    pub chain: Chain,
    pub market_id: String,
    pub name: String,
    pub total_supply_usd: f64,
    pub total_borrow_usd: f64,
    pub liquidity_rate: f64,
    pub borrow_rate: f64,
    pub utilization_rate: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_position_creation() {
        let position = ProtocolPosition {
            protocol: Protocol::AaveV3,
            chain: Chain::Ethereum,
            wallet_address: "0x123".to_string(),
            position_type: PositionType::Lending,
            tokens: vec![],
            total_value_usd: 1000.0,
            metadata: serde_json::json!({}),
        };

        assert_eq!(position.protocol, Protocol::AaveV3);
        assert_eq!(position.total_value_usd, 1000.0);
    }

    #[test]
    fn test_yield_info() {
        let yield_info = YieldInfo {
            apy: 5.5,
            apr: 5.2,
            breakdown: vec![YieldComponent {
                name: "Base APY".to_string(),
                apy: 5.5,
                token_symbol: Some("USDC".to_string()),
            }],
        };

        assert_eq!(yield_info.apy, 5.5);
        assert_eq!(yield_info.breakdown.len(), 1);
    }

    #[test]
    fn test_position_type_serialization() {
        let pos_type = PositionType::Lending;
        let json = serde_json::to_string(&pos_type).unwrap();
        assert_eq!(json, r#""lending""#);

        let deserialized: PositionType = serde_json::from_str(&json).unwrap();
        assert!(matches!(deserialized, PositionType::Lending));
    }
}
