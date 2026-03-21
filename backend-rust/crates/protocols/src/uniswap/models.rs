use serde::{Deserialize, Serialize};

/// Uniswap V3 position NFT data

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniswapPosition {
    pub token_id: String,
    pub token0: TokenInfo,
    pub token1: TokenInfo,
    pub liquidity: String,
    pub fee_tier: u32,
    pub tick_lower: i32,
    pub tick_upper: i32,
    pub fees_earned_token0: String,
    pub fees_earned_token1: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub address: String,
    pub symbol: String,
    pub decimals: u8,
    pub amount: String,
    pub amount_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolInfo {
    pub address: String,
    pub token0: String,
    pub token1: String,
    pub fee: u32,
    pub tick: i32,
    pub sqrt_price_x96: String,
    pub liquidity: String,
}

/// GraphQL response structures

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniswapPositionsResponse {
    pub data: Option<UniswapPositionsData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniswapPositionsData {
    pub positions: Vec<Position>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub id: String,
    pub owner: String,
    pub liquidity: String,
    pub deposited_token0: String,
    pub deposited_token1: String,
    pub withdrawn_token0: String,
    pub withdrawn_token1: String,
    pub collected_fees_token0: String,
    pub collected_fees_token1: String,
    pub fee_growth_inside0_last_x128: Option<String>,
    pub fee_growth_inside1_last_x128: Option<String>,
    pub pool: Pool,
    pub tick_lower: TickValue,
    pub tick_upper: TickValue,
    pub transaction: Option<Transaction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pool {
    pub id: String,
    pub fee_tier: String,
    pub token0: Token,
    pub token1: Token,
    pub tick: Option<String>,
    pub sqrt_price: String,
    pub liquidity: String,
    pub fee_growth_global0_x128: Option<String>,
    pub fee_growth_global1_x128: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Token {
    pub id: String,
    pub symbol: String,
    pub decimals: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TickData {
    pub tick_idx: String,
    pub fee_growth_outside0_x128: Option<String>,
    pub fee_growth_outside1_x128: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TickValue {
    Object(TickData),
    Integer(i64),
    Text(String),
}

impl TickValue {
    pub fn as_string(&self) -> String {
        match self {
            TickValue::Object(data) => data.tick_idx.clone(),
            TickValue::Integer(val) => val.to_string(),
            TickValue::Text(val) => val.clone(),
        }
    }

    pub fn fee_growth_outside0(&self) -> Option<&str> {
        match self {
            TickValue::Object(data) => data.fee_growth_outside0_x128.as_deref(),
            _ => None,
        }
    }

    pub fn fee_growth_outside1(&self) -> Option<&str> {
        match self {
            TickValue::Object(data) => data.fee_growth_outside1_x128.as_deref(),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_info_creation() {
        let token = TokenInfo {
            address: "0x123".to_string(),
            symbol: "USDC".to_string(),
            decimals: 6,
            amount: "1000000".to_string(),
            amount_usd: 1.0,
        };

        assert_eq!(token.symbol, "USDC");
        assert_eq!(token.decimals, 6);
    }

    #[test]
    fn test_pool_info_serialization() {
        let pool = PoolInfo {
            address: "0xPool123".to_string(),
            token0: "0xToken0".to_string(),
            token1: "0xToken1".to_string(),
            fee: 3000,
            tick: 100,
            sqrt_price_x96: "1000000000000000000".to_string(),
            liquidity: "500000000".to_string(),
        };

        let json = serde_json::to_string(&pool).unwrap();
        assert!(json.contains("0xPool123"));
    }

    #[test]
    fn test_position_deserialization() {
        let json = r#"{
            "id": "123456",
            "owner": "0xOwner",
            "liquidity": "1000000",
            "depositedToken0": "100",
            "depositedToken1": "200",
            "withdrawnToken0": "0",
            "withdrawnToken1": "0",
            "collectedFeesToken0": "10",
            "collectedFeesToken1": "20",
            "pool": {
                "id": "0xPool",
                "feeTier": "3000",
                "token0": {
                    "id": "0xToken0",
                    "symbol": "USDC",
                    "decimals": "6"
                },
                "token1": {
                    "id": "0xToken1",
                    "symbol": "WETH",
                    "decimals": "18"
                },
                "tick": "100",
                "sqrtPrice": "1000000000000000000",
                "liquidity": "500000000"
            },
            "tickLower": {
                "tickIdx": "-100"
            },
            "tickUpper": {
                "tickIdx": "100"
            }
        }"#;

        let position: Position = serde_json::from_str(json).unwrap();
        assert_eq!(position.id, "123456");
        assert_eq!(position.pool.token0.symbol, "USDC");
    }

    #[test]
    fn test_uniswap_position_creation() {
        let position = UniswapPosition {
            token_id: "12345".to_string(),
            token0: TokenInfo {
                address: "0xToken0".to_string(),
                symbol: "USDC".to_string(),
                decimals: 6,
                amount: "1000000".to_string(),
                amount_usd: 1.0,
            },
            token1: TokenInfo {
                address: "0xToken1".to_string(),
                symbol: "WETH".to_string(),
                decimals: 18,
                amount: "1000000000000000000".to_string(),
                amount_usd: 3000.0,
            },
            liquidity: "5000000".to_string(),
            fee_tier: 3000,
            tick_lower: -100,
            tick_upper: 100,
            fees_earned_token0: "1000".to_string(),
            fees_earned_token1: "100000000000000".to_string(),
        };

        assert_eq!(position.token0.symbol, "USDC");
        assert_eq!(position.fee_tier, 3000);
    }

    #[test]
    fn test_pool_info_parsing() {
        let json = r#"{
            "address": "0xPool123",
            "token0": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            "token1": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            "fee": 3000,
            "tick": 276324,
            "sqrt_price_x96": "1234567890123456789012345",
            "liquidity": "987654321987654321"
        }"#;

        let pool: PoolInfo = serde_json::from_str(json).unwrap();
        assert_eq!(pool.fee, 3000);
        assert_eq!(pool.tick, 276324);
    }

    #[test]
    fn test_uniswap_positions_response_empty() {
        let json = r#"{
            "data": {
                "positions": []
            }
        }"#;

        let response: UniswapPositionsResponse = serde_json::from_str(json).unwrap();
        assert!(response.data.is_some());
        assert_eq!(response.data.unwrap().positions.len(), 0);
    }

    #[test]
    fn test_uniswap_positions_response_null() {
        let json = r#"{ "data": null }"#;
        let response: UniswapPositionsResponse = serde_json::from_str(json).unwrap();
        assert!(response.data.is_none());
    }

    #[test]
    fn test_token_info_different_decimals() {
        let usdc = TokenInfo {
            address: "0xUSDC".to_string(),
            symbol: "USDC".to_string(),
            decimals: 6,
            amount: "1000000".to_string(),
            amount_usd: 1.0,
        };

        let wbtc = TokenInfo {
            address: "0xWBTC".to_string(),
            symbol: "WBTC".to_string(),
            decimals: 8,
            amount: "100000000".to_string(),
            amount_usd: 50000.0,
        };

        assert_eq!(usdc.decimals, 6);
        assert_eq!(wbtc.decimals, 8);
    }

    #[test]
    fn test_uniswap_multiple_positions() {
        let json = r#"{
            "data": {
                "positions": [
                    {
                        "id": "1",
                        "owner": "0xOwner1",
                        "liquidity": "1000000",
                        "depositedToken0": "100",
                        "depositedToken1": "200",
                        "withdrawnToken0": "0",
                        "withdrawnToken1": "0",
                        "collectedFeesToken0": "10",
                        "collectedFeesToken1": "20",
                        "pool": {
                            "id": "0xPool1",
                            "feeTier": "3000",
                            "token0": { "id": "0xT0", "symbol": "USDC", "decimals": "6" },
                            "token1": { "id": "0xT1", "symbol": "WETH", "decimals": "18" },
                            "tick": "100",
                            "sqrtPrice": "1000000000000000000",
                            "liquidity": "500000000"
                        },
                        "tickLower": { "tickIdx": "-100" },
                        "tickUpper": { "tickIdx": "100" }
                    },
                    {
                        "id": "2",
                        "owner": "0xOwner2",
                        "liquidity": "2000000",
                        "depositedToken0": "200",
                        "depositedToken1": "400",
                        "withdrawnToken0": "0",
                        "withdrawnToken1": "0",
                        "collectedFeesToken0": "20",
                        "collectedFeesToken1": "40",
                        "pool": {
                            "id": "0xPool2",
                            "feeTier": "500",
                            "token0": { "id": "0xT2", "symbol": "USDT", "decimals": "6" },
                            "token1": { "id": "0xT3", "symbol": "DAI", "decimals": "18" },
                            "tick": "50",
                            "sqrtPrice": "2000000000000000000",
                            "liquidity": "600000000"
                        },
                        "tickLower": { "tickIdx": "-200" },
                        "tickUpper": { "tickIdx": "200" }
                    }
                ]
            }
        }"#;

        let response: UniswapPositionsResponse = serde_json::from_str(json).unwrap();
        let positions = response.data.unwrap().positions;
        assert_eq!(positions.len(), 2);
        assert_eq!(positions[0].id, "1");
        assert_eq!(positions[1].pool.token0.symbol, "USDT");
    }

    #[test]
    fn test_position_with_fees() {
        let json = r#"{
            "id": "99",
            "owner": "0xOwner",
            "liquidity": "5000000",
            "depositedToken0": "500",
            "depositedToken1": "1000",
            "withdrawnToken0": "100",
            "withdrawnToken1": "200",
            "collectedFeesToken0": "50",
            "collectedFeesToken1": "100",
            "pool": {
                "id": "0xPool",
                "feeTier": "10000",
                "token0": { "id": "0xT0", "symbol": "USDC", "decimals": "6" },
                "token1": { "id": "0xT1", "symbol": "WETH", "decimals": "18" },
                "tick": "100",
                "sqrtPrice": "1000000000000000000",
                "liquidity": "500000000"
            },
            "tickLower": { "tickIdx": "-100" },
            "tickUpper": { "tickIdx": "100" }
        }"#;

        let position: Position = serde_json::from_str(json).unwrap();
        assert_eq!(position.collected_fees_token0, "50");
        assert_eq!(position.collected_fees_token1, "100");
        assert_eq!(position.withdrawn_token0, "100");
    }

    #[test]
    fn test_pool_info_deserialization() {
        let pool = PoolInfo {
            address: "0xPool".to_string(),
            token0: "0xToken0".to_string(),
            token1: "0xToken1".to_string(),
            fee: 3000,
            tick: 100,
            sqrt_price_x96: "1000000000000000000".to_string(),
            liquidity: "500000000".to_string(),
        };

        let json = serde_json::to_string(&pool).unwrap();
        let deserialized: PoolInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.fee, 3000);
    }
}
