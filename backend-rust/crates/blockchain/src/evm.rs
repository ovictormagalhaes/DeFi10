use crate::traits::{BlockchainProvider, TokenBalance, TransactionStatus};
use async_trait::async_trait;
use defi10_core::{Chain, DeFi10Error, Result};
use ethers::prelude::*;
use std::sync::Arc;

#[derive(Clone)]
pub struct EvmProvider {
    chain: Chain,
    provider: Arc<Provider<Http>>,
}

impl EvmProvider {
    pub async fn new(chain: Chain, rpc_url: &str) -> Result<Self> {
        if !chain.is_evm() {
            return Err(DeFi10Error::Blockchain(format!(
                "Chain {:?} is not an EVM chain",
                chain
            )));
        }

        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| DeFi10Error::Blockchain(format!("Failed to create provider: {}", e)))?;

        Ok(Self {
            chain,
            provider: Arc::new(provider),
        })
    }

    pub fn provider(&self) -> &Provider<Http> {
        &self.provider
    }
}

#[async_trait]
impl BlockchainProvider for EvmProvider {
    fn chain(&self) -> Chain {
        self.chain
    }

    async fn health_check(&self) -> Result<bool> {
        match self.provider.get_block_number().await {
            Ok(_) => Ok(true),
            Err(e) => {
                tracing::warn!("EVM health check failed: {}", e);
                Ok(false)
            }
        }
    }

    async fn get_native_balance(&self, address: &str) -> Result<String> {
        let address: Address = address
            .parse()
            .map_err(|e| DeFi10Error::Validation(format!("Invalid address: {}", e)))?;

        let balance = self
            .provider
            .get_balance(address, None)
            .await
            .map_err(|e| DeFi10Error::Blockchain(format!("Failed to get balance: {}", e)))?;

        Ok(balance.to_string())
    }

    async fn get_token_balance(&self, address: &str, token_address: &str) -> Result<TokenBalance> {
        let wallet_address: Address = address
            .parse()
            .map_err(|e| DeFi10Error::Validation(format!("Invalid address: {}", e)))?;

        let token_address: Address = token_address
            .parse()
            .map_err(|e| DeFi10Error::Validation(format!("Invalid token address: {}", e)))?;

        // ERC20 ABI balanceOf function
        abigen!(
            ERC20,
            r#"[
                function balanceOf(address account) external view returns (uint256)
                function decimals() external view returns (uint8)
                function symbol() external view returns (string)
            ]"#
        );

        let contract = ERC20::new(token_address, self.provider.clone());

        let balance: U256 = contract
            .balance_of(wallet_address)
            .call()
            .await
            .map_err(|e| DeFi10Error::Blockchain(format!("Failed to get token balance: {}", e)))?;

        let decimals: u8 = contract.decimals().call().await.unwrap_or(18);

        let symbol: Option<String> = contract.symbol().call().await.ok();

        Ok(TokenBalance {
            token_address: format!("{:?}", token_address),
            balance: balance.to_string(),
            decimals,
            symbol,
        })
    }

    async fn get_token_balances(
        &self,
        address: &str,
        token_addresses: &[String],
    ) -> Result<Vec<TokenBalance>> {
        let mut balances = Vec::new();

        for token_address in token_addresses {
            match self.get_token_balance(address, token_address).await {
                Ok(balance) => balances.push(balance),
                Err(e) => {
                    tracing::warn!("Failed to get balance for {}: {}", token_address, e);
                    continue;
                }
            }
        }

        Ok(balances)
    }

    async fn get_transaction_status(&self, tx_hash: &str) -> Result<TransactionStatus> {
        let tx_hash: H256 = tx_hash
            .parse()
            .map_err(|e| DeFi10Error::Validation(format!("Invalid tx hash: {}", e)))?;

        let receipt = self
            .provider
            .get_transaction_receipt(tx_hash)
            .await
            .map_err(|e| DeFi10Error::Blockchain(format!("Failed to get transaction: {}", e)))?;

        match receipt {
            Some(receipt) => Ok(TransactionStatus {
                hash: format!("{:?}", tx_hash),
                confirmed: receipt.block_number.is_some(),
                block_number: receipt.block_number.map(|n| n.as_u64()),
                success: receipt.status.map(|s| s.as_u64() == 1).unwrap_or(false),
            }),
            None => Ok(TransactionStatus {
                hash: format!("{:?}", tx_hash),
                confirmed: false,
                block_number: None,
                success: false,
            }),
        }
    }

    async fn estimate_fees(&self) -> Result<u64> {
        let gas_price = self
            .provider
            .get_gas_price()
            .await
            .map_err(|e| DeFi10Error::Blockchain(format!("Failed to get gas price: {}", e)))?;

        Ok(gas_price.as_u64())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_evm_provider_creation_validation() {
        // Should fail for non-EVM chains
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let result = EvmProvider::new(Chain::Solana, "http://localhost:8545").await;
            assert!(result.is_err());
        });
    }

    #[test]
    fn test_chain_getter() {
        tokio::runtime::Runtime::new().unwrap().block_on(async {
            let provider = EvmProvider::new(Chain::Ethereum, "http://localhost:8545")
                .await
                .unwrap();
            assert_eq!(provider.chain(), Chain::Ethereum);
        });
    }
}
