use serde::{Deserialize, Deserializer, Serialize};

fn deserialize_string_or_number<'de, D>(deserializer: D) -> std::result::Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    let value: serde_json::Value = Deserialize::deserialize(deserializer)?;
    match value {
        serde_json::Value::String(s) => Ok(s),
        serde_json::Value::Number(n) => Ok(n.to_string()),
        _ => Err(serde::de::Error::custom("expected string or number")),
    }
}

fn deserialize_u8_or_string<'de, D>(deserializer: D) -> std::result::Result<u8, D::Error>
where
    D: Deserializer<'de>,
{
    let value: serde_json::Value = Deserialize::deserialize(deserializer)?;
    match value {
        serde_json::Value::Number(n) => n
            .as_u64()
            .map(|v| v as u8)
            .ok_or_else(|| serde::de::Error::custom("invalid u8")),
        serde_json::Value::String(s) => s.parse::<u8>().map_err(serde::de::Error::custom),
        _ => Err(serde::de::Error::custom("expected u8 or string")),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AaveUserSuppliesResponse {
    pub data: Option<UserSuppliesData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSuppliesData {
    pub user_supplies: Vec<UserSupply>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSupply {
    pub market: AaveMarket,
    pub currency: AaveCurrency,
    pub balance: AaveBalance,
    pub apy: AaveApy,
    pub is_collateral: bool,
    pub can_be_collateral: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AaveUserBorrowsResponse {
    pub data: Option<UserBorrowsData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserBorrowsData {
    pub user_borrows: Vec<UserBorrow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserBorrow {
    pub market: AaveMarket,
    pub currency: AaveCurrency,
    pub debt: AaveBalance,
    pub apy: AaveApy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AaveMarket {
    pub name: String,
    pub chain: AaveChain,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AaveChain {
    pub chain_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AaveCurrency {
    pub symbol: String,
    pub name: String,
    pub address: String,
    #[serde(default)]
    pub decimals: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AaveBalance {
    pub amount: AaveAmount,
    #[serde(deserialize_with = "deserialize_usd")]
    pub usd: f64,
}

fn deserialize_usd<'de, D>(deserializer: D) -> std::result::Result<f64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s: String = Deserialize::deserialize(deserializer)?;
    s.parse::<f64>().map_err(serde::de::Error::custom)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AaveAmount {
    pub value: String,
    #[serde(default)]
    pub decimals: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AaveApy {
    pub raw: Option<String>,
    pub decimals: Option<i32>,
    pub value: Option<String>,
    pub formatted: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AaveTransactionHistoryResponse {
    pub data: Option<AaveTransactionHistoryData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AaveTransactionHistoryData {
    #[serde(default)]
    pub supplies: Vec<AaveTransactionEvent>,
    #[serde(default, rename = "redeemUnderlyings")]
    pub redeem_underlyings: Vec<AaveTransactionEvent>,
    #[serde(default)]
    pub borrows: Vec<AaveTransactionEvent>,
    #[serde(default)]
    pub repays: Vec<AaveTransactionEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AaveTransactionEvent {
    pub id: String,
    #[serde(deserialize_with = "deserialize_string_or_number")]
    pub timestamp: String,
    pub amount: String,
    pub reserve: AaveReserve,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AaveReserve {
    pub symbol: String,
    pub name: String,
    pub underlying_asset: String,
    #[serde(deserialize_with = "deserialize_u8_or_string")]
    pub decimals: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionHistoryItem {
    #[serde(rename = "tokenAddress")]
    pub token_address: String,
    #[serde(rename = "mintAddress")]
    pub mint_address: Option<String>,
    pub symbol: String,
    pub balance: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionTokenInfo {
    #[serde(rename = "tokenAddress")]
    pub token_address: String,
    #[serde(rename = "mintAddress")]
    pub mint_address: Option<String>,
    pub symbol: String,
    pub name: String,
    #[serde(rename = "logoUrl")]
    pub logo_url: Option<String>,
    pub decimals: u8,
}

/// Simplified position for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AavePosition {
    pub token_symbol: String,
    pub token_address: String,
    pub supplied_balance: String,
    pub supplied_usd: f64,
    pub borrowed_balance: String,
    pub borrowed_usd: f64,
    pub supply_apy: f64,
    pub borrow_apy: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_supply_deserialization() {
        let json = r#"{
            "market": { "name": "Aave V3 Base", "chain": { "chainId": 8453 } },
            "currency": { "symbol": "USDC", "name": "USD Coin", "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
            "balance": { "amount": { "value": "1000" }, "usd": "1001.5" },
            "apy": { "raw": "0.05", "decimals": 2, "value": "5", "formatted": "5.00%" },
            "isCollateral": true,
            "canBeCollateral": true
        }"#;

        let supply: UserSupply = serde_json::from_str(json).unwrap();
        assert_eq!(supply.currency.symbol, "USDC");
        assert_eq!(supply.balance.usd, 1001.5);
        assert!(supply.is_collateral);
    }

    #[test]
    fn test_user_borrow_deserialization() {
        let json = r#"{
            "market": { "name": "Aave V3 Base", "chain": { "chainId": 8453 } },
            "currency": { "symbol": "WETH", "name": "Wrapped Ether", "address": "0x4200000000000000000000000000000000000006" },
            "debt": { "amount": { "value": "0.5" }, "usd": "1250.50" },
            "apy": { "raw": "0.03", "decimals": 2, "value": "3", "formatted": "3.00%" }
        }"#;

        let borrow: UserBorrow = serde_json::from_str(json).unwrap();
        assert_eq!(borrow.currency.symbol, "WETH");
        assert_eq!(borrow.debt.usd, 1250.50);
    }

    #[test]
    fn test_full_supplies_response() {
        let json = r#"{
            "data": {
                "userSupplies": [
                    {
                        "market": { "name": "Aave V3 Base", "chain": { "chainId": 8453 } },
                        "currency": { "symbol": "USDC", "name": "USD Coin", "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
                        "balance": { "amount": { "value": "1000" }, "usd": "1001.5" },
                        "apy": { "raw": "0.05", "decimals": 2, "value": "5", "formatted": "5.00%" },
                        "isCollateral": true,
                        "canBeCollateral": true
                    }
                ]
            }
        }"#;

        let response: AaveUserSuppliesResponse = serde_json::from_str(json).unwrap();
        assert!(response.data.is_some());
        let supplies = response.data.unwrap().user_supplies;
        assert_eq!(supplies.len(), 1);
        assert_eq!(supplies[0].balance.usd, 1001.5);
    }

    #[test]
    fn test_empty_supplies_response() {
        let json = r#"{ "data": { "userSupplies": [] } }"#;
        let response: AaveUserSuppliesResponse = serde_json::from_str(json).unwrap();
        assert!(response.data.is_some());
        assert!(response.data.unwrap().user_supplies.is_empty());
    }

    #[test]
    fn test_null_data_response() {
        let json = r#"{ "data": null }"#;
        let response: AaveUserSuppliesResponse = serde_json::from_str(json).unwrap();
        assert!(response.data.is_none());
    }
}
