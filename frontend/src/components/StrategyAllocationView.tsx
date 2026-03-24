/**
 * StrategyAllocationView Component
 * Display strategy allocations vs current reality with rebalance suggestions
 */

import React, { useMemo } from 'react';
import type { Strategy, AllocationDelta } from '../types/strategy';
import type { WalletItem } from '../types/wallet';
import { calculateAllocationDeltas, getAllocationSummary, suggestRebalanceActions } from '../utils/allocationCalculations';
import { useTheme } from '../context/ThemeProvider';
import { useMaskValues } from '../context/MaskValuesContext';

interface StrategyAllocationViewProps {
  strategy: Strategy;
  portfolio: WalletItem[];
  onRebalance?: (delta: AllocationDelta) => void;
}

export const StrategyAllocationView: React.FC<StrategyAllocationViewProps> = ({
  strategy,
  portfolio,
  onRebalance
}) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  // Calculate deltas
  const deltas = useMemo(() => 
    calculateAllocationDeltas(strategy, portfolio),
    [strategy, portfolio]
  );

  // Get summary
  const summary = useMemo(() => 
    getAllocationSummary(deltas),
    [deltas]
  );

  // Get rebalance suggestions
  const rebalanceActions = useMemo(() => 
    suggestRebalanceActions(deltas),
    [deltas]
  );

  const needsRebalance = summary.assetsNeedingRebalance > 0;

  // Format currency
  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage
  const formatPercent = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // Get color class for delta
  const getDeltaColorClass = (delta: number) => {
    if (Math.abs(delta) < 1) return 'delta-neutral';
    return delta > 0 ? 'delta-positive' : 'delta-negative';
  };

  return (
    <div className="strategy-allocation-view">
      {/* Header */}
      <div className="strategy-header">
        <div className="strategy-title">
          <h2>{strategy.name || 'Asset Allocation Strategy'}</h2>
          {strategy.description && (
            <p className="strategy-description">{strategy.description}</p>
          )}
        </div>
        {needsRebalance && (
          <span className="badge badge-warning">
            Rebalance Needed ({summary.assetsNeedingRebalance} {summary.assetsNeedingRebalance === 1 ? 'asset' : 'assets'})
          </span>
        )}
      </div>

      {/* Summary Stats */}
      <div className="allocation-summary">
        <div className="summary-card">
          <div className="summary-label">Total Assets</div>
          <div className="summary-value">{summary.totalAssets}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Max Deviation</div>
          <div className="summary-value">{maskValue(`${summary.maxDeltaWeight.toFixed(2)}%`)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Delta</div>
          <div className="summary-value">{maskValue(formatUSD(summary.totalDeltaValueUsd))}</div>
        </div>
      </div>

      {/* Allocation Table */}
      <div className="allocation-table-container">
        <table className="allocation-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Group</th>
              <th className="text-right">Target</th>
              <th className="text-right">Current</th>
              <th className="text-right">Delta</th>
              <th className="text-right">Target Value</th>
              <th className="text-right">Current Value</th>
              <th className="text-right">Delta Value</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {deltas.map((delta, index) => {
              const action = rebalanceActions[index];
              
              // Find logo from strategy items
              const item = (strategy as any).items?.find((it: any) =>
                it.metadata?.symbol === delta.assetKey || it.assets[0]?.key === delta.assetKey
              );
              const logo = item?.metadata?.tokens?.[0]?.logo;
              
              return (
                <tr 
                  key={`${delta.group}-${delta.assetKey}`}
                >
                  <td>
                    <div className="asset-cell">
                      {logo && <img src={logo} alt={delta.assetKey} className="asset-logo" />}
                      <span className="asset-key">{delta.assetKey}</span>
                    </div>
                  </td>
                  <td>
                    <span className="group-badge">{delta.group}</span>
                  </td>
                  <td className="text-right">
                    {maskValue(`${delta.targetWeight.toFixed(2)}%`)}
                  </td>
                  <td className="text-right">
                    {maskValue(`${delta.currentWeight.toFixed(2)}%`)}
                  </td>
                  <td className={`text-right ${getDeltaColorClass(delta.deltaWeight)}`}>
                    {maskValue(formatPercent(delta.deltaWeight))}
                  </td>
                  <td className="text-right">
                    {maskValue(formatUSD(delta.targetValueUsd))}
                  </td>
                  <td className="text-right">
                    {maskValue(formatUSD(delta.currentValueUsd))}
                  </td>
                  <td className={`text-right ${getDeltaColorClass(delta.deltaValueUsd)}`}>
                    {maskValue(formatUSD(delta.deltaValueUsd))}
                  </td>
                  <td className="text-center">
                    {delta.needsRebalance ? (
                      <button
                        className={`action-button action-${action.action}`}
                        onClick={() => onRebalance?.(delta)}
                        title={`${action.action.toUpperCase()} ${maskValue(formatUSD(action.amountUsd))}`}
                      >
                        {action.action === 'buy' ? '↑ Buy' : '↓ Sell'}
                      </button>
                    ) : (
                      <span className="action-hold">✓ Hold</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Styling */}
      <style>{`
        .strategy-allocation-view {
          padding: 24px;
          background: var(--color-background);
          border-radius: 8px;
          border: 1px solid var(--color-border);
        }

        .strategy-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .strategy-title h2 {
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .strategy-description {
          margin: 0;
          color: var(--color-text-secondary);
          font-size: 14px;
        }

        .badge {
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge-warning {
          background: var(--color-warning-bg, #fff3cd);
          color: var(--color-warning-text, #856404);
          border: 1px solid var(--color-warning-border, #ffeaa7);
        }

        .allocation-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .summary-card {
          padding: 16px;
          background: var(--color-surface);
          border-radius: 6px;
          border: 1px solid var(--color-border);
        }

        .summary-label {
          font-size: 12px;
          color: var(--color-text-secondary);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .summary-value {
          font-size: 24px;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .allocation-table-container {
          overflow-x: auto;
          background: ${theme.bgPanel};
          border-radius: 8px;
        }

        .allocation-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          background: ${theme.bgPanel};
        }

        .allocation-table th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
          color: ${theme.textSecondary};
          border-bottom: 1px solid ${theme.border};
          background: ${theme.bgPanel};
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .allocation-table td {
          padding: 14px 16px;
          border-bottom: 2px solid ${theme.border};
          color: ${theme.textPrimary};
          background: ${theme.bgPanel};
        }

        .allocation-table tbody tr:hover {
          background: ${theme.bgSecondary};
        }

        .allocation-table tbody tr:last-child td {
          border-bottom: none;
        }

        .allocation-table tbody tr {
          border-bottom: 1px solid ${theme.border};
        }

        .text-right {
          text-align: right;
          font-variant-numeric: tabular-nums;
          font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace;
        }

        .text-center {
          text-align: center;
        }

        .asset-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .asset-logo {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          object-fit: cover;
          background-color: ${theme.bgSecondary};
        }

        .asset-key {
          font-weight: 500;
          font-size: 13px;
          color: ${theme.textPrimary};
        }

        .group-badge {
          display: inline-block;
          padding: 4px 10px;
          background: ${theme.bgSecondary};
          border: 1px solid ${theme.border};
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          color: ${theme.textSecondary};
        }

        .delta-positive {
          color: #10b981;
          font-weight: 600;
        }

        .delta-negative {
          color: #ef4444;
          font-weight: 600;
        }

        .delta-neutral {
          color: ${theme.textSecondary};
          font-weight: 500;
        }

        .action-button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-buy {
          background: var(--color-success-bg, #d4edda);
          color: var(--color-success, #155724);
        }

        .action-buy:hover {
          background: var(--color-success, #28a745);
          color: white;
        }

        .action-sell {
          background: var(--color-danger-bg, #f8d7da);
          color: var(--color-danger, #721c24);
        }

        .action-sell:hover {
          background: var(--color-danger, #dc3545);
          color: white;
        }

        .action-hold {
          color: var(--color-text-secondary);
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default StrategyAllocationView;
