// src/components/charts/PositionTypeChart.tsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { useChartTheme } from './hooks/useChartTheme';

interface PositionData {
  protocol: string;
  supplied: number;
  borrowed: number;
  net: number;
  logo?: string;
}

interface Props {
  positions: PositionData[];
  maskValue: (value: string) => string;
  formatPrice: (value: number) => string;
}

export const PositionTypeChart: React.FC<Props> = ({ 
  positions,
  maskValue,
  formatPrice
}) => {
  const { theme, chartColors } = useChartTheme();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const supplied = payload.find((p: any) => p.dataKey === 'supplied')?.value || 0;
    const borrowed = payload.find((p: any) => p.dataKey === 'borrowed')?.value || 0;
    const net = supplied - borrowed;

    return (
      <div style={{
        background: 'rgba(0, 0, 0, 0.95)',
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ 
          fontWeight: 600, 
          marginBottom: 8,
          fontSize: 13,
          color: '#fff'
        }}>
          {label}
        </div>
        <div style={{ marginBottom: 4 }}>
          <span style={{ color: chartColors.liquidity, fontSize: 12 }}>Supplied: </span>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
            {maskValue(formatPrice(supplied))}
          </span>
        </div>
        <div style={{ marginBottom: 4 }}>
          <span style={{ color: '#ef4444', fontSize: 12 }}>Borrowed: </span>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>
            {maskValue(formatPrice(borrowed))}
          </span>
        </div>
        <div style={{ 
          paddingTop: 6,
          marginTop: 6,
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 12 }}>Net: </span>
          <span style={{ 
            color: net >= 0 ? chartColors.liquidity : '#ef4444', 
            fontSize: 13, 
            fontWeight: 700 
          }}>
            {maskValue(formatPrice(net))}
          </span>
        </div>
      </div>
    );
  };

  if (positions.length === 0) {
    return (
      <ChartContainer
        title="Supply vs Borrow"
        subtitle="Lending positions breakdown"
      >
        <div style={{
          height: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.textSecondary,
          fontSize: 14
        }}>
          No lending positions found
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer
      title="Supply vs Borrow"
      subtitle="Lending positions breakdown"
    >
      <style>{`
        .recharts-rectangle {
          outline: none !important;
        }
        .recharts-rectangle:focus {
          outline: none !important;
        }
      `}</style>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart 
          data={positions}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} />
          <XAxis 
            dataKey="protocol"
            stroke={chartColors.axis}
            style={{ fontSize: 11 }}
          />
          <YAxis 
            stroke={chartColors.axis}
            style={{ fontSize: 11 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
          />
          <Bar 
            dataKey="supplied" 
            name="Supplied"
            fill={chartColors.liquidity}
            radius={[4, 4, 0, 0]}
            animationDuration={800}
          />
          <Bar 
            dataKey="borrowed" 
            name="Borrowed"
            fill="#ef4444"
            radius={[4, 4, 0, 0]}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
        gap: 12,
        marginTop: 16,
        paddingTop: 16,
        borderTop: `1px solid ${theme.border}`
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>
            TOTAL SUPPLIED
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: chartColors.liquidity }}>
            {maskValue(formatPrice(positions.reduce((sum, p) => sum + p.supplied, 0)))}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>
            NET POSITION
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.textPrimary }}>
            {maskValue(formatPrice(positions.reduce((sum, p) => sum + p.net, 0)))}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>
            TOTAL BORROWED
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#ef4444' }}>
            {maskValue(formatPrice(positions.reduce((sum, p) => sum + p.borrowed, 0)))}
          </div>
        </div>
      </div>
    </ChartContainer>
  );
};
