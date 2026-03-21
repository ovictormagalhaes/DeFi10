use serde::{Deserialize, Serialize};

/// Raydium API response structures

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RaydiumPoolsResponse {
    pub data: Vec<RaydiumPool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RaydiumPool {
    pub id: String,
    pub name: String,
    pub lp_mint: String,
    pub mint_a: MintInfo,
    pub mint_b: MintInfo,
    pub lp_price: f64,
    pub tvl: f64,
    pub apr: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MintInfo {
    pub address: String,
    pub symbol: String,
    pub decimals: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RaydiumUserPosition {
    pub pool_id: String,
    pub lp_amount: String,
    pub lp_value_usd: f64,
    pub token_a_amount: String,
    pub token_b_amount: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pool_parsing() {
        let pool = RaydiumPool {
            id: "Pool123".to_string(),
            name: "SOL-USDC".to_string(),
            lp_mint: "LP123".to_string(),
            mint_a: MintInfo {
                address: "SOL111".to_string(),
                symbol: "SOL".to_string(),
                decimals: 9,
            },
            mint_b: MintInfo {
                address: "USDC222".to_string(),
                symbol: "USDC".to_string(),
                decimals: 6,
            },
            lp_price: 10.0,
            tvl: 1000000.0,
            apr: 15.5,
        };

        assert_eq!(pool.name, "SOL-USDC");
        assert_eq!(pool.apr, 15.5);
    }

    #[test]
    fn test_raydium_pool_serialization() {
        let pool = RaydiumPool {
            id: "PoolABC".to_string(),
            name: "SOL-USDT".to_string(),
            lp_mint: "LPToken".to_string(),
            mint_a: MintInfo {
                address: "So11111111111111111111111111111111111111112".to_string(),
                symbol: "SOL".to_string(),
                decimals: 9,
            },
            mint_b: MintInfo {
                address: "USDT".to_string(),
                symbol: "USDT".to_string(),
                decimals: 6,
            },
            lp_price: 25.5,
            tvl: 5000000.0,
            apr: 12.3,
        };

        let json = serde_json::to_string(&pool).unwrap();
        let deserialized: RaydiumPool = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.name, "SOL-USDT");
        assert_eq!(deserialized.tvl, 5000000.0);
    }

    #[test]
    fn test_raydium_pools_response() {
        let json = r#"{
            "data": [
                {
                    "id": "Pool1",
                    "name": "SOL-USDC",
                    "lpMint": "LP1",
                    "mintA": { "address": "SOL", "symbol": "SOL", "decimals": 9 },
                    "mintB": { "address": "USDC", "symbol": "USDC", "decimals": 6 },
                    "lpPrice": 10.0,
                    "tvl": 1000000.0,
                    "apr": 15.5
                },
                {
                    "id": "Pool2",
                    "name": "RAY-USDC",
                    "lpMint": "LP2",
                    "mintA": { "address": "RAY", "symbol": "RAY", "decimals": 6 },
                    "mintB": { "address": "USDC", "symbol": "USDC", "decimals": 6 },
                    "lpPrice": 5.0,
                    "tvl": 500000.0,
                    "apr": 20.0
                }
            ]
        }"#;

        let response: RaydiumPoolsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.data.len(), 2);
        assert_eq!(response.data[0].name, "SOL-USDC");
        assert_eq!(response.data[1].apr, 20.0);
    }

    #[test]
    fn test_raydium_user_position() {
        let json = r#"{
            "poolId": "Pool123",
            "lpAmount": "1000000000",
            "lpValueUsd": 10000.0,
            "tokenAAmount": "5000000000",
            "tokenBAmount": "5000000"
        }"#;

        let position: RaydiumUserPosition = serde_json::from_str(json).unwrap();
        assert_eq!(position.pool_id, "Pool123");
        assert_eq!(position.lp_value_usd, 10000.0);
    }

    #[test]
    fn test_mint_info_different_decimals() {
        let sol_mint = MintInfo {
            address: "So11111111111111111111111111111111111111112".to_string(),
            symbol: "SOL".to_string(),
            decimals: 9,
        };

        let usdc_mint = MintInfo {
            address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v".to_string(),
            symbol: "USDC".to_string(),
            decimals: 6,
        };

        assert_eq!(sol_mint.decimals, 9);
        assert_eq!(usdc_mint.decimals, 6);
    }

    #[test]
    fn test_raydium_pool_high_tvl() {
        let pool = RaydiumPool {
            id: "BigPool".to_string(),
            name: "SOL-USDC".to_string(),
            lp_mint: "LP".to_string(),
            mint_a: MintInfo {
                address: "SOL".to_string(),
                symbol: "SOL".to_string(),
                decimals: 9,
            },
            mint_b: MintInfo {
                address: "USDC".to_string(),
                symbol: "USDC".to_string(),
                decimals: 6,
            },
            lp_price: 100.0,
            tvl: 50000000.0,
            apr: 8.5,
        };

        assert!(pool.tvl > 10000000.0);
        assert_eq!(pool.lp_price, 100.0);
    }

    #[test]
    fn test_raydium_empty_pools_response() {
        let json = r#"{ "data": [] }"#;
        let response: RaydiumPoolsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.data.len(), 0);
    }

    #[test]
    fn test_raydium_position_zero_lp() {
        let position = RaydiumUserPosition {
            pool_id: "Pool1".to_string(),
            lp_amount: "0".to_string(),
            lp_value_usd: 0.0,
            token_a_amount: "0".to_string(),
            token_b_amount: "0".to_string(),
        };

        assert_eq!(position.lp_value_usd, 0.0);
    }
}
