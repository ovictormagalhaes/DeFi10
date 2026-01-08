// src/components/charts/PortfolioCompositionChart.tsx
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { useChartTheme } from './hooks/useChartTheme';

interface DataItem {
  name: string;
  value: number;
  color: string;
}

interface Props {
  data: DataItem[];
  totalValue: number;
  maskValue: (value: string) => string;
  formatPrice: (value: number) => string;
}

export const PortfolioCompositionChart: React.FC<Props> = ({ 
  data, 
  totalValue,
  maskValue,
  formatPrice
}) => {
  const { theme } = useChartTheme();

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
          color: data.color, 
          fontWeight: 600, 
          marginBottom: 4,
          fontSize: 13
        }}>
          {data.name}
        </div>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>
          {maskValue(formatPrice(data.value))}
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 11 }}>
          {((data.value / totalValue) * 100).toFixed(1)}% of portfolio
        </div>
      </div>
    );
  };

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text 
        x={x} 
        y={y} 
        fill="white"
        stroke="#000000"
        strokeWidth="4"
        paintOrder="stroke"
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        style={{ fontWeight: 600, fontSize: 11 }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ChartContainer
      title="Portfolio Composition"
      subtitle={`Total: ${maskValue(formatPrice(totalValue))}`}
    >
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderLabel}
            outerRadius={100}
            innerRadius={60}
            fill="#8884d8"
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color}
                stroke={theme.bgPanel}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            iconType="circle"
            formatter={(value) => (
              <span style={{ color: theme.textPrimary, fontSize: 12 }}>
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};
