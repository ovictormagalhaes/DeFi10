// src/components/charts/RiskMetricsChart.tsx
import React from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { useChartTheme } from './hooks/useChartTheme';

interface Props {
  healthFactor: number | null;
  diversificationScore: number;
  numProtocols: number;
  numChains: number;
  numPositions: number;
}

export const RiskMetricsChart: React.FC<Props> = ({
  healthFactor,
  diversificationScore,
  numProtocols,
  numChains,
  numPositions
}) => {
  const { theme } = useChartTheme();

  const getHealthColor = (hf: number | null) => {
    if (!hf) return '#6b7280';
    if (hf >= 2) return '#10b981';
    if (hf >= 1.5) return '#f59e0b';
    if (hf >= 1.1) return '#ef4444';
    return '#dc2626';
  };

  const getDiversificationColor = (score: number) => {
    if (score > 70) return '#10b981';
    if (score > 40) return '#f59e0b';
    return '#ef4444';
  };

  const healthData = healthFactor ? [
    {
      name: 'Health',
      value: Math.min(healthFactor * 25, 100),
      fill: getHealthColor(healthFactor)
    }
  ] : [];

  const diversificationData = [
    {
      name: 'Diversification',
      value: diversificationScore,
      fill: getDiversificationColor(diversificationScore)
    }
  ];

  return (
    <ChartContainer
      title="Risk & Health Metrics"
      subtitle="Portfolio safety indicators"
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: healthFactor ? 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' : '1fr',
        gap: 20,
        marginBottom: 20
      }}>
        {/* Health Factor Gauge */}
        {healthFactor && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: theme.textSecondary,
              marginBottom: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Health Factor
            </div>
            
            <ResponsiveContainer width="100%" height={140}>
              <RadialBarChart
                innerRadius="80%"
                outerRadius="100%"
                data={healthData}
                startAngle={180}
                endAngle={0}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  angleAxisId={0}
                  tick={false}
                />
                <RadialBar
                  background
                  dataKey="value"
                  cornerRadius={10}
                  fill={healthData[0]?.fill}
                />
              </RadialBarChart>
            </ResponsiveContainer>

            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: getHealthColor(healthFactor),
              marginTop: -70,
              marginBottom: 55
            }}>
              {healthFactor.toFixed(2)}
            </div>

            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: getHealthColor(healthFactor),
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {healthFactor >= 2 ? 'Healthy' : healthFactor >= 1.5 ? 'Moderate' : 'At Risk'}
            </div>
          </div>
        )}

        {/* Diversification Gauge */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: theme.textSecondary,
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Diversification
          </div>
          
          <ResponsiveContainer width="100%" height={140}>
            <RadialBarChart
              innerRadius="80%"
              outerRadius="100%"
              data={diversificationData}
              startAngle={180}
              endAngle={0}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                background
                dataKey="value"
                cornerRadius={10}
                fill={diversificationData[0].fill}
              />
            </RadialBarChart>
          </ResponsiveContainer>

          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color: diversificationData[0].fill,
            marginTop: -70,
            marginBottom: 55
          }}>
            {diversificationScore}
          </div>

          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: diversificationData[0].fill,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {diversificationScore > 70 ? 'Well Diversified' : diversificationScore > 40 ? 'Moderate' : 'Concentrated'}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        paddingTop: 16,
        borderTop: `1px solid ${theme.border}`
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.textPrimary, marginBottom: 4 }}>
            {numProtocols}
          </div>
          <div style={{ fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase' }}>
            Protocols
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.textPrimary, marginBottom: 4 }}>
            {numChains}
          </div>
          <div style={{ fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase' }}>
            Chains
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.textPrimary, marginBottom: 4 }}>
            {numPositions}
          </div>
          <div style={{ fontSize: 11, color: theme.textSecondary, textTransform: 'uppercase' }}>
            Positions
          </div>
        </div>
      </div>

      {/* Warning if health factor is low */}
      {healthFactor && healthFactor < 1.5 && (
        <div style={{
          marginTop: 16,
          padding: 10,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ fontSize: 11, color: '#ef4444' }}>
            Low health factor. Consider adding collateral or reducing debt.
          </span>
        </div>
      )}
    </ChartContainer>
  );
};
