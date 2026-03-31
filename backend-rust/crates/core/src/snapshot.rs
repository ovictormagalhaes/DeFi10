use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::aggregation::AggregationResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotPosition {
    pub account: String,
    pub chain: String,
    pub protocol: String,
    pub position_type: String,
    pub token_symbol: String,
    pub token_address: String,
    pub balance: f64,
    pub value_usd: f64,
    pub price_usd: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub apy: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health_factor: Option<f64>,
}

impl From<&AggregationResult> for SnapshotPosition {
    fn from(r: &AggregationResult) -> Self {
        Self {
            account: r.account.clone(),
            chain: r.chain.clone(),
            protocol: r.protocol.clone(),
            position_type: r.position_type.clone(),
            token_symbol: r.token_symbol.clone(),
            token_address: r.token_address.clone(),
            balance: r.balance,
            value_usd: r.value_usd,
            price_usd: r.price_usd,
            apy: r.apy,
            health_factor: r.health_factor,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotSummary {
    pub position_count: u32,
    pub by_protocol: HashMap<String, f64>,
    pub by_chain: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailySnapshot {
    pub wallet_group_id: Uuid,
    pub date: String,
    pub total_value_usd: f64,
    pub positions: Vec<SnapshotPosition>,
    pub summary: SnapshotSummary,
    pub created_at: DateTime<Utc>,
}

impl DailySnapshot {
    pub fn from_results(wallet_group_id: Uuid, date: &str, results: &[AggregationResult]) -> Self {
        let positions: Vec<SnapshotPosition> = results.iter().map(SnapshotPosition::from).collect();
        let total_value_usd: f64 = results.iter().map(|r| r.value_usd).sum();

        let mut by_protocol: HashMap<String, f64> = HashMap::new();
        let mut by_chain: HashMap<String, f64> = HashMap::new();

        for r in results {
            *by_protocol.entry(r.protocol.clone()).or_default() += r.value_usd;
            *by_chain.entry(r.chain.clone()).or_default() += r.value_usd;
        }

        Self {
            wallet_group_id,
            date: date.to_string(),
            total_value_usd,
            positions,
            summary: SnapshotSummary {
                position_count: results.len() as u32,
                by_protocol,
                by_chain,
            },
            created_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolDistributionEntry {
    pub value_usd: f64,
    pub percent: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_percent: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainDistributionEntry {
    pub value_usd: f64,
    pub percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortfolioAnalytics {
    pub wallet_group_id: Uuid,
    pub date: String,
    pub total_value_usd: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_day_value_usd: Option<f64>,
    pub daily_pnl: f64,
    pub daily_pnl_percent: f64,
    pub cumulative_pnl: f64,
    pub cumulative_pnl_percent: f64,
    pub protocol_distribution: HashMap<String, ProtocolDistributionEntry>,
    pub chain_distribution: HashMap<String, ChainDistributionEntry>,
    pub high_water_mark: f64,
    pub drawdown_from_hwm: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub volatility_7d: Option<f64>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPoint {
    pub date: String,
    pub total_value_usd: f64,
    pub daily_pnl: f64,
    pub daily_pnl_percent: f64,
    pub summary: SnapshotSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionHistoryPoint {
    pub date: String,
    pub balance: f64,
    pub value_usd: f64,
    pub price_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsSummary {
    pub total_pnl: f64,
    pub total_pnl_percent: f64,
    pub high_water_mark: f64,
    pub drawdown_from_hwm: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub best_day: Option<DayPnl>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub worst_day: Option<DayPnl>,
    pub current_value_usd: f64,
    pub days_tracked: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayPnl {
    pub date: String,
    pub pnl: f64,
    pub pnl_percent: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_result(protocol: &str, chain: &str, value: f64) -> AggregationResult {
        AggregationResult {
            account: "0x123".to_string(),
            chain: chain.to_string(),
            protocol: protocol.to_string(),
            position_type: "lending".to_string(),
            balance: 100.0,
            balance_raw: "100".to_string(),
            decimals: 18,
            value_usd: value,
            price_usd: value / 100.0,
            token_symbol: "USDC".to_string(),
            token_name: "USD Coin".to_string(),
            token_address: "0xtoken".to_string(),
            timestamp: Utc::now(),
            apy: Some(3.5),
            apr: None,
            apr_historical: None,
            health_factor: Some(1.8),
            is_collateral: None,
            can_be_collateral: None,
            logo: None,
            token_type: None,
            metadata: None,
        }
    }

    #[test]
    fn test_daily_snapshot_from_results() {
        let results = vec![
            make_result("aave-v3", "ethereum", 800.0),
            make_result("uniswap-v3", "ethereum", 200.0),
            make_result("kamino", "solana", 500.0),
        ];

        let snapshot = DailySnapshot::from_results(Uuid::new_v4(), "2026-03-30", &results);

        assert_eq!(snapshot.total_value_usd, 1500.0);
        assert_eq!(snapshot.summary.position_count, 3);
        assert_eq!(snapshot.summary.by_protocol.get("aave-v3"), Some(&800.0));
        assert_eq!(snapshot.summary.by_chain.get("ethereum"), Some(&1000.0));
        assert_eq!(snapshot.summary.by_chain.get("solana"), Some(&500.0));
    }
}
