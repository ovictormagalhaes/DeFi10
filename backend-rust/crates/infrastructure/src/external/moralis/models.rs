use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoralisToken {
    pub token_address: String,
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub logo: Option<String>,
    pub thumbnail: Option<String>,
    pub decimals: Option<u32>,
    pub balance: String,
    #[serde(rename = "possible_spam")]
    pub possible_spam: Option<bool>,
    pub verified_contract: Option<bool>,
    pub balance_formatted: Option<String>,
    pub usd_price: Option<f64>,
    pub usd_value: Option<f64>,
    pub native_token: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoralisNft {
    pub token_address: String,
    pub token_id: String,
    pub amount: Option<String>,
    pub owner_of: Option<String>,
    pub token_hash: Option<String>,
    pub block_number_minted: Option<String>,
    pub block_number: Option<String>,
    pub contract_type: Option<String>,
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub token_uri: Option<String>,
    pub metadata: Option<String>,
    pub last_token_uri_sync: Option<String>,
    pub last_metadata_sync: Option<String>,
    pub minter_address: Option<String>,
    pub possible_spam: Option<bool>,
    pub verified_collection: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoralisTokenResponse {
    #[serde(rename = "value")]
    pub result: Vec<MoralisToken>,
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoralisNftResponse {
    pub result: Vec<MoralisNft>,
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaToken {
    pub mint: String,
    #[serde(rename = "amountRaw")]
    pub amount_raw: Option<String>,
    pub amount: String,
    pub decimals: u32,
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub logo: Option<String>,
    #[serde(rename = "usdPrice")]
    pub usd_price: Option<f64>,
    #[serde(rename = "usdValue")]
    pub usd_value: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaTokenPriceResponse {
    #[serde(rename = "usdPrice")]
    pub usd_price: Option<f64>,
    #[serde(rename = "exchangeName")]
    pub exchange_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaNativeBalance {
    pub lamports: Option<String>,
    pub solana: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaPortfolioResponse {
    #[serde(rename = "nativeBalance")]
    pub native_balance: Option<SolanaNativeBalance>,
    pub tokens: Vec<SolanaToken>,
    pub nfts: Option<Vec<SolanaNft>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaTokenResponse {
    #[serde(rename = "tokens")]
    pub result: Vec<SolanaToken>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaNft {
    pub mint: String,
    pub name: Option<String>,
    pub symbol: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolanaNftResponse {
    #[serde(rename = "nfts")]
    pub result: Vec<SolanaNft>,
}
