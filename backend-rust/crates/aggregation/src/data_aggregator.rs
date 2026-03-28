use defi10_core::{Chain, Protocol, Result};
use defi10_protocols::types::ProtocolPosition;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregatedPortfolio {
    pub wallet_address: String,
    pub total_value_usd: f64,
    pub positions_by_protocol: HashMap<Protocol, Vec<ProtocolPosition>>,
    pub positions_by_chain: HashMap<Chain, Vec<ProtocolPosition>>,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioSummary {
    pub total_value_usd: f64,
    pub total_positions: usize,
    pub protocols_count: usize,
    pub chains: Vec<Chain>,
    pub top_positions: Vec<PositionSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionSummary {
    pub protocol: Protocol,
    pub chain: Chain,
    pub value_usd: f64,
    pub tokens: Vec<String>,
}

pub struct DataAggregator;

impl DataAggregator {
    pub fn new() -> Self {
        Self
    }

    /// Aggregate positions from multiple protocols
    pub fn aggregate_portfolio(
        &self,
        wallet_address: String,
        all_positions: Vec<ProtocolPosition>,
    ) -> Result<AggregatedPortfolio> {
        let mut positions_by_protocol: HashMap<Protocol, Vec<ProtocolPosition>> = HashMap::new();
        let mut positions_by_chain: HashMap<Chain, Vec<ProtocolPosition>> = HashMap::new();
        let mut total_value_usd = 0.0;

        for position in all_positions {
            total_value_usd += position.total_value_usd;

            // Group by protocol
            positions_by_protocol
                .entry(position.protocol)
                .or_default()
                .push(position.clone());

            // Group by chain
            positions_by_chain
                .entry(position.chain)
                .or_default()
                .push(position);
        }

        info!(
            "Aggregated portfolio for {} with {} positions across {} protocols",
            wallet_address,
            positions_by_protocol
                .values()
                .map(|v| v.len())
                .sum::<usize>(),
            positions_by_protocol.len()
        );

        Ok(AggregatedPortfolio {
            wallet_address,
            total_value_usd,
            positions_by_protocol,
            positions_by_chain,
            last_updated: chrono::Utc::now(),
        })
    }

    /// Create summary from aggregated portfolio
    pub fn create_summary(&self, portfolio: &AggregatedPortfolio) -> Result<PortfolioSummary> {
        let total_positions = portfolio
            .positions_by_protocol
            .values()
            .map(|v| v.len())
            .sum();

        let chains: Vec<Chain> = portfolio.positions_by_chain.keys().cloned().collect();

        // Get top 5 positions by value
        let mut all_positions: Vec<&ProtocolPosition> =
            portfolio.positions_by_protocol.values().flatten().collect();

        all_positions.sort_by(|a, b| {
            b.total_value_usd
                .partial_cmp(&a.total_value_usd)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let top_positions: Vec<PositionSummary> = all_positions
            .iter()
            .take(5)
            .map(|pos| PositionSummary {
                protocol: pos.protocol,
                chain: pos.chain,
                value_usd: pos.total_value_usd,
                tokens: pos.tokens.iter().map(|t| t.symbol.clone()).collect(),
            })
            .collect();

        Ok(PortfolioSummary {
            total_value_usd: portfolio.total_value_usd,
            total_positions,
            protocols_count: portfolio.positions_by_protocol.len(),
            chains,
            top_positions,
        })
    }

    /// Calculate protocol distribution
    pub fn calculate_protocol_distribution(
        &self,
        portfolio: &AggregatedPortfolio,
    ) -> HashMap<Protocol, f64> {
        let mut distribution = HashMap::new();

        for (protocol, positions) in &portfolio.positions_by_protocol {
            let total_value: f64 = positions.iter().map(|p| p.total_value_usd).sum();
            let percentage = if portfolio.total_value_usd > 0.0 {
                (total_value / portfolio.total_value_usd) * 100.0
            } else {
                0.0
            };
            distribution.insert(*protocol, percentage);
        }

        distribution
    }

    /// Calculate chain distribution
    pub fn calculate_chain_distribution(
        &self,
        portfolio: &AggregatedPortfolio,
    ) -> HashMap<Chain, f64> {
        let mut distribution = HashMap::new();

        for (chain, positions) in &portfolio.positions_by_chain {
            let total_value: f64 = positions.iter().map(|p| p.total_value_usd).sum();
            let percentage = if portfolio.total_value_usd > 0.0 {
                (total_value / portfolio.total_value_usd) * 100.0
            } else {
                0.0
            };
            distribution.insert(*chain, percentage);
        }

        distribution
    }
}

impl Default for DataAggregator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use defi10_protocols::types::{PositionToken, PositionType};

    fn create_test_position(protocol: Protocol, chain: Chain, value: f64) -> ProtocolPosition {
        ProtocolPosition {
            protocol,
            chain,
            wallet_address: "0xtest".to_string(),
            position_type: PositionType::Lending,
            tokens: vec![PositionToken {
                token_address: "0xtoken".to_string(),
                symbol: "TEST".to_string(),
                name: "Test Token".to_string(),
                decimals: 18,
                balance: value.to_string(),
                balance_usd: value,
                price_usd: 1.0,
                token_type: None,
            }],
            total_value_usd: value,
            metadata: serde_json::json!({}),
        }
    }

    #[test]
    fn test_aggregate_portfolio() {
        let aggregator = DataAggregator::new();

        let positions = vec![
            create_test_position(Protocol::AaveV3, Chain::Ethereum, 1000.0),
            create_test_position(Protocol::AaveV3, Chain::Ethereum, 500.0),
            create_test_position(Protocol::UniswapV3, Chain::Ethereum, 750.0),
        ];

        let portfolio = aggregator
            .aggregate_portfolio("0xtest".to_string(), positions)
            .unwrap();

        assert_eq!(portfolio.total_value_usd, 2250.0);
        assert_eq!(portfolio.positions_by_protocol.len(), 2);
        assert_eq!(portfolio.positions_by_chain.len(), 1);
    }

    #[test]
    fn test_create_summary() {
        let aggregator = DataAggregator::new();

        let positions = vec![
            create_test_position(Protocol::AaveV3, Chain::Ethereum, 1000.0),
            create_test_position(Protocol::UniswapV3, Chain::Arbitrum, 500.0),
        ];

        let portfolio = aggregator
            .aggregate_portfolio("0xtest".to_string(), positions)
            .unwrap();

        let summary = aggregator.create_summary(&portfolio).unwrap();

        assert_eq!(summary.total_positions, 2);
        assert_eq!(summary.protocols_count, 2);
        assert_eq!(summary.chains.len(), 2);
    }

    #[test]
    fn test_protocol_distribution() {
        let aggregator = DataAggregator::new();

        let positions = vec![
            create_test_position(Protocol::AaveV3, Chain::Ethereum, 700.0),
            create_test_position(Protocol::UniswapV3, Chain::Ethereum, 300.0),
        ];

        let portfolio = aggregator
            .aggregate_portfolio("0xtest".to_string(), positions)
            .unwrap();

        let distribution = aggregator.calculate_protocol_distribution(&portfolio);

        assert_eq!(distribution.get(&Protocol::AaveV3), Some(&70.0));
        assert_eq!(distribution.get(&Protocol::UniswapV3), Some(&30.0));
    }

    #[test]
    fn test_chain_distribution() {
        let aggregator = DataAggregator::new();

        let positions = vec![
            create_test_position(Protocol::AaveV3, Chain::Ethereum, 600.0),
            create_test_position(Protocol::UniswapV3, Chain::Arbitrum, 400.0),
        ];

        let portfolio = aggregator
            .aggregate_portfolio("0xtest".to_string(), positions)
            .unwrap();

        let distribution = aggregator.calculate_chain_distribution(&portfolio);

        assert_eq!(distribution.get(&Chain::Ethereum), Some(&60.0));
        assert_eq!(distribution.get(&Chain::Arbitrum), Some(&40.0));
    }
}
