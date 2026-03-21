use super::models::*;
use defi10_core::{
    http_helpers::{check_and_parse, check_response},
    Chain, DeFi10Error, Result,
};
use reqwest::Client;
use std::sync::Arc;

pub struct MoralisClient {
    client: Arc<Client>,
    api_key: String,
    base_url: String,
    solana_base_url: String,
}

impl MoralisClient {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Arc::new(Client::new()),
            api_key,
            base_url: "https://deep-index.moralis.io/api/v2.2".to_string(),
            solana_base_url: "https://solana-gateway.moralis.io".to_string(),
        }
    }

    pub fn with_urls(api_key: String, base_url: String, solana_base_url: String) -> Self {
        Self {
            client: Arc::new(Client::new()),
            api_key,
            base_url,
            solana_base_url,
        }
    }

    pub fn with_client(client: Arc<Client>, api_key: String) -> Self {
        Self {
            client,
            api_key,
            base_url: "https://deep-index.moralis.io/api/v2.2".to_string(),
            solana_base_url: "https://solana-gateway.moralis.io".to_string(),
        }
    }

    pub fn with_client_and_urls(
        client: Arc<Client>,
        api_key: String,
        base_url: String,
        solana_base_url: String,
    ) -> Self {
        Self {
            client,
            api_key,
            base_url,
            solana_base_url,
        }
    }

    pub fn with_base_url(mut self, base_url: String) -> Self {
        self.base_url = base_url;
        self
    }

    pub fn with_solana_base_url(mut self, solana_base_url: String) -> Self {
        self.solana_base_url = solana_base_url;
        self
    }

    pub async fn get_evm_tokens(&self, chain: Chain, address: &str) -> Result<Vec<MoralisToken>> {
        let chain_hex = self.chain_to_moralis_chain(chain)?;
        let url = format!("{}/{}/erc20", self.base_url, address);

        let response = self
            .client
            .get(&url)
            .header("X-API-Key", &self.api_key)
            .query(&[("chain", chain_hex)])
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(format!("Moralis API error: {}", e)))?;

        let response = check_response(response, "Moralis").await?;

        let text = response
            .text()
            .await
            .map_err(|e| DeFi10Error::ParseError(format!("Failed to get response text: {}", e)))?;

        tracing::debug!(
            "Moralis tokens response (first 500 chars): {}",
            &text.chars().take(500).collect::<String>()
        );

        let tokens: Vec<MoralisToken> = serde_json::from_str(&text).map_err(|e| {
            DeFi10Error::ParseError(format!(
                "Failed to parse Moralis response: {} | Body: {}",
                e,
                &text.chars().take(200).collect::<String>()
            ))
        })?;

        Ok(tokens)
    }

    pub async fn get_evm_nfts(&self, chain: Chain, address: &str) -> Result<Vec<MoralisNft>> {
        let chain_hex = self.chain_to_moralis_chain(chain)?;
        let url = format!("{}/{}/nft", self.base_url, address);

        tracing::debug!("Fetching NFTs from Moralis: {} chain={}", url, chain_hex);

        let response = self
            .client
            .get(&url)
            .header("X-API-Key", &self.api_key)
            .query(&[("chain", chain_hex)])
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(format!("Moralis API error: {}", e)))?;

        let nft_response: MoralisNftResponse = check_and_parse(response, "Moralis").await?;

        tracing::debug!("Found {} NFTs from Moralis", nft_response.result.len());
        Ok(nft_response.result)
    }

    pub async fn get_solana_tokens(&self, address: &str) -> Result<Vec<SolanaToken>> {
        let url = format!(
            "{}/account/mainnet/{}/portfolio?nftMetadata=false&mediaItems=false&excludeSpam=true",
            self.solana_base_url, address
        );

        tracing::debug!("Fetching Solana portfolio from {}", url);

        let response = self
            .client
            .get(&url)
            .header("X-API-Key", &self.api_key)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(format!("Moralis API error: {}", e)))?;

        let portfolio: SolanaPortfolioResponse = check_and_parse(response, "Moralis").await?;

        let mut tokens = portfolio.tokens;

        if let Some(native) = portfolio.native_balance {
            if let Some(solana_str) = native.solana {
                if let Ok(sol_amount) = solana_str.parse::<f64>() {
                    if sol_amount > 0.0 {
                        tokens.insert(
                            0,
                            SolanaToken {
                                mint: "So11111111111111111111111111111111111111112".to_string(),
                                amount_raw: native.lamports,
                                amount: solana_str,
                                decimals: 9,
                                name: Some("Solana".to_string()),
                                symbol: Some("SOL".to_string()),
                                logo: Some(
                                    "https://moralis.com/wp-content/uploads/2022/12/Solana.svg"
                                        .to_string(),
                                ),
                                usd_price: None,
                                usd_value: None,
                            },
                        );
                    }
                }
            }
        }

        Ok(tokens)
    }

    pub async fn get_solana_token_price(&self, mint: &str) -> Result<Option<f64>> {
        let url = format!("{}/token/mainnet/{}/price", self.solana_base_url, mint);

        let response = self
            .client
            .get(&url)
            .header("X-API-Key", &self.api_key)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(format!("Moralis API error: {}", e)))?;

        if !response.status().is_success() {
            tracing::debug!("No price available for mint {}", mint);
            return Ok(None);
        }

        let price_response: SolanaTokenPriceResponse = response.json().await.map_err(|e| {
            DeFi10Error::ParseError(format!("Failed to parse price response: {}", e))
        })?;

        Ok(price_response.usd_price)
    }

    pub async fn get_solana_nfts(&self, address: &str) -> Result<Vec<SolanaNft>> {
        let url = format!("{}/solana/mainnet/account/{}/nft", self.base_url, address);

        let response = self
            .client
            .get(&url)
            .header("X-API-Key", &self.api_key)
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(format!("Moralis API error: {}", e)))?;

        let nft_response: SolanaNftResponse = check_and_parse(response, "Moralis").await?;

        Ok(nft_response.result)
    }

    fn chain_to_moralis_chain(&self, chain: Chain) -> Result<String> {
        match chain {
            Chain::Ethereum => Ok("0x1".to_string()),
            Chain::Base => Ok("0x2105".to_string()),
            Chain::Polygon => Ok("0x89".to_string()),
            Chain::Arbitrum => Ok("0xa4b1".to_string()),
            Chain::Optimism => Ok("0xa".to_string()),
            Chain::BNB => Ok("0x38".to_string()),
            _ => Err(DeFi10Error::ChainNotSupported(chain)),
        }
    }

    pub async fn get_evm_token_price(
        &self,
        chain: Chain,
        token_address: &str,
    ) -> Result<Option<f64>> {
        let chain_hex = self.chain_to_moralis_chain(chain)?;
        let url = format!("{}/erc20/{}/price", self.base_url, token_address);

        let response = self
            .client
            .get(&url)
            .header("X-API-Key", &self.api_key)
            .query(&[("chain", &chain_hex)])
            .send()
            .await
            .map_err(|e| DeFi10Error::ExternalApiError(format!("Moralis API error: {}", e)))?;

        if !response.status().is_success() {
            tracing::debug!(
                "No price available for token {} on chain {}",
                token_address,
                chain
            );
            return Ok(None);
        }

        #[derive(serde::Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct EvmPriceResponse {
            usd_price: Option<f64>,
        }

        let price_response: EvmPriceResponse = response.json().await.map_err(|e| {
            DeFi10Error::ParseError(format!("Failed to parse price response: {}", e))
        })?;

        Ok(price_response.usd_price)
    }
}
