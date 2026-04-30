use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::aggregation::AggregationResult;

pub const SNAPSHOT_VERSION: u32 = 1;

fn serialize_uuid<S>(uuid: &Uuid, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&uuid.to_string())
}

fn deserialize_uuid<'de, D>(deserializer: D) -> Result<Uuid, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    Uuid::parse_str(&s).map_err(serde::de::Error::custom)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotSummary {
    pub position_count: u32,
    pub by_protocol: HashMap<String, f64>,
    pub by_chain: HashMap<String, f64>,
    #[serde(default)]
    pub by_position_type: HashMap<String, f64>,
    #[serde(default)]
    pub by_protocol_position_type: HashMap<String, HashMap<String, f64>>,
    #[serde(default)]
    pub wallet_value_usd: f64,
    #[serde(default)]
    pub supplied_value_usd: f64,
    #[serde(default)]
    pub borrowed_value_usd: f64,
    #[serde(default)]
    pub pools_value_usd: f64,
    #[serde(default)]
    pub staking_value_usd: f64,
    #[serde(default)]
    pub net_worth_usd: f64,
    #[serde(default)]
    pub net_apy: f64,
    #[serde(default)]
    pub apy_by_position_type: HashMap<String, f64>,
    #[serde(default)]
    pub apy_by_protocol: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailySnapshot {
    pub version: u32,
    pub wallet_group_id: Uuid,
    pub date: String,
    pub total_value_usd: f64,
    pub positions: Vec<AggregationResult>,
    pub summary: SnapshotSummary,
    pub created_at: DateTime<Utc>,
}

impl DailySnapshot {
    pub fn from_results(wallet_group_id: Uuid, date: &str, results: &[AggregationResult]) -> Self {
        let summary = build_summary(results);

        Self {
            version: SNAPSHOT_VERSION,
            wallet_group_id,
            date: date.to_string(),
            total_value_usd: summary.net_worth_usd,
            positions: results.to_vec(),
            summary,
            created_at: Utc::now(),
        }
    }
}

fn build_summary(results: &[AggregationResult]) -> SnapshotSummary {
    let mut by_protocol: HashMap<String, f64> = HashMap::new();
    let mut by_chain: HashMap<String, f64> = HashMap::new();
    let mut by_position_type: HashMap<String, f64> = HashMap::new();
    let mut by_protocol_position_type: HashMap<String, HashMap<String, f64>> = HashMap::new();

    let mut wallet_value_usd = 0.0;
    let mut supplied_value_usd = 0.0;
    let mut borrowed_value_usd = 0.0;
    let mut pools_value_usd = 0.0;
    let mut staking_value_usd = 0.0;

    // weighted APY accumulators: (weighted_sum, total_weight)
    let mut net_apy_weighted = 0.0;
    let mut net_apy_weight = 0.0;
    let mut apy_by_position_type_weighted: HashMap<String, (f64, f64)> = HashMap::new();
    let mut apy_by_protocol_weighted: HashMap<String, (f64, f64)> = HashMap::new();

    for r in results {
        let position_type_lower = r.position_type.to_lowercase();
        let is_borrow = position_type_lower == "borrowing";
        let signed_value = if is_borrow { -r.value_usd } else { r.value_usd };

        *by_protocol.entry(r.protocol.clone()).or_default() += signed_value;
        *by_chain.entry(r.chain.clone()).or_default() += signed_value;
        *by_position_type
            .entry(r.position_type.clone())
            .or_default() += r.value_usd;
        *by_protocol_position_type
            .entry(r.protocol.clone())
            .or_default()
            .entry(r.position_type.clone())
            .or_default() += r.value_usd;

        match position_type_lower.as_str() {
            "wallet" => wallet_value_usd += r.value_usd,
            "lending" => supplied_value_usd += r.value_usd,
            "borrowing" => borrowed_value_usd += r.value_usd,
            "liquiditypool" | "liquidity_pool" | "pool" => pools_value_usd += r.value_usd,
            "staking" | "locking" | "yield" => staking_value_usd += r.value_usd,
            _ => {}
        }

        let yield_rate = r.apy.or(r.apr);
        if let Some(rate) = yield_rate {
            if r.value_usd > 0.0 {
                let signed_rate = if is_borrow { -rate } else { rate };

                net_apy_weighted += signed_rate * r.value_usd;
                net_apy_weight += r.value_usd;

                let pt_entry = apy_by_position_type_weighted
                    .entry(r.position_type.clone())
                    .or_default();
                pt_entry.0 += rate * r.value_usd;
                pt_entry.1 += r.value_usd;

                let proto_entry = apy_by_protocol_weighted
                    .entry(r.protocol.clone())
                    .or_default();
                proto_entry.0 += rate * r.value_usd;
                proto_entry.1 += r.value_usd;
            }
        }
    }

    let net_worth_usd =
        wallet_value_usd + supplied_value_usd - borrowed_value_usd + pools_value_usd + staking_value_usd;

    let net_apy = if net_apy_weight > 0.0 {
        net_apy_weighted / net_apy_weight
    } else {
        0.0
    };

    let apy_by_position_type = apy_by_position_type_weighted
        .into_iter()
        .filter(|(_, (_, w))| *w > 0.0)
        .map(|(k, (sum, w))| (k, sum / w))
        .collect();

    let apy_by_protocol = apy_by_protocol_weighted
        .into_iter()
        .filter(|(_, (_, w))| *w > 0.0)
        .map(|(k, (sum, w))| (k, sum / w))
        .collect();

    SnapshotSummary {
        position_count: results.len() as u32,
        by_protocol,
        by_chain,
        by_position_type,
        by_protocol_position_type,
        wallet_value_usd,
        supplied_value_usd,
        borrowed_value_usd,
        pools_value_usd,
        staking_value_usd,
        net_worth_usd,
        net_apy,
        apy_by_position_type,
        apy_by_protocol,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSnapshot {
    #[serde(rename = "_id")]
    #[serde(serialize_with = "serialize_uuid", deserialize_with = "deserialize_uuid")]
    pub id: Uuid,
    pub version: u32,
    pub wallet_group_id: Uuid,
    pub date: String,
    pub synced_at: DateTime<Utc>,
    pub total_value_usd: f64,
    pub positions: Vec<AggregationResult>,
    pub summary: SnapshotSummary,
}

impl SyncSnapshot {
    pub fn from_results(wallet_group_id: Uuid, results: &[AggregationResult]) -> Self {
        let now = Utc::now();
        let date = now.format("%Y-%m-%d").to_string();
        let summary = build_summary(results);

        Self {
            id: Uuid::new_v4(),
            version: SNAPSHOT_VERSION,
            wallet_group_id,
            date,
            synced_at: now,
            total_value_usd: summary.net_worth_usd,
            positions: results.to_vec(),
            summary,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSnapshotSummary {
    pub id: Uuid,
    pub wallet_group_id: Uuid,
    pub date: String,
    pub synced_at: DateTime<Utc>,
    pub total_value_usd: f64,
    pub summary: SnapshotSummary,
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
