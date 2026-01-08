// src/components/charts/ProjectionsChart.tsx
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { useChartTheme } from './hooks/useChartTheme';

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
}

export const ProjectionsChart: React.FC<Props> = ({ 
  projections,
  maskValue,
  formatPrice,
  totalPortfolioValue = 0
}) => {
  const { theme, chartColors } = useChartTheme();
  
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
    projections.lending.map(p => ({ value: p.type, label: formatTypeLabel(p.type) })),
    [projections.lending]
  );
  
  const liquidityTypes = useMemo(() => 
    projections.liquidity.map(p => ({ value: p.type, label: formatTypeLabel(p.type) })),
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
        </div>
        <div style={{ marginBottom: 4 }}>
          <span style={{ color: chartColors.lending, fontSize: 12 }}>Lending: </span>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
            {maskValue(formatPrice(data.lending))}
          </span>
        </div>
        <div style={{ paddingTop: 6, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <span style={{ color: chartColors.positive, fontSize: 12 }}>Total: </span>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>
            {maskValue(formatPrice(data.total))}
          </span>
        </div>
      </div>
    );
  };

  // Type selectors for each category
  const TypeSelectors = () => {
    const selectStyle = {
      background: theme.bgPanel,
      color: theme.textPrimary,
      border: `1px solid ${theme.borderStrong || theme.border}`,
      borderRadius: 6,
      padding: '8px 12px',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    } as React.CSSProperties;

    const selectHoverStyle = {
      borderColor: chartColors.liquidity
    };

    return (
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: '8px 12px',
        alignItems: 'center',
        width: '100%'
      }}>
        {liquidityTypes.length > 0 && (
          <>
            <span style={{ fontSize: 11, color: theme.textSecondary, fontWeight: 500, whiteSpace: 'nowrap' }}>Liquidity:</span>
            <select
              value={selectedLiquidityType}
              onChange={(e) => setSelectedLiquidityType(e.target.value)}
              style={selectStyle}
            >
              {liquidityTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {liquidityAvg != null && (
              <span style={{ fontSize: 13, fontWeight: 700, color: chartColors.liquidity }}>
                {liquidityAvg.toFixed(2)}%
              </span>
            )}
          </>
        )}
        {lendingTypes.length > 0 && (
          <>
            <span style={{ fontSize: 11, color: theme.textSecondary, fontWeight: 500, whiteSpace: 'nowrap' }}>Lending:</span>
            <select
              value={selectedLendingType}
              onChange={(e) => setSelectedLendingType(e.target.value)}
              style={selectStyle}
            >
              {lendingTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {lendingAvg != null && (
              <span style={{ fontSize: 13, fontWeight: 700, color: chartColors.lending }}>
                {lendingAvg.toFixed(2)}%
              </span>
            )}
          </>
        )}
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
            tickFormatter={(value) => `$${(value / 1000).toFixed(1)}K`}
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
            name="Total"
            stroke={chartColors.positive}
            strokeWidth={3}
            strokeDasharray="5 5"
            dot={{ 
              fill: chartColors.positive, 
              strokeWidth: 2, 
              r: 5,
              stroke: theme.bgPanel
            }}
            activeDot={{ r: 7 }}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary stats - Reorganized layout */}
      <div style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: `1px solid ${theme.border}`,
        overflowX: 'auto'
      }}>
        {/* Header row with label "Projection" and period columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(100px, 120px) repeat(4, minmax(80px, 1fr))',
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

        {/* Liquidity row */}
        {liquidityProjection && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(100px, 120px) repeat(4, minmax(80px, 1fr))',
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
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    minWidth: 90,
                    maxWidth: 120
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
            {chartData.map((item, index) => (
              <div key={index} style={{ 
                textAlign: 'center',
                fontSize: 13,
                color: chartColors.liquidity,
                fontWeight: 600
              }}>
                {maskValue(formatPrice(item.liquidity))}
              </div>
            ))}
          </div>
        )}

        {/* Lending row */}
        {lendingProjection && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(100px, 120px) repeat(4, minmax(80px, 1fr))',
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
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                    minWidth: 90,
                    maxWidth: 120
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
            {chartData.map((item, index) => (
              <div key={index} style={{ 
                textAlign: 'center',
                fontSize: 13,
                color: chartColors.lending,
                fontWeight: 600
              }}>
                {maskValue(formatPrice(item.lending))}
              </div>
            ))}
          </div>
        )}

        {/* Portfolio total row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(100px, 120px) repeat(4, minmax(80px, 1fr))',
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
              Portfólio
            </span>
          </div>
          {chartData.map((item, index) => {
            const percentOfPortfolio = totalPortfolioValue && totalPortfolioValue > 0 
              ? ((item.total / totalPortfolioValue) * 100).toFixed(1) + '%'
              : '0%';
            
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
                  color: chartColors.positive
                }}>
                  {maskValue(formatPrice(item.total))}
                </div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: chartColors.positive,
                  opacity: 0.7
                }}>
                  {percentOfPortfolio}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ChartContainer>
  );
};
