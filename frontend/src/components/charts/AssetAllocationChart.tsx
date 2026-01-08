// src/components/charts/AssetAllocationChart.tsx
import React from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { useChartTheme } from './hooks/useChartTheme';

interface TokenData {
  symbol: string;
  name: string;
  value: number;
  logo?: string;
}

interface Props {
  tokens: TokenData[];
  totalValue: number;
  maskValue: (value: string) => string;
  formatPrice: (value: number) => string;
}

export const AssetAllocationChart: React.FC<Props> = ({ 
  tokens, 
  totalValue,
  maskValue,
  formatPrice
}) => {
  const { theme, chartColors } = useChartTheme();

  // Calculate total of top 5 tokens for percentage calculation
  const top5Tokens = tokens.slice(0, 5);
  const top5Total = top5Tokens.reduce((sum, token) => sum + token.value, 0);

  const data = [
    {
      name: 'Portfolio',
      children: top5Tokens.map((token, index) => ({
        name: token.symbol,
        size: token.value,
        logo: token.logo,
        color: chartColors.palette[index % chartColors.palette.length]
      }))
    }
  ];

  const CustomizedContent = (props: any) => {
    const { x, y, width, height, name, size, logo, color, depth } = props;
    
    // Don't render the root "Portfolio" node
    if (depth === 1 || width < 35 || height < 25) return null;

    const calculatedPercentage = (size / top5Total) * 100;
    const percentage = (!isNaN(calculatedPercentage) && isFinite(calculatedPercentage)) 
      ? calculatedPercentage.toFixed(1) 
      : '0.0';

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: color,
            stroke: theme.bgPanel,
            strokeWidth: 2,
            opacity: 0.9
          }}
        />
        
        {width > 50 && (
          <text
            x={x + width / 2}
            y={y + height / 2 - 6}
            textAnchor="middle"
            fill="white"
            stroke="#000000"
            strokeWidth="4"
            paintOrder="stroke"
            fontSize={width > 80 ? 13 : 11}
            fontWeight="700"
          >
            {name}
          </text>
        )}

        {width > 60 && height > 40 && percentage !== '0.0' && (
          <text
            x={x + width / 2}
            y={y + height / 2 + 10}
            textAnchor="middle"
            fill="white"
            stroke="#000000"
            strokeWidth="4"
            paintOrder="stroke"
            fontSize={10}
            fontWeight="600"
          >
            {percentage}%
          </text>
        )}
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    const calculatedPercentage = (data.size / top5Total) * 100;
    const percentage = (!isNaN(calculatedPercentage) && isFinite(calculatedPercentage))
      ? calculatedPercentage.toFixed(2)
      : '0.00';

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
          {maskValue(formatPrice(data.size))}
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 11 }}>
          {percentage}% of portfolio
        </div>
      </div>
    );
  };

  return (
    <ChartContainer
      title="Asset Allocation"
      subtitle="Hierarchical view of top assets"
    >
      <ResponsiveContainer width="100%" height={300}>
        <Treemap
          data={data}
          dataKey="size"
          stroke={theme.bgPanel}
          fill="#8884d8"
          content={<CustomizedContent />}
          animationDuration={800}
        >
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </ChartContainer>
  );
};
