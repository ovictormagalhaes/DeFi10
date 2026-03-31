use std::collections::HashMap;

use chrono::Utc;

use crate::snapshot::{
    ChainDistributionEntry, DailySnapshot, PortfolioAnalytics, ProtocolDistributionEntry,
};

pub fn compute_analytics(
    today: &DailySnapshot,
    previous: Option<&PortfolioAnalytics>,
    first_snapshot: Option<&DailySnapshot>,
    recent_totals: &[f64],
) -> PortfolioAnalytics {
    let prev_value = previous
        .map(|p| p.total_value_usd)
        .unwrap_or(today.total_value_usd);
    let daily_pnl = today.total_value_usd - prev_value;
    let daily_pnl_percent = if prev_value != 0.0 {
        (daily_pnl / prev_value) * 100.0
    } else {
        0.0
    };

    let first_value = first_snapshot
        .map(|f| f.total_value_usd)
        .unwrap_or(today.total_value_usd);
    let cumulative_pnl = today.total_value_usd - first_value;
    let cumulative_pnl_percent = if first_value != 0.0 {
        (cumulative_pnl / first_value) * 100.0
    } else {
        0.0
    };

    let prev_hwm = previous.map(|p| p.high_water_mark).unwrap_or(0.0);
    let high_water_mark = today.total_value_usd.max(prev_hwm);
    let drawdown_from_hwm = if high_water_mark > 0.0 {
        ((today.total_value_usd - high_water_mark) / high_water_mark) * 100.0
    } else {
        0.0
    };

    let prev_protocol_dist = previous
        .map(|p| &p.protocol_distribution)
        .cloned()
        .unwrap_or_default();

    let protocol_distribution = build_protocol_distribution(
        &today.summary.by_protocol,
        today.total_value_usd,
        &prev_protocol_dist,
    );

    let chain_distribution =
        build_chain_distribution(&today.summary.by_chain, today.total_value_usd);

    let volatility_7d = compute_volatility(recent_totals);

    PortfolioAnalytics {
        wallet_group_id: today.wallet_group_id,
        date: today.date.clone(),
        total_value_usd: today.total_value_usd,
        previous_day_value_usd: previous.map(|p| p.total_value_usd),
        daily_pnl,
        daily_pnl_percent,
        cumulative_pnl,
        cumulative_pnl_percent,
        protocol_distribution,
        chain_distribution,
        high_water_mark,
        drawdown_from_hwm,
        volatility_7d,
        created_at: Utc::now(),
    }
}

fn build_protocol_distribution(
    by_protocol: &HashMap<String, f64>,
    total: f64,
    previous: &HashMap<String, ProtocolDistributionEntry>,
) -> HashMap<String, ProtocolDistributionEntry> {
    by_protocol
        .iter()
        .map(|(protocol, &value)| {
            let percent = if total > 0.0 {
                (value / total) * 100.0
            } else {
                0.0
            };
            let previous_percent = previous.get(protocol).map(|p| p.percent);
            (
                protocol.clone(),
                ProtocolDistributionEntry {
                    value_usd: value,
                    percent,
                    previous_percent,
                },
            )
        })
        .collect()
}

fn build_chain_distribution(
    by_chain: &HashMap<String, f64>,
    total: f64,
) -> HashMap<String, ChainDistributionEntry> {
    by_chain
        .iter()
        .map(|(chain, &value)| {
            let percent = if total > 0.0 {
                (value / total) * 100.0
            } else {
                0.0
            };
            (
                chain.clone(),
                ChainDistributionEntry {
                    value_usd: value,
                    percent,
                },
            )
        })
        .collect()
}

fn compute_volatility(totals: &[f64]) -> Option<f64> {
    if totals.len() < 3 {
        return None;
    }

    let returns: Vec<f64> = totals
        .windows(2)
        .filter_map(|w| {
            if w[0] != 0.0 {
                Some((w[1] - w[0]) / w[0])
            } else {
                None
            }
        })
        .collect();

    if returns.is_empty() {
        return None;
    }

    let mean = returns.iter().sum::<f64>() / returns.len() as f64;
    let variance = returns.iter().map(|r| (r - mean).powi(2)).sum::<f64>() / returns.len() as f64;

    Some((variance.sqrt()) * 100.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::snapshot::DailySnapshot;
    use uuid::Uuid;

    fn make_snapshot(date: &str, total: f64) -> DailySnapshot {
        let mut by_protocol = HashMap::new();
        by_protocol.insert("aave-v3".to_string(), total * 0.6);
        by_protocol.insert("uniswap-v3".to_string(), total * 0.4);

        let mut by_chain = HashMap::new();
        by_chain.insert("ethereum".to_string(), total);

        DailySnapshot {
            wallet_group_id: Uuid::new_v4(),
            date: date.to_string(),
            total_value_usd: total,
            positions: vec![],
            summary: crate::snapshot::SnapshotSummary {
                position_count: 2,
                by_protocol,
                by_chain,
            },
            created_at: Utc::now(),
        }
    }

    #[test]
    fn test_first_day_analytics() {
        let today = make_snapshot("2026-03-30", 1000.0);
        let analytics = compute_analytics(&today, None, None, &[]);

        assert_eq!(analytics.daily_pnl, 0.0);
        assert_eq!(analytics.cumulative_pnl, 0.0);
        assert_eq!(analytics.high_water_mark, 1000.0);
        assert_eq!(analytics.drawdown_from_hwm, 0.0);
        assert!(analytics.volatility_7d.is_none());
    }

    #[test]
    fn test_with_previous_day() {
        let today = make_snapshot("2026-03-31", 1100.0);
        let first = make_snapshot("2026-03-29", 900.0);

        let prev = PortfolioAnalytics {
            wallet_group_id: today.wallet_group_id,
            date: "2026-03-30".to_string(),
            total_value_usd: 1000.0,
            previous_day_value_usd: Some(900.0),
            daily_pnl: 100.0,
            daily_pnl_percent: 11.11,
            cumulative_pnl: 100.0,
            cumulative_pnl_percent: 11.11,
            protocol_distribution: HashMap::new(),
            chain_distribution: HashMap::new(),
            high_water_mark: 1000.0,
            drawdown_from_hwm: 0.0,
            volatility_7d: None,
            created_at: Utc::now(),
        };

        let analytics =
            compute_analytics(&today, Some(&prev), Some(&first), &[900.0, 1000.0, 1100.0]);

        assert_eq!(analytics.daily_pnl, 100.0);
        assert!((analytics.daily_pnl_percent - 10.0).abs() < 0.01);
        assert_eq!(analytics.cumulative_pnl, 200.0);
        assert_eq!(analytics.high_water_mark, 1100.0);
        assert_eq!(analytics.drawdown_from_hwm, 0.0);
        assert!(analytics.volatility_7d.is_some());
    }

    #[test]
    fn test_drawdown() {
        let today = make_snapshot("2026-04-01", 800.0);

        let prev = PortfolioAnalytics {
            wallet_group_id: today.wallet_group_id,
            date: "2026-03-31".to_string(),
            total_value_usd: 1100.0,
            previous_day_value_usd: Some(1000.0),
            daily_pnl: 100.0,
            daily_pnl_percent: 10.0,
            cumulative_pnl: 200.0,
            cumulative_pnl_percent: 22.22,
            protocol_distribution: HashMap::new(),
            chain_distribution: HashMap::new(),
            high_water_mark: 1100.0,
            drawdown_from_hwm: 0.0,
            volatility_7d: None,
            created_at: Utc::now(),
        };

        let analytics = compute_analytics(&today, Some(&prev), None, &[]);

        assert_eq!(analytics.high_water_mark, 1100.0);
        assert!((analytics.drawdown_from_hwm - (-27.27)).abs() < 0.1);
    }

    #[test]
    fn test_volatility_calculation() {
        let totals = vec![1000.0, 1010.0, 990.0, 1020.0, 1000.0, 1030.0, 1010.0];
        let vol = compute_volatility(&totals);
        assert!(vol.is_some());
        assert!(vol.unwrap() > 0.0);
    }
}
