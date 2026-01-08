// src/components/charts/ProtocolComparisonChart.tsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { useChartTheme } from './hooks/useChartTheme';

interface ProtocolData {
  name: string;
  value: number;
  logo?: string;
  color: string;
  positionsCount?: number;
}

interface Props {
  protocols: ProtocolData[];
  maskValue: (value: string) => string;
  formatPrice: (value: number) => string;
}

export const ProtocolComparisonChart: React.FC<Props> = ({ 
  protocols,
  maskValue,
  formatPrice
}) => {
  const { theme, chartColors } = useChartTheme();

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    
    return (
      <div style={{
        background: 'rgba(0, 0, 0, 0.95)',
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6
        }}>
          {data.logo && (
            <img 
              src={data.logo} 
              alt={data.name}
              style={{ width: 20, height: 20, borderRadius: '50%' }}
            />
          )}
          <div style={{ 
            color: data.color, 
            fontWeight: 600, 
            fontSize: 13
          }}>
            {data.name}
          </div>
        </div>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
          {maskValue(formatPrice(data.value))}
        </div>
        {data.positionsCount && (
          <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 11 }}>
            {data.positionsCount} position{data.positionsCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  };

  return (
    <ChartContainer
      title="Protocol Comparison"
      subtitle="Total value by protocol"
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart 
          data={protocols}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} />
          <XAxis 
            type="number"
            stroke={chartColors.axis}
            style={{ fontSize: 11 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
          />
          <YAxis 
            type="category"
            dataKey="name"
            stroke={chartColors.axis}
            style={{ fontSize: 11 }}
            width={80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="value" 
            radius={[0, 4, 4, 0]}
            animationDuration={800}
          >
            {protocols.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};
