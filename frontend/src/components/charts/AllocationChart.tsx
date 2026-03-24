/**
 * AllocationChart Component
 * Visual comparison of target vs current allocation using bar charts
 */

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import type { AllocationDelta } from '../../types/strategy';

interface AllocationChartProps {
  deltas: AllocationDelta[];
  height?: number;
  showDelta?: boolean;
}

export const AllocationChart: React.FC<AllocationChartProps> = ({
  deltas,
  height = 400,
  showDelta = false
}) => {
  // Prepare chart data
  const chartData = useMemo(() => {
    return deltas.map(d => ({
      name: d.assetKey,
      group: d.group,
      target: d.targetWeight,
      current: d.currentWeight,
      delta: d.deltaWeight,
      needsRebalance: d.needsRebalance
    }));
  }, [deltas]);

  // Colors
  const targetColor = '#8884d8';
  const currentColor = '#82ca9d';
  const deltaPositiveColor = '#28a745';
  const deltaNegativeColor = '#dc3545';
  const rebalanceHighlight = '#ffc107';

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) {
      return null;
    }

    const data = payload[0].payload;

    return (
      <div className="allocation-chart-tooltip">
        <div className="tooltip-header">
          <strong>{data.name}</strong>
          <span className="tooltip-group">{data.group}</span>
        </div>
        <div className="tooltip-content">
          <div className="tooltip-row">
            <span className="tooltip-label" style={{ color: targetColor }}>Target:</span>
            <span className="tooltip-value">{data.target.toFixed(2)}%</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label" style={{ color: currentColor }}>Current:</span>
            <span className="tooltip-value">{data.current.toFixed(2)}%</span>
          </div>
          <div className="tooltip-row">
            <span className="tooltip-label">Delta:</span>
            <span 
              className="tooltip-value"
              style={{ 
                color: data.delta > 0 ? deltaPositiveColor : deltaNegativeColor,
                fontWeight: 'bold'
              }}
            >
              {data.delta > 0 ? '+' : ''}{data.delta.toFixed(2)}%
            </span>
          </div>
          {data.needsRebalance && (
            <div className="tooltip-warning">
              ⚠️ Rebalance needed
            </div>
          )}
        </div>
        <style>{`
          .allocation-chart-tooltip {
            background: white;
            border: 1px solid #ccc;
            border-radius: 6px;
            padding: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          }

          .tooltip-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid #eee;
          }

          .tooltip-group {
            font-size: 11px;
            padding: 2px 6px;
            background: #f0f0f0;
            border-radius: 3px;
            color: #666;
          }

          .tooltip-content {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .tooltip-row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            font-size: 13px;
          }

          .tooltip-label {
            font-weight: 500;
          }

          .tooltip-value {
            font-weight: 600;
          }

          .tooltip-warning {
            margin-top: 8px;
            padding: 6px 8px;
            background: #fff3cd;
            border-radius: 4px;
            font-size: 11px;
            color: #856404;
            text-align: center;
          }
        `}</style>
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <div className="allocation-chart-empty">
        <p>No allocation data available</p>
        <style>{`
          .allocation-chart-empty {
            display: flex;
            align-items: center;
            justify-content: center;
            height: ${height}px;
            color: var(--color-text-secondary);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="allocation-chart-container">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            label={{ value: 'Weight (%)', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="square"
          />
          
          {!showDelta ? (
            <>
              <Bar 
                dataKey="target" 
                fill={targetColor} 
                name="Target %" 
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-target-${index}`}
                    fill={entry.needsRebalance ? rebalanceHighlight : targetColor}
                    opacity={entry.needsRebalance ? 0.8 : 1}
                  />
                ))}
              </Bar>
              <Bar 
                dataKey="current" 
                fill={currentColor} 
                name="Current %" 
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-current-${index}`}
                    fill={entry.needsRebalance ? rebalanceHighlight : currentColor}
                    opacity={entry.needsRebalance ? 0.8 : 1}
                  />
                ))}
              </Bar>
            </>
          ) : (
            <Bar 
              dataKey="delta" 
              name="Delta %" 
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-delta-${index}`}
                  fill={entry.delta > 0 ? deltaPositiveColor : deltaNegativeColor}
                />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>

      <style>{`
        .allocation-chart-container {
          width: 100%;
          padding: 16px;
          background: var(--color-background);
          border-radius: 8px;
          border: 1px solid var(--color-border);
        }
      `}</style>
    </div>
  );
};

export default AllocationChart;
