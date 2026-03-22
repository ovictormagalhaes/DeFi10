use crate::traits::{BlockchainProvider, TokenBalance, TransactionStatus};
use async_trait::async_trait;
use defi10_core::{Chain, DeFi10Error, Result};
use serde::{Deserialize, Serialize};
use solana_client::rpc_client::RpcClient;
use solana_client::rpc_request::TokenAccountsFilter;
use solana_sdk::{commitment_config::CommitmentConfig, pubkey::Pubkey, signature::Signature};
use std::str::FromStr;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplTokenAccount {
    pub pubkey: String,
    pub mint: String,
    pub owner: String,
    pub amount: u64,
    pub decimals: u8,
}

const FALLBACK_RPCS: &[&str] = &[
    "https://api.mainnet-beta.solana.com",
    "https://solana-api.projectserum.com",
];

#[derive(Clone)]
pub struct SolanaProvider {
    client: Arc<RpcClient>,
    fallback_clients: Vec<Arc<RpcClient>>,
}

impl SolanaProvider {
    pub fn new(rpc_url: &str) -> Result<Self> {
        let client =
            RpcClient::new_with_commitment(rpc_url.to_string(), CommitmentConfig::confirmed());
        let fallback_clients = FALLBACK_RPCS
            .iter()
            .filter(|url| **url != rpc_url)
            .map(|url| {
                Arc::new(RpcClient::new_with_commitment(
                    url.to_string(),
                    CommitmentConfig::confirmed(),
                ))
            })
            .collect();
        Ok(Self {
            client: Arc::new(client),
            fallback_clients,
        })
    }

    #[allow(clippy::result_large_err)]
    fn retry_rpc<T, F>(&self, operation: F, operation_name: &str, max_attempts: u32) -> Result<T>
    where
        F: Fn(&RpcClient) -> std::result::Result<T, solana_client::client_error::ClientError>,
    {
        for attempt in 1..=max_attempts {
            tracing::debug!(
                "[Solana] Attempting {} (attempt {}/{})",
                operation_name,
                attempt,
                max_attempts
            );

            match operation(&self.client) {
                Ok(result) => {
                    tracing::debug!(
                        "[Solana] {} succeeded on attempt {}",
                        operation_name,
                        attempt
                    );
                    return Ok(result);
                }
                Err(e) => {
                    let err_str = e.to_string();
                    let is_rate_limited =
                        err_str.contains("429") || err_str.contains("Too Many Requests");

                    if is_rate_limited {
                        tracing::warn!(
                            "[Solana] {} rate limited, trying fallback RPCs...",
                            operation_name
                        );
                        for (i, fb) in self.fallback_clients.iter().enumerate() {
                            thread::sleep(Duration::from_millis(500));
                            match operation(fb) {
                                Ok(result) => {
                                    tracing::info!(
                                        "[Solana] {} succeeded on fallback RPC #{}",
                                        operation_name,
                                        i + 1
                                    );
                                    return Ok(result);
                                }
                                Err(fb_e) => {
                                    tracing::warn!(
                                        "[Solana] Fallback RPC #{} failed: {}",
                                        i + 1,
                                        fb_e
                                    );
                                }
                            }
                        }
                    }

                    if attempt == max_attempts {
                        tracing::error!(
                            "[Solana] {} failed after {} attempts: {}",
                            operation_name,
                            max_attempts,
                            e
                        );
                        return Err(DeFi10Error::Blockchain(format!(
                            "Failed to {}: {}",
                            operation_name, e
                        )));
                    }

                    let delay_ms = 2000 * attempt as u64;
                    tracing::warn!(
                        "[Solana] {} attempt {}/{} failed: {}. Retrying in {}ms...",
                        operation_name,
                        attempt,
                        max_attempts,
                        e,
                        delay_ms
                    );

                    thread::sleep(Duration::from_millis(delay_ms));
                }
            }
        }

        unreachable!()
    }

    pub fn get_token_accounts_by_owner(
        &self,
        wallet_address: &str,
    ) -> Result<Vec<SplTokenAccount>> {
        let mut all_accounts = Vec::new();

        let spl_token = self.query_token_program_accounts(
            wallet_address,
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            "SPL Token",
        )?;
        all_accounts.extend(spl_token);

        thread::sleep(Duration::from_millis(500));

        let token_2022 = self.query_token_program_accounts(
            wallet_address,
            "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
            "Token-2022",
        )?;
        all_accounts.extend(token_2022);

        tracing::debug!(
            "[Solana] Found {} total token accounts for {}",
            all_accounts.len(),
            wallet_address
        );

        Ok(all_accounts)
    }

    fn query_token_program_accounts(
        &self,
        wallet_address: &str,
        program_id: &str,
        program_name: &str,
    ) -> Result<Vec<SplTokenAccount>> {
        let owner = Pubkey::from_str(wallet_address)
            .map_err(|e| DeFi10Error::Validation(format!("Invalid address: {}", e)))?;

        let token_program = Pubkey::from_str(program_id).map_err(|e| {
            DeFi10Error::Blockchain(format!("Invalid {} program: {}", program_name, e))
        })?;

        let accounts = match self.retry_rpc(
            |client| {
                client.get_token_accounts_by_owner(
                    &owner,
                    TokenAccountsFilter::ProgramId(token_program),
                )
            },
            &format!("get {} accounts", program_name),
            3,
        ) {
            Ok(accounts) => accounts,
            Err(e) => {
                tracing::warn!("[Solana] {} query failed: {}", program_name, e);
                return Ok(vec![]);
            }
        };

        tracing::debug!(
            "[Solana] Found {} {} accounts for {}",
            accounts.len(),
            program_name,
            wallet_address
        );

        let mut token_accounts = Vec::new();
        for keyed_account in accounts {
            let data_value = serde_json::to_value(&keyed_account.account.data).unwrap_or_default();

            let parsed = data_value.get("parsed").or_else(|| {
                data_value
                    .as_object()
                    .and_then(|obj| obj.values().next())
                    .and_then(|v| v.get("parsed"))
            });

            if let Some(parsed) = parsed {
                if let Some(info) = parsed.get("info") {
                    let mint = info
                        .get("mint")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();

                    let amount: u64 = info
                        .get("tokenAmount")
                        .and_then(|ta| ta.get("amount"))
                        .and_then(|a| a.as_str())
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0);

                    let decimals: u8 = info
                        .get("tokenAmount")
                        .and_then(|ta| ta.get("decimals"))
                        .and_then(|d| d.as_u64())
                        .map(|d| d as u8)
                        .unwrap_or(0);

                    if !mint.is_empty() {
                        token_accounts.push(SplTokenAccount {
                            pubkey: keyed_account.pubkey,
                            mint,
                            owner: wallet_address.to_string(),
                            amount,
                            decimals,
                        });
                    }
                }
            }
        }

        Ok(token_accounts)
    }

    #[allow(dead_code)]
    fn get_mint_info(&self, mint_address: &str) -> Option<(u64, u8)> {
        let mint_pubkey = Pubkey::from_str(mint_address).ok()?;
        let account = self.client.get_account(&mint_pubkey).ok()?;

        if account.data.len() >= 45 {
            let supply = u64::from_le_bytes(account.data[36..44].try_into().ok()?);
            let decimals = account.data[44];
            Some((supply, decimals))
        } else {
            None
        }
    }

    pub fn get_nft_positions(&self, wallet_address: &str) -> Result<Vec<String>> {
        tracing::info!("[Solana] Fetching NFT positions for {}", wallet_address);

        let token_accounts = self.get_token_accounts_by_owner(wallet_address)?;
        tracing::info!(
            "[Solana] Found {} token accounts for {}",
            token_accounts.len(),
            wallet_address
        );

        let potential_nfts: Vec<_> = token_accounts.iter().filter(|ta| ta.amount == 1).collect();

        tracing::debug!(
            "[Solana] Found {} potential NFTs (amount=1) for {}",
            potential_nfts.len(),
            wallet_address
        );

        let nft_mints: Vec<String> = token_accounts
            .into_iter()
            .filter(|ta| ta.amount == 1 && ta.decimals == 0)
            .map(|ta| ta.mint)
            .collect();

        tracing::info!(
            "[Solana] Found {} NFT mints (amount=1, decimals=0) for {}",
            nft_mints.len(),
            wallet_address
        );

        Ok(nft_mints)
    }

    pub fn get_account_data(&self, address: &str) -> Result<Vec<u8>> {
        let pubkey = Pubkey::from_str(address)
            .map_err(|e| DeFi10Error::Validation(format!("Invalid address: {}", e)))?;

        let account =
            self.retry_rpc(|client| client.get_account(&pubkey), "get account data", 3)?;

        Ok(account.data)
    }
}

#[async_trait]
impl BlockchainProvider for SolanaProvider {
    fn chain(&self) -> Chain {
        Chain::Solana
    }

    async fn get_native_balance(&self, address: &str) -> Result<String> {
        let pubkey = Pubkey::from_str(address)
            .map_err(|e| DeFi10Error::Blockchain(format!("Invalid Solana address: {}", e)))?;

        let balance = self
            .client
            .get_balance(&pubkey)
            .map_err(|e| DeFi10Error::Blockchain(format!("Failed to get balance: {}", e)))?;

        // Convert lamports to SOL (1 SOL = 1_000_000_000 lamports)
        let sol_balance = balance as f64 / 1_000_000_000.0;
        Ok(sol_balance.to_string())
    }

    async fn get_token_balance(
        &self,
        _wallet_address: &str,
        _token_address: &str,
    ) -> Result<TokenBalance> {
        // Simplified implementation - TODO: Fix with correct API
        Ok(TokenBalance {
            token_address: _token_address.to_string(),
            balance: "0".to_string(),
            decimals: 9,
            symbol: None,
        })
    }

    async fn get_transaction_status(&self, tx_hash: &str) -> Result<TransactionStatus> {
        let signature = Signature::from_str(tx_hash)
            .map_err(|e| DeFi10Error::Blockchain(format!("Invalid signature: {}", e)))?;

        let status = self.client.get_signature_status(&signature).map_err(|e| {
            DeFi10Error::Blockchain(format!("Failed to get transaction status: {}", e))
        })?;

        match status {
            Some(result) => {
                let success = result.is_ok();
                Ok(TransactionStatus {
                    hash: tx_hash.to_string(),
                    confirmed: true,
                    block_number: None,
                    success,
                })
            }
            None => Ok(TransactionStatus {
                hash: tx_hash.to_string(),
                confirmed: false,
                block_number: None,
                success: false,
            }),
        }
    }

    async fn health_check(&self) -> Result<bool> {
        Ok(self.client.get_health().is_ok())
    }

    async fn get_token_balances(
        &self,
        _wallet_address: &str,
        _token_addresses: &[String],
    ) -> Result<Vec<TokenBalance>> {
        Ok(Vec::new())
    }

    async fn estimate_fees(&self) -> Result<u64> {
        Ok(5000)
    }
}
