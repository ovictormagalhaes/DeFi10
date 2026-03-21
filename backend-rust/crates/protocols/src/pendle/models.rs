use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendleMarket {
    pub address: String,
    pub name: String,
    pub underlying_asset: String,
    pub pt_token: String,
    pub yt_token: String,
    pub expiry: u64,
    pub implied_apy: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendlePosition {
    pub market: String,
    pub pt_balance: String,
    pub yt_balance: String,
    pub value_usd: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pendle_market_creation() {
        let market = PendleMarket {
            address: "0xMarket123".to_string(),
            name: "PT-wstETH".to_string(),
            underlying_asset: "0xWSTETH".to_string(),
            pt_token: "0xPT".to_string(),
            yt_token: "0xYT".to_string(),
            expiry: 1735689600,
            implied_apy: 8.5,
        };

        assert_eq!(market.name, "PT-wstETH");
        assert_eq!(market.implied_apy, 8.5);
    }

    #[test]
    fn test_pendle_market_parsing() {
        let json = r#"{
            "address": "0xMarket456",
            "name": "PT-GLP",
            "underlying_asset": "0xGLP",
            "pt_token": "0xPT_GLP",
            "yt_token": "0xYT_GLP",
            "expiry": 1767225600,
            "implied_apy": 12.3
        }"#;

        let market: PendleMarket = serde_json::from_str(json).unwrap();
        assert_eq!(market.name, "PT-GLP");
        assert_eq!(market.expiry, 1767225600);
    }

    #[test]
    fn test_pendle_position_creation() {
        let position = PendlePosition {
            market: "0xMarket".to_string(),
            pt_balance: "1000000000000000000".to_string(),
            yt_balance: "500000000000000000".to_string(),
            value_usd: 3000.0,
        };

        assert_eq!(position.value_usd, 3000.0);
    }

    #[test]
    fn test_pendle_position_parsing() {
        let json = r#"{
            "market": "0xMarket789",
            "pt_balance": "2000000000000000000",
            "yt_balance": "1000000000000000000",
            "value_usd": 5000.0
        }"#;

        let position: PendlePosition = serde_json::from_str(json).unwrap();
        assert_eq!(position.pt_balance, "2000000000000000000");
        assert_eq!(position.value_usd, 5000.0);
    }

    #[test]
    fn test_pendle_market_serialization() {
        let market = PendleMarket {
            address: "0xABC".to_string(),
            name: "PT-sDAI".to_string(),
            underlying_asset: "0xSDAI".to_string(),
            pt_token: "0xPT_SDAI".to_string(),
            yt_token: "0xYT_SDAI".to_string(),
            expiry: 1704067200,
            implied_apy: 6.8,
        };

        let json = serde_json::to_string(&market).unwrap();
        let deserialized: PendleMarket = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.name, "PT-sDAI");
        assert_eq!(deserialized.implied_apy, 6.8);
    }

    #[test]
    fn test_pendle_position_zero_balance() {
        let position = PendlePosition {
            market: "0xMarket".to_string(),
            pt_balance: "0".to_string(),
            yt_balance: "0".to_string(),
            value_usd: 0.0,
        };

        assert_eq!(position.value_usd, 0.0);
    }

    #[test]
    fn test_pendle_market_high_apy() {
        let market = PendleMarket {
            address: "0xDEF".to_string(),
            name: "PT-rETH".to_string(),
            underlying_asset: "0xRETH".to_string(),
            pt_token: "0xPT_RETH".to_string(),
            yt_token: "0xYT_RETH".to_string(),
            expiry: 1798761600,
            implied_apy: 25.0,
        };

        assert!(market.implied_apy > 20.0);
    }

    #[test]
    fn test_pendle_position_only_pt() {
        let position = PendlePosition {
            market: "0xMarket".to_string(),
            pt_balance: "5000000000000000000".to_string(),
            yt_balance: "0".to_string(),
            value_usd: 10000.0,
        };

        assert_eq!(position.yt_balance, "0");
        assert!(position.pt_balance != "0");
    }

    #[test]
    fn test_pendle_position_only_yt() {
        let position = PendlePosition {
            market: "0xMarket".to_string(),
            pt_balance: "0".to_string(),
            yt_balance: "3000000000000000000".to_string(),
            value_usd: 500.0,
        };

        assert_eq!(position.pt_balance, "0");
        assert!(position.yt_balance != "0");
    }
}
