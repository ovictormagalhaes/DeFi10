import React, { useMemo } from 'react';

import {
  PortfolioCompositionChart,
  AssetAllocationChart,
  ProtocolComparisonChart,
  TokenDistributionChart,
  ChainDistributionChart,
  RiskMetricsChart,
  PositionTypeChart,
  ProjectionsChart,
  useChartData
} from './charts';

const AdvancedAnalytics = ({
  walletTokens,
  getLiquidityPoolsData,
  getLendingAndBorrowingData,
  getStakingData,
  getLockingData,
  getTotalPortfolioValue,
  maskValue,
  formatPrice,
  theme,
  groupDefiByProtocol,
  filterLendingDefiTokens,
  showLendingDefiTokens,
}) => {
  const liquidityData = getLiquidityPoolsData();
  const lendingData = getLendingAndBorrowingData();
  const stakingData = getStakingData();
  const lockingData = getLockingData ? getLockingData() : [];
  
  console.log('[AdvancedAnalytics] Data lengths:', {
    liquidity: liquidityData.length,
    lending: lendingData.length,
    staking: stakingData.length,
    locking: lockingData.length
  });

  // Use the chart data hook to process all data
  const chartData = useChartData({
    walletTokens,
    liquidityData,
    lendingData,
    stakingData,
    lockingData,
    groupDefiByProtocol,
    filterLendingDefiTokens,
    showLendingDefiTokens
  });

  const {
    portfolioData,
    topTokens,
    protocolDistribution,
    chainDistribution,
    lendingPositions,
    projectionData
  } = chartData;

  // Calculate health factor from lending data
  const healthFactor = useMemo(() => {
    for (const item of lendingData) {
      const hf = item.additionalData?.healthFactor || item.additionalInfo?.healthFactor;
      if (hf && hf > 0) return hf;
    }
    return null;
  }, [lendingData]);

  // Calculate diversification score
  const diversificationScore = useMemo(() => {
    const numProtocols = protocolDistribution.length;
    const numChains = chainDistribution.length;
    const topTokenPercentage = topTokens.length > 0 && portfolioData.totalValue > 0
      ? (topTokens[0].value / portfolioData.totalValue) * 100
      : 0;
    
    // Score formula: more protocols/chains = better, less concentration in top token = better
    const protocolScore = Math.min(numProtocols * 8, 40);
    const chainScore = Math.min(numChains * 12, 30);
    const concentrationScore = Math.max(30 - topTokenPercentage, 0);
    
    return Math.min(Math.round(protocolScore + chainScore + concentrationScore), 100);
  }, [protocolDistribution, chainDistribution, topTokens, portfolioData]);

  return (
    <div 
      className="panel" 
      style={{ 
        padding: 24, 
        marginTop: 16,
      }}
    >
      <style>
        {`
          @media (max-width: 768px) {
            .panel {
              padding: 16px !important;
            }
          }
          @media (max-width: 480px) {
            .panel {
              padding: 12px !important;
            }
          }
        `}
      </style>
      {/* Header */}
      <div className="flex items-center" style={{ gap: 12, marginBottom: 24 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
          >
            <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
          </svg>
        </div>
        <div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: theme.textPrimary,
              margin: 0,
              marginBottom: 4,
            }}
          >
            Advanced Analytics
          </h3>
          <p
            style={{
              fontSize: 13,
              color: theme.textSecondary,
              margin: 0,
            }}
          >
            Deep insights into your portfolio composition and performance
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))',
          gap: 16,
        }}
      >
        {/* Portfolio Composition Chart */}
        <PortfolioCompositionChart
          data={portfolioData.composition}
          totalValue={portfolioData.totalValue}
          formatPrice={formatPrice}
          maskValue={maskValue}
        />

        {/* Token Distribution Chart */}
        <TokenDistributionChart
          tokens={topTokens}
          totalValue={portfolioData.totalValue}
          formatPrice={formatPrice}
          maskValue={maskValue}
        />

        {/* Protocol Comparison Chart */}
        {protocolDistribution.length > 0 && (
          <ProtocolComparisonChart
            protocols={protocolDistribution}
            formatPrice={formatPrice}
            maskValue={maskValue}
          />
        )}

        {/* Chain Distribution Chart */}
        {chainDistribution.length > 0 && (
          <ChainDistributionChart
            chains={chainDistribution}
            totalValue={portfolioData.totalValue}
            formatPrice={formatPrice}
            maskValue={maskValue}
          />
        )}

        {/* Asset Allocation Treemap (full width) */}
        <div style={{ gridColumn: '1 / -1' }}>
          <AssetAllocationChart
            tokens={topTokens}
            totalValue={portfolioData.totalValue}
            formatPrice={formatPrice}
            maskValue={maskValue}
          />
        </div>

        {/* Risk Metrics (full width) */}
        <div style={{ gridColumn: '1 / -1' }}>
          <RiskMetricsChart
            healthFactor={healthFactor}
            diversificationScore={diversificationScore}
          />
        </div>

        {/* Position Type Chart (Lending only) - Full width */}
        {lendingPositions.length > 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <PositionTypeChart
              positions={lendingPositions}
              formatPrice={formatPrice}
              maskValue={maskValue}
            />
          </div>
        )}

        {/* Projections Timeline (full width) */}
        {(projectionData.lending.length > 0 || projectionData.liquidity.length > 0) && (
          <div style={{ gridColumn: '1 / -1' }}>
            <ProjectionsChart
              projections={projectionData}
              formatPrice={formatPrice}
              maskValue={maskValue}
              totalPortfolioValue={getTotalPortfolioValue()}
              totalLiquidityValue={portfolioData.liquidityValue}
              totalLendingValue={Math.abs(portfolioData.lendingValue)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedAnalytics;
