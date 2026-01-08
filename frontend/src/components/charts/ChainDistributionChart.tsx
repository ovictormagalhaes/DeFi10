// src/components/charts/ChainDistributionChart.tsx
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { useChartTheme } from './hooks/useChartTheme';
import { useChainIcons } from '../../context/ChainIconsProvider';

interface ChainData {
  chain: string;
  value: number;
  color: string;
}

interface Props {
  chains: ChainData[];
  totalValue: number;
  maskValue: (value: string) => string;
  formatPrice: (value: number) => string;
}

export const ChainDistributionChart: React.FC<Props> = ({ 
  chains, 
  totalValue,
  maskValue,
  formatPrice
}) => {
  const { theme } = useChartTheme();
  const { getIcon: getChainIcon } = useChainIcons();

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    const chainName = data.chain || 'Unknown';
    const formattedChain = chainName.charAt(0).toUpperCase() + chainName.slice(1).toLowerCase();
    const chainIcon = getChainIcon(chainName.toLowerCase());
    
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
          color: data.color, 
          fontWeight: 600, 
          marginBottom: 4,
          fontSize: 13
        }}>
          {chainIcon && (
            <img 
              src={chainIcon} 
              alt={chainName}
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%'
              }}
            />
          )}
          {formattedChain}
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
    const radius = innerRadius + (outerRadius - innerRadius) * 0.65; // Increased from 0.5 to 0.65 to move label more inside
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
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontWeight: 600, fontSize: 11 }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ChartContainer
      title="Chain Distribution"
      subtitle={`${chains.length} chains`}
    >
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chains}
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
            {chains.map((entry, index) => (
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
            formatter={(value, entry: any) => {
              const chainName = entry.payload?.chain || value;
              const formattedName = chainName.charAt(0).toUpperCase() + chainName.slice(1).toLowerCase();
              const chainIcon = getChainIcon(chainName.toLowerCase());
              
              return (
                <span style={{ 
                  color: theme.textPrimary, 
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  {chainIcon && (
                    <img 
                      src={chainIcon} 
                      alt={chainName}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%'
                      }}
                    />
                  )}
                  {formattedName}
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};
