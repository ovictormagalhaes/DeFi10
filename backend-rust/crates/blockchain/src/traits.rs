use async_trait::async_trait;
use defi10_core::{Chain, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenBalance {
    pub token_address: String,
    pub balance: String,
    pub decimals: u8,
    pub symbol: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionStatus {
    pub hash: String,
    pub confirmed: bool,
    pub block_number: Option<u64>,
    pub success: bool,
}

#[async_trait]
pub trait BlockchainProvider: Send + Sync {
    /// Get the chain this provider handles
    fn chain(&self) -> Chain;

    /// Check if the provider is healthy
    async fn health_check(&self) -> Result<bool>;

    /// Get native token balance for an address
    async fn get_native_balance(&self, address: &str) -> Result<String>;

    /// Get ERC20/SPL token balance
    async fn get_token_balance(&self, address: &str, token_address: &str) -> Result<TokenBalance>;

    /// Get multiple token balances
    async fn get_token_balances(
        &self,
        address: &str,
        token_addresses: &[String],
    ) -> Result<Vec<TokenBalance>>;

    /// Get transaction status
    async fn get_transaction_status(&self, tx_hash: &str) -> Result<TransactionStatus>;

    /// Estimate gas/fees for a transaction
    async fn estimate_fees(&self) -> Result<u64>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_balance_creation() {
        let balance = TokenBalance {
            token_address: "0x123".to_string(),
            balance: "1000000".to_string(),
            decimals: 6,
            symbol: Some("USDC".to_string()),
        };

        assert_eq!(balance.decimals, 6);
        assert_eq!(balance.symbol, Some("USDC".to_string()));
    }

    #[test]
    fn test_transaction_status() {
        let status = TransactionStatus {
            hash: "0xabc".to_string(),
            confirmed: true,
            block_number: Some(12345),
            success: true,
        };

        assert!(status.confirmed);
        assert!(status.success);
        assert_eq!(status.block_number, Some(12345));
    }

    #[test]
    fn test_serialization() {
        let balance = TokenBalance {
            token_address: "0x123".to_string(),
            balance: "1000000".to_string(),
            decimals: 18,
            symbol: None,
        };

        let json = serde_json::to_string(&balance).unwrap();
        let deserialized: TokenBalance = serde_json::from_str(&json).unwrap();

        assert_eq!(balance.token_address, deserialized.token_address);
        assert_eq!(balance.decimals, deserialized.decimals);
    }
}
