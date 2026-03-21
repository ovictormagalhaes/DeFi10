use crate::Chain;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Token {
    pub address: String,
    pub chain: Chain,
    pub symbol: String,
    pub name: String,
    pub decimals: u8,
    pub logo_url: Option<String>,
}

impl Token {
    pub fn new(address: String, chain: Chain, symbol: String, name: String, decimals: u8) -> Self {
        Self {
            address,
            chain,
            symbol,
            name,
            decimals,
            logo_url: None,
        }
    }

    pub fn with_logo(mut self, logo_url: String) -> Self {
        self.logo_url = Some(logo_url);
        self
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct TokenAmount {
    pub amount: f64,
    pub decimals: u8,
}

impl TokenAmount {
    pub fn new(amount: f64, decimals: u8) -> Self {
        Self { amount, decimals }
    }

    pub fn from_raw(raw: u128, decimals: u8) -> Self {
        let divisor = 10_u128.pow(decimals as u32);
        let amount = raw as f64 / divisor as f64;
        Self { amount, decimals }
    }

    pub fn to_raw(&self) -> u128 {
        let multiplier = 10_u128.pow(self.decimals as u32);
        (self.amount * multiplier as f64) as u128
    }

    pub fn is_zero(&self) -> bool {
        self.amount == 0.0
    }
}

impl fmt::Display for TokenAmount {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{:.precision$}",
            self.amount,
            precision = self.decimals as usize
        )
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TokenPrice {
    pub token_address: String,
    pub chain: Chain,
    pub price_usd: f64,
    pub last_updated: DateTime<Utc>,
    pub source: String,
}

impl TokenPrice {
    pub fn new(token_address: String, chain: Chain, price_usd: f64, source: String) -> Self {
        Self {
            token_address,
            chain,
            price_usd,
            last_updated: Utc::now(),
            source,
        }
    }

    pub fn is_stale(&self, max_age_seconds: i64) -> bool {
        let age = Utc::now().signed_duration_since(self.last_updated);
        age.num_seconds() > max_age_seconds
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_creation() {
        let token = Token::new(
            "0x123".to_string(),
            Chain::Ethereum,
            "USDC".to_string(),
            "USD Coin".to_string(),
            6,
        );

        assert_eq!(token.address, "0x123");
        assert_eq!(token.chain, Chain::Ethereum);
        assert_eq!(token.symbol, "USDC");
        assert_eq!(token.decimals, 6);
        assert_eq!(token.logo_url, None);
    }

    #[test]
    fn test_token_with_logo() {
        let token = Token::new(
            "0x123".to_string(),
            Chain::Ethereum,
            "USDC".to_string(),
            "USD Coin".to_string(),
            6,
        )
        .with_logo("https://example.com/logo.png".to_string());

        assert_eq!(
            token.logo_url,
            Some("https://example.com/logo.png".to_string())
        );
    }

    #[test]
    fn test_token_amount_new() {
        let amount = TokenAmount::new(100.5, 6);
        assert_eq!(amount.amount, 100.5);
        assert_eq!(amount.decimals, 6);
    }

    #[test]
    fn test_token_amount_from_raw() {
        let amount = TokenAmount::from_raw(1_000_000, 6);
        assert_eq!(amount.amount, 1.0);
        assert_eq!(amount.decimals, 6);

        let amount = TokenAmount::from_raw(1_500_000, 6);
        assert_eq!(amount.amount, 1.5);
    }

    #[test]
    fn test_token_amount_to_raw() {
        let amount = TokenAmount::new(1.5, 6);
        assert_eq!(amount.to_raw(), 1_500_000);

        let amount = TokenAmount::new(100.0, 18);
        assert_eq!(amount.to_raw(), 100_000_000_000_000_000_000);
    }

    #[test]
    fn test_token_amount_is_zero() {
        let amount = TokenAmount::new(0.0, 6);
        assert!(amount.is_zero());

        let amount = TokenAmount::new(0.1, 6);
        assert!(!amount.is_zero());
    }

    #[test]
    fn test_token_amount_display() {
        let amount = TokenAmount::new(1.234567, 6);
        assert_eq!(format!("{}", amount), "1.234567");
    }

    #[test]
    fn test_token_price_new() {
        let price = TokenPrice::new(
            "0x123".to_string(),
            Chain::Ethereum,
            1.0,
            "coinmarketcap".to_string(),
        );

        assert_eq!(price.token_address, "0x123");
        assert_eq!(price.chain, Chain::Ethereum);
        assert_eq!(price.price_usd, 1.0);
        assert_eq!(price.source, "coinmarketcap");
    }

    #[test]
    fn test_token_price_is_stale() {
        let mut price = TokenPrice::new(
            "0x123".to_string(),
            Chain::Ethereum,
            1.0,
            "test".to_string(),
        );

        // Fresh price
        assert!(!price.is_stale(300));

        // Make it old
        price.last_updated = Utc::now() - chrono::Duration::seconds(400);
        assert!(price.is_stale(300));
    }

    #[test]
    fn test_token_serde() {
        let token = Token::new(
            "0x123".to_string(),
            Chain::Ethereum,
            "USDC".to_string(),
            "USD Coin".to_string(),
            6,
        );

        let json = serde_json::to_string(&token).unwrap();
        let deserialized: Token = serde_json::from_str(&json).unwrap();
        assert_eq!(token, deserialized);
    }

    #[test]
    fn test_token_amount_serde() {
        let amount = TokenAmount::new(123.456, 6);
        let json = serde_json::to_string(&amount).unwrap();
        let deserialized: TokenAmount = serde_json::from_str(&json).unwrap();
        assert_eq!(amount, deserialized);
    }

    #[test]
    fn test_token_amount_from_raw_with_18_decimals() {
        let amount = TokenAmount::from_raw(1_234_567_890_123_456_789, 18);
        assert!((amount.amount - 1.234567890123456789).abs() < 1e-15);
        assert_eq!(amount.decimals, 18);
    }

    #[test]
    fn test_token_amount_from_raw_zero() {
        let amount = TokenAmount::from_raw(0, 6);
        assert_eq!(amount.amount, 0.0);
        assert!(amount.is_zero());
    }

    #[test]
    fn test_token_amount_to_raw_precision() {
        let amount = TokenAmount::new(0.000001, 6);
        assert_eq!(amount.to_raw(), 1);

        let amount = TokenAmount::new(1.0, 18);
        assert_eq!(amount.to_raw(), 1_000_000_000_000_000_000);
    }

    #[test]
    fn test_token_amount_large_values() {
        let large_raw = 1_000_000_000_000_000_000_000_000_u128;
        let amount = TokenAmount::from_raw(large_raw, 18);
        assert!((amount.amount - 1_000_000.0).abs() < 1e-6);

        let reconstructed_raw = amount.to_raw();
        let diff = if large_raw > reconstructed_raw {
            large_raw - reconstructed_raw
        } else {
            reconstructed_raw - large_raw
        };
        assert!(diff < 1_000_000_000_000_000_000);
    }

    #[test]
    fn test_token_amount_very_small_values() {
        let amount = TokenAmount::new(0.000000001, 18);
        let raw = amount.to_raw();
        assert_eq!(raw, 1_000_000_000);

        let reconstructed = TokenAmount::from_raw(raw, 18);
        assert!((reconstructed.amount - amount.amount).abs() < 1e-15);
    }

    #[test]
    fn test_token_amount_round_trip_conversion() {
        let test_cases = vec![
            (1.5, 6),
            (100.0, 18),
            (0.000001, 6),
            (1234.56789, 8),
            (999999.999999, 6),
        ];

        for (amount, decimals) in test_cases {
            let token_amount = TokenAmount::new(amount, decimals);
            let raw = token_amount.to_raw();
            let reconstructed = TokenAmount::from_raw(raw, decimals);
            assert!((reconstructed.amount - amount).abs() < 1e-10);
        }
    }

    #[test]
    fn test_token_amount_is_zero_with_small_value() {
        let amount = TokenAmount::new(0.0, 18);
        assert!(amount.is_zero());

        let amount = TokenAmount::new(0.000000000000000001, 18);
        assert!(!amount.is_zero());
    }

    #[test]
    fn test_token_price_update_time() {
        let price = TokenPrice::new(
            "0x123".to_string(),
            Chain::Ethereum,
            1500.0,
            "coingecko".to_string(),
        );

        let now = Utc::now();
        let diff = (now - price.last_updated).num_seconds();
        assert!(diff < 1);
    }

    #[test]
    fn test_token_price_staleness_edge_cases() {
        let mut price = TokenPrice::new(
            "0x123".to_string(),
            Chain::Ethereum,
            1.0,
            "test".to_string(),
        );

        assert!(!price.is_stale(300));
        assert!(!price.is_stale(0));

        price.last_updated = Utc::now() - chrono::Duration::seconds(300);
        assert!(!price.is_stale(300));

        price.last_updated = Utc::now() - chrono::Duration::seconds(301);
        assert!(price.is_stale(300));
    }

    #[test]
    fn test_token_with_different_chains() {
        let chains = vec![Chain::Ethereum, Chain::Base, Chain::Arbitrum, Chain::Solana];

        for chain in chains {
            let token = Token::new(
                "0xAddress".to_string(),
                chain,
                "TEST".to_string(),
                "Test Token".to_string(),
                18,
            );
            assert_eq!(token.chain, chain);
        }
    }

    #[test]
    fn test_token_amount_display_various_decimals() {
        let amount = TokenAmount::new(123.456789, 3);
        assert_eq!(format!("{}", amount), "123.457");

        let amount = TokenAmount::new(1.0, 0);
        assert_eq!(format!("{}", amount), "1");

        let amount = TokenAmount::new(0.123456789012345678, 18);
        let displayed = format!("{}", amount);
        assert!(displayed.starts_with("0.123456789012345"));
    }
}
