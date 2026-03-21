use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KaminoObligationResponse {
    pub obligation_address: String,
    pub state: KaminoObligationState,
    pub refreshed_stats: Option<KaminoRefreshedStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KaminoObligationState {
    pub owner: String,
    pub lending_market: String,
    pub deposits: Vec<KaminoObligationDeposit>,
    pub borrows: Vec<KaminoObligationBorrow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KaminoObligationDeposit {
    pub deposit_reserve: String,
    pub deposited_amount: String,
    pub market_value_sf: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KaminoObligationBorrow {
    pub borrow_reserve: String,
    pub borrowed_amount_sf: String,
    #[serde(default)]
    pub borrowed_amount_outside_elevation_groups: Option<String>,
    #[serde(default)]
    pub market_value_sf: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KaminoRefreshedStats {
    pub user_total_deposit: Option<String>,
    pub user_total_borrow: Option<String>,
    pub net_account_value: Option<String>,
    pub loan_to_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KaminoReserveMetric {
    pub reserve: String,
    pub liquidity_token: String,
    pub liquidity_token_mint: String,
    #[serde(default)]
    pub max_ltv: Option<String>,
    pub borrow_apy: Option<String>,
    pub supply_apy: Option<String>,
    pub total_supply: Option<String>,
    pub total_supply_usd: Option<String>,
    pub total_borrow: Option<String>,
    pub total_borrow_usd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KaminoObligationHistoryResponse {
    pub obligation: String,
    pub history: Vec<KaminoHistorySnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KaminoHistorySnapshot {
    pub timestamp: String,
    #[serde(default)]
    pub deposits: Vec<KaminoHistoryDeposit>,
    #[serde(default)]
    pub borrows: Vec<KaminoHistoryBorrow>,
    pub deposited_value: Option<String>,
    pub borrowed_value: Option<String>,
    pub net_account_value: Option<String>,
    pub loan_to_value: Option<String>,
    pub health_factor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KaminoHistoryDeposit {
    pub mint_address: String,
    pub amount: String,
    pub market_value_refreshed: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KaminoHistoryBorrow {
    pub mint_address: String,
    pub amount: String,
    pub market_value_refreshed: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KaminoTransactionEvent {
    pub event_type: String,
    pub mint_address: String,
    pub token_symbol: String,
    pub amount: f64,
    pub amount_change: f64,
    pub timestamp: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reserve_metric_parsing() {
        let json = r#"{
            "reserve": "HYnVhjsvU1vBKTPsXs1dWe6cJeuU8E4gjoYpmwe81KzN",
            "liquidityToken": "WBTC",
            "liquidityTokenMint": "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
            "maxLtv": "0.7",
            "borrowApy": "0.0075",
            "supplyApy": "0.0008",
            "totalSupply": "4.62",
            "totalSupplyUsd": "343369.25",
            "totalBorrow": "0.62",
            "totalBorrowUsd": "46642.13"
        }"#;

        let r: KaminoReserveMetric = serde_json::from_str(json).unwrap();
        assert_eq!(r.liquidity_token, "WBTC");
        assert_eq!(r.reserve, "HYnVhjsvU1vBKTPsXs1dWe6cJeuU8E4gjoYpmwe81KzN");
    }

    #[test]
    fn test_obligation_deposit_parsing() {
        let json = r#"{
            "depositReserve": "d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q",
            "depositedAmount": "92861660136",
            "marketValueSf": "11338379340899561323472"
        }"#;

        let d: KaminoObligationDeposit = serde_json::from_str(json).unwrap();
        assert_eq!(
            d.deposit_reserve,
            "d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q"
        );
    }
}
