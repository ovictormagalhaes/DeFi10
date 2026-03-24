// src/components/charts/ProjectionsChart.tsx
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { useChartTheme } from './hooks/useChartTheme';
import { useMaskValues } from '../../context/MaskValuesContext';

interface ProjectionData {
  type: string;
  oneDay: number;
  oneWeek: number;
  oneMonth: number;
  oneYear: number;
  rate?: number; // APR/APY percentage
}

interface ProjectionsByCategory {
  lending: ProjectionData[];
  liquidity: ProjectionData[];
}

interface Props {
  projections: ProjectionsByCategory;
  maskValue: (value: string) => string;
  formatPrice: (value: number) => string;
  totalPortfolioValue?: number;
  totalLiquidityValue?: number;
  totalLendingValue?: number;
}

export const ProjectionsChart: React.FC<Props> = ({ 
  projections,
  maskValue,
  formatPrice,
  totalPortfolioValue = 0,
  totalLiquidityValue = 0,
  totalLendingValue = 0
}) => {
  const { theme, chartColors } = useChartTheme();
  const { maskValues } = useMaskValues();
  
  // Helper to format projection type labels
  const formatTypeLabel = (type: string): string => {
    if (!type) return '';
    
    // Handle known types with special formatting
    const lowerType = type.toLowerCase();
    
    if (lowerType === 'aprhistorical') return 'APR Historical';
    if (lowerType === 'apyhistorical') return 'APY Historical';
    if (lowerType === 'apr') return 'APR';
    if (lowerType === 'apy') return 'APY';
    
    // For any other type, add space before capital letters and uppercase
    return type
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(/(?=[A-Z])/)
      .join(' ')
      .toUpperCase();
  };
  
  // Projection types for each category
  const lendingTypes = useMemo(() =>
    projections.lending
      .filter(p => p.type?.toLowerCase() !== 'aprhistorical')
      .map(p => ({ value: p.type, label: formatTypeLabel(p.type) })),
    [projections.lending]
  );

  const liquidityTypes = useMemo(() =>
    projections.liquidity
      .filter(p => p.type?.toLowerCase() !== 'aprhistorical')
      .map(p => ({ value: p.type, label: formatTypeLabel(p.type) })),
    [projections.liquidity]
  );

  const [selectedLendingType, setSelectedLendingType] = useState(
    lendingTypes[0]?.value || 'apy'
  );
  const [selectedLiquidityType, setSelectedLiquidityType] = useState(
    liquidityTypes[0]?.value || 'apr'
  );

  // Get current projection data for each category
  const lendingProjection = useMemo(() => 
    projections.lending.find(p => p.type === selectedLendingType) || projections.lending[0],
    [projections.lending, selectedLendingType]
  );
  
  const liquidityProjection = useMemo(() => 
    projections.liquidity.find(p => p.type === selectedLiquidityType) || projections.liquidity[0],
    [projections.liquidity, selectedLiquidityType]
  );

  // Transform data for line chart
  const chartData = useMemo(() => {
    const periods = [
      { label: '1 Day', days: 1, key: 'oneDay' },
      { label: '1 Week', days: 7, key: 'oneWeek' },
      { label: '1 Month', days: 30, key: 'oneMonth' },
      { label: '1 Year', days: 365, key: 'oneYear' }
    ] as const;
    
    return periods.map((period) => {
      const lendingValue = lendingProjection?.[period.key] || 0;
      const liquidityValue = liquidityProjection?.[period.key] || 0;
      
      return {
        days: period.days,
        label: period.label,
        lending: lendingValue,
        liquidity: liquidityValue,
        total: lendingValue + liquidityValue
      };
    });
  }, [lendingProjection, liquidityProjection]);

  // Calculate average rate for each category (as percentage)
  const lendingAvg = useMemo(() => {
    if (!lendingProjection || lendingProjection.rate == null) return null;
    return lendingProjection.rate;
  }, [lendingProjection]);

  const liquidityAvg = useMemo(() => {
    if (!liquidityProjection || liquidityProjection.rate == null) return null;
    return liquidityProjection.rate;
  }, [liquidityProjection]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    
    // Calculate rate percentages based on period (same as table)
    let liquidityRatePercent = '';
    let lendingRatePercent = '';
    let totalRatePercent = '';
    
    if (liquidityAvg != null) {
      if (data.label === '1 Day') {
        liquidityRatePercent = (liquidityAvg / 365).toFixed(2) + '%';
      } else if (data.label === '1 Week') {
        liquidityRatePercent = (liquidityAvg * 7 / 365).toFixed(2) + '%';
      } else if (data.label === '1 Month') {
        liquidityRatePercent = (liquidityAvg / 12).toFixed(2) + '%';
      } else if (data.label === '1 Year') {
        liquidityRatePercent = liquidityAvg.toFixed(2) + '%';
      }
    }
    
    if (lendingAvg != null) {
      if (data.label === '1 Day') {
        lendingRatePercent = (lendingAvg / 365).toFixed(2) + '%';
      } else if (data.label === '1 Week') {
        lendingRatePercent = (lendingAvg * 7 / 365).toFixed(2) + '%';
      } else if (data.label === '1 Month') {
        lendingRatePercent = (lendingAvg / 12).toFixed(2) + '%';
      } else if (data.label === '1 Year') {
        lendingRatePercent = lendingAvg.toFixed(2) + '%';
      }
    }
    
    // Calculate weighted average rate for total
    const totalValue = totalLiquidityValue + Math.abs(totalLendingValue);
    let portfolioRate = 0;
    
    if (totalValue > 0) {
      if (liquidityAvg != null) {
        portfolioRate += (liquidityAvg * totalLiquidityValue / totalValue);
      }
      if (lendingAvg != null) {
        portfolioRate += (lendingAvg * Math.abs(totalLendingValue) / totalValue);
      }
    }
    
    if (portfolioRate > 0) {
      if (data.label === '1 Day') {
        totalRatePercent = (portfolioRate / 365).toFixed(2) + '%';
      } else if (data.label === '1 Week') {
        totalRatePercent = (portfolioRate * 7 / 365).toFixed(2) + '%';
      } else if (data.label === '1 Month') {
        totalRatePercent = (portfolioRate / 12).toFixed(2) + '%';
      } else if (data.label === '1 Year') {
        totalRatePercent = portfolioRate.toFixed(2) + '%';
      }
    }
    
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
          {data.label}
        </div>
        <div style={{ marginBottom: 4 }}>
          <span style={{ color: chartColors.liquidity, fontSize: 12 }}>Liquidity: </span>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
            {maskValue(formatPrice(data.liquidity))}
          </span>
          {liquidityRatePercent && (
            <span style={{ color: theme.textSecondary, fontSize: 11, marginLeft: 6 }}>
              ({liquidityRatePercent})
            </span>
          )}
        </div>
        <div style={{ marginBottom: 4 }}>
          <span style={{ color: chartColors.lending, fontSize: 12 }}>Lending: </span>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
            {maskValue(formatPrice(data.lending))}
          </span>
          {lendingRatePercent && (
            <span style={{ color: theme.textSecondary, fontSize: 11, marginLeft: 6 }}>
              ({lendingRatePercent})
            </span>
          )}
        </div>
        <div style={{ paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <span style={{ color: (chartColors as any).positive || chartColors.wallet, fontSize: 12 }}>Portfolio: </span>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>
            {maskValue(formatPrice(data.total))}
          </span>
          {totalRatePercent && (
            <span style={{ color: theme.textSecondary, fontSize: 11, marginLeft: 6 }}>
              ({totalRatePercent})
            </span>
          )}
        </div>
      </div>
    );
  };

  if ((projections.lending.length === 0 && projections.liquidity.length === 0) || chartData.length === 0) {
    return (
      <ChartContainer
        title="Projections Timeline"
        subtitle="Projected earnings over time"
      >
        <div style={{
          height: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.textSecondary,
          fontSize: 14
        }}>
          No projection data available
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer
      title="Projections Timeline"
      subtitle="Projected earnings over time"
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart 
          data={chartData}
          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} />
          <XAxis 
            dataKey="days"
            type="number"
            domain={[0, 365]}
            ticks={[1, 7, 30, 365]}
            tickFormatter={(value) => {
              if (value === 1) return '1 Day';
              if (value === 7) return '1 Week';
              if (value === 30) return '1 Month';
              if (value === 365) return '1 Year';
              return value.toString();
            }}
            stroke={chartColors.axis}
            style={{ fontSize: 11 }}
          />
          <YAxis 
            stroke={chartColors.axis}
            style={{ fontSize: 11 }}
            tickFormatter={(value) => maskValues ? '' : `$${(value / 1000).toFixed(1)}K`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: 12 }}
            iconType="line"
          />
          {liquidityProjection && (
            <Line
              type="monotone"
              dataKey="liquidity"
              name="Liquidity Pools"
              stroke={chartColors.liquidity}
              strokeWidth={2.5}
              dot={{ 
                fill: chartColors.liquidity, 
                strokeWidth: 2, 
                r: 4,
                stroke: theme.bgPanel
              }}
              activeDot={{ r: 6 }}
              animationDuration={800}
            />
          )}
          {lendingProjection && (
            <Line
              type="monotone"
              dataKey="lending"
              name="Lending & Borrow"
              stroke={chartColors.lending}
              strokeWidth={2.5}
              dot={{ 
                fill: chartColors.lending, 
                strokeWidth: 2, 
                r: 4,
                stroke: theme.bgPanel
              }}
              activeDot={{ r: 6 }}
              animationDuration={800}
            />
          )}
          <Line
            type="monotone"
            dataKey="total"
            name="Portfolio"
            stroke="#fff"
            strokeWidth={3}
            strokeDasharray="5 5"
            dot={{ 
              fill: '#fff', 
              strokeWidth: 2, 
              r: 5,
              stroke: theme.bgPanel
            }}
            activeDot={{ r: 7 }}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>

      <div style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: `1px solid ${theme.border}`,
        overflowX: 'auto'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(100px, 120px) minmax(100px, 210px) repeat(4, minmax(80px, 1fr))',
          gap: 12,
          marginBottom: 8,
          minWidth: 500
        }}>
          <div style={{ 
            fontSize: 12, 
            color: theme.textSecondary, 
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Projection
          </div>
          <div style={{ 
            textAlign: 'center',
            fontSize: 11,
            color: theme.textSecondary,
            fontWeight: 500
          }}>
            Rate
          </div>
          {chartData.map((item, index) => (
            <div key={index} style={{ 
              textAlign: 'center',
              fontSize: 11,
              color: theme.textSecondary,
              fontWeight: 500
            }}>
              {item.label}
            </div>
          ))}
        </div>

        {liquidityProjection && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(100px, 120px) minmax(100px, 210px) repeat(4, minmax(80px, 1fr))',
            gap: 12,
            marginBottom: 8,
            padding: '8px 0',
            minWidth: 500
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap'
            }}>
              <span style={{ 
                fontSize: 13, 
                color: theme.textPrimary,
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}>
                Liquidity
              </span>
            </div>
            <div style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4
            }}>
              {liquidityTypes.length > 0 && (
                <select
                  value={selectedLiquidityType}
                  onChange={(e) => setSelectedLiquidityType(e.target.value)}
                  style={{
                    background: theme.bgPanel,
                    color: theme.textPrimary,
                    border: `1px solid ${theme.borderStrong || theme.border}`,
                    borderRadius: 4,
                    padding: '4px 6px',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    width: 'fit-content',
                    maxWidth: 200
                  }}
                >
                  {liquidityTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              )}
              {liquidityAvg != null && (
                <span style={{ 
                  fontSize: 11, 
                  color: chartColors.liquidity,
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}>
                  {liquidityAvg.toFixed(2)}%
                </span>
              )}
            </div>
            {chartData.map((item, index) => {
              // Calculate rate fraction based on period
              let ratePercent = '0%';
              if (liquidityAvg != null) {
                if (item.label === '1 Day') {
                  ratePercent = (liquidityAvg / 365).toFixed(2) + '%';
                } else if (item.label === '1 Week') {
                  ratePercent = (liquidityAvg * 7 / 365).toFixed(2) + '%';
                } else if (item.label === '1 Month') {
                  ratePercent = (liquidityAvg / 12).toFixed(2) + '%';
                } else if (item.label === '1 Year') {
                  ratePercent = liquidityAvg.toFixed(2) + '%';
                }
              }
              
              return (
                <div key={index} style={{ 
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: chartColors.liquidity
                  }}>
                    {maskValue(formatPrice(item.liquidity))}
                  </div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: chartColors.liquidity
                  }}>
                    {ratePercent}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {lendingProjection && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(100px, 120px) minmax(100px, 210px) repeat(4, minmax(80px, 1fr))',
            gap: 12,
            marginBottom: 8,
            padding: '8px 0',
            minWidth: 500
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap'
            }}>
              <span style={{ 
                fontSize: 13, 
                color: theme.textPrimary,
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}>
                Lending
              </span>
            </div>
            <div style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4
            }}>
              {lendingTypes.length > 0 && (
                <select
                  value={selectedLendingType}
                  onChange={(e) => setSelectedLendingType(e.target.value)}
                  style={{
                    background: theme.bgPanel,
                    color: theme.textPrimary,
                    border: `1px solid ${theme.borderStrong || theme.border}`,
                    borderRadius: 4,
                    padding: '4px 6px',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    width: 'fit-content',
                    maxWidth: 200
                  }}
                >
                  {lendingTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              )}
              {lendingAvg != null && (
                <span style={{ 
                  fontSize: 11, 
                  color: chartColors.lending,
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}>
                  {lendingAvg.toFixed(2)}%
                </span>
              )}
            </div>
            {chartData.map((item, index) => {
              // Calculate rate fraction based on period
              let ratePercent = '0%';
              if (lendingAvg != null) {
                if (item.label === '1 Day') {
                  ratePercent = (lendingAvg / 365).toFixed(2) + '%';
                } else if (item.label === '1 Week') {
                  ratePercent = (lendingAvg * 7 / 365).toFixed(2) + '%';
                } else if (item.label === '1 Month') {
                  ratePercent = (lendingAvg / 12).toFixed(2) + '%';
                } else if (item.label === '1 Year') {
                  ratePercent = lendingAvg.toFixed(2) + '%';
                }
              }
              
              return (
                <div key={index} style={{ 
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: chartColors.lending
                  }}>
                    {maskValue(formatPrice(item.lending))}
                  </div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: chartColors.lending
                  }}>
                    {ratePercent}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(100px, 120px) minmax(100px, 210px) repeat(4, minmax(80px, 1fr))',
          gap: 12,
          paddingTop: 12,
          borderTop: `1px solid ${theme.border}`,
          minWidth: 500
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span style={{ 
              fontSize: 13, 
              color: theme.textPrimary,
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}>
              Portfolio
            </span>
          </div>
          <div></div>
          {chartData.map((item, index) => {
            // Calculate combined rate for portfolio (weighted by total values of each segment)
            const totalValue = totalLiquidityValue + Math.abs(totalLendingValue);
            let portfolioRate = 0;
            
            if (totalValue > 0) {
              if (liquidityAvg != null) {
                portfolioRate += (liquidityAvg * totalLiquidityValue / totalValue);
              }
              if (lendingAvg != null) {
                portfolioRate += (lendingAvg * Math.abs(totalLendingValue) / totalValue);
              }
            }
            
            // Calculate rate fraction based on period
            let ratePercent = '0%';
            if (portfolioRate > 0) {
              if (item.label === '1 Day') {
                ratePercent = (portfolioRate / 365).toFixed(2) + '%';
              } else if (item.label === '1 Week') {
                ratePercent = (portfolioRate * 7 / 365).toFixed(2) + '%';
              } else if (item.label === '1 Month') {
                ratePercent = (portfolioRate / 12).toFixed(2) + '%';
              } else if (item.label === '1 Year') {
                ratePercent = portfolioRate.toFixed(2) + '%';
              }
            }
            
            return (
              <div key={index} style={{ 
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <div style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: (chartColors as any).positive || chartColors.wallet
                }}>
                  {maskValue(formatPrice(item.total))}
                </div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: (chartColors as any).positive || chartColors.wallet
                }}>
                  {ratePercent}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ChartContainer>
  );
};
