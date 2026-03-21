use crate::{Chain, DeFi10Error, Result};
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Address {
    pub value: String,
    pub chain: Chain,
}

impl Address {
    pub fn new(value: String, chain: Chain) -> Result<Self> {
        Self::validate(&value, chain)?;
        Ok(Self { value, chain })
    }

    pub fn validate(value: &str, chain: Chain) -> Result<()> {
        if chain.is_evm() {
            Self::validate_evm(value)
        } else {
            Self::validate_solana(value)
        }
    }

    fn validate_evm(value: &str) -> Result<()> {
        if !value.starts_with("0x") {
            return Err(DeFi10Error::Validation(
                "EVM address must start with 0x".into(),
            ));
        }
        if value.len() != 42 {
            return Err(DeFi10Error::Validation(
                "EVM address must be 42 characters".into(),
            ));
        }
        if !value[2..].chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(DeFi10Error::Validation(
                "EVM address must contain only hex characters".into(),
            ));
        }
        Ok(())
    }

    fn validate_solana(value: &str) -> Result<()> {
        if value.len() < 32 || value.len() > 44 {
            return Err(DeFi10Error::Validation(
                "Solana address must be 32-44 characters".into(),
            ));
        }
        if !value.chars().all(|c| c.is_alphanumeric()) {
            return Err(DeFi10Error::Validation(
                "Solana address must be base58 encoded".into(),
            ));
        }
        Ok(())
    }
}

impl fmt::Display for Address {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.value)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WalletBalance {
    pub address: Address,
    pub token_address: String,
    pub balance: f64,
    pub balance_usd: Option<f64>,
}

impl WalletBalance {
    pub fn new(address: Address, token_address: String, balance: f64) -> Self {
        Self {
            address,
            token_address,
            balance,
            balance_usd: None,
        }
    }

    pub fn with_usd_value(mut self, balance_usd: f64) -> Self {
        self.balance_usd = Some(balance_usd);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_evm_address() {
        let addr = Address::new(
            "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0".to_string(),
            Chain::Ethereum,
        );
        assert!(addr.is_ok());
    }

    #[test]
    fn test_invalid_evm_address_no_prefix() {
        let addr = Address::new(
            "742d35Cc6634C0532925a3b844Bc9e7595f0bEb".to_string(),
            Chain::Ethereum,
        );
        assert!(addr.is_err());
    }

    #[test]
    fn test_invalid_evm_address_wrong_length() {
        let addr = Address::new("0x123".to_string(), Chain::Ethereum);
        assert!(addr.is_err());
    }

    #[test]
    fn test_invalid_evm_address_non_hex() {
        let addr = Address::new(
            "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEZ".to_string(),
            Chain::Ethereum,
        );
        assert!(addr.is_err());
    }

    #[test]
    fn test_valid_solana_address() {
        let addr = Address::new(
            "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK".to_string(),
            Chain::Solana,
        );
        assert!(addr.is_ok());
    }

    #[test]
    fn test_invalid_solana_address_too_short() {
        let addr = Address::new("short".to_string(), Chain::Solana);
        assert!(addr.is_err());
    }

    #[test]
    fn test_address_display() {
        let addr = Address::new(
            "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0".to_string(),
            Chain::Ethereum,
        )
        .unwrap();
        assert_eq!(
            format!("{}", addr),
            "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
        );
    }

    #[test]
    fn test_wallet_balance_new() {
        let addr = Address::new(
            "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0".to_string(),
            Chain::Ethereum,
        )
        .unwrap();
        let balance = WalletBalance::new(addr.clone(), "0xusdc".to_string(), 100.5);

        assert_eq!(balance.address, addr);
        assert_eq!(balance.token_address, "0xusdc");
        assert_eq!(balance.balance, 100.5);
        assert_eq!(balance.balance_usd, None);
    }

    #[test]
    fn test_wallet_balance_with_usd() {
        let addr = Address::new(
            "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0".to_string(),
            Chain::Ethereum,
        )
        .unwrap();
        let balance = WalletBalance::new(addr, "0xusdc".to_string(), 100.0).with_usd_value(100.0);

        assert_eq!(balance.balance_usd, Some(100.0));
    }

    #[test]
    fn test_address_serde() {
        let addr = Address::new(
            "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0".to_string(),
            Chain::Ethereum,
        )
        .unwrap();

        let json = serde_json::to_string(&addr).unwrap();
        let deserialized: Address = serde_json::from_str(&json).unwrap();
        assert_eq!(addr, deserialized);
    }

    #[test]
    fn test_wallet_balance_serde() {
        let addr = Address::new(
            "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0".to_string(),
            Chain::Ethereum,
        )
        .unwrap();
        let balance = WalletBalance::new(addr, "0xusdc".to_string(), 100.5).with_usd_value(101.0);

        let json = serde_json::to_string(&balance).unwrap();
        let deserialized: WalletBalance = serde_json::from_str(&json).unwrap();
        assert_eq!(balance, deserialized);
    }
}
