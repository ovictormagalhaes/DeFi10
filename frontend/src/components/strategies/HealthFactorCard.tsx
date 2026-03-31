/**
 * Health Factor Card
 * Displays health factor status in table format (similar to AllocationStrategyCard)
 */

import React, { useState } from 'react';

import { useMaskValues } from '../../context/MaskValuesContext';
import { useTheme } from '../../context/ThemeProvider';
import type { HealthFactorStatus, HealthFactorTargetConfig } from '../../types/strategy';
import './strategies.css';

interface HealthFactorCardProps {
  statuses: HealthFactorStatus[]; // Changed from single status to array
  config?: HealthFactorTargetConfig; // Strategy configuration
  onAddCollateral?: (action: any) => void;
  onRepayDebt?: (action: any) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const HealthFactorCard: React.FC<HealthFactorCardProps> = ({
  statuses,
  config,
  onAddCollateral,
  onRepayDebt,
  onEdit,
  onDelete,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const { maskValue } = useMaskValues();
  const { theme } = useTheme();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatValue = (value: number) => {
    return maskValue(formatCurrency(value));
  };

  const getStatusClassName = (status: HealthFactorStatus['status']) => {
    switch (status) {
      case 'danger':
        return 'strategy-hf-value--danger';
      case 'critical':
        return 'strategy-hf-value--critical';
      case 'warning':
        return 'strategy-hf-value--warning';
      case 'safe':
        return 'strategy-hf-value--safe';
      default:
        return '';
    }
  };

  const getStatusIcon = (status: HealthFactorStatus['status']) => {
    switch (status) {
      case 'danger':
        return '🚨';
      case 'critical':
        return '🔴';
      case 'warning':
        return '⚠️';
      case 'safe':
        return '✅';
      default:
        return '•';
    }
  };

  const getStatusText = (status: HealthFactorStatus['status']) => {
    switch (status) {
      case 'danger':
        return 'Danger';
      case 'critical':
        return 'Critical';
      case 'warning':
        return 'Warning';
      case 'safe':
        return 'Safe';
      default:
        return 'Unknown';
    }
  };

  const needsAction = statuses.some((s) => s.needsAction);
  const criticalCount = statuses.filter(
    (s) => s.status === 'danger' || s.status === 'critical'
  ).length;

  // Calculate average target HF from statuses
  const avgTargetHF =
    statuses.length > 0
      ? (statuses.reduce((sum, s) => sum + s.target, 0) / statuses.length).toFixed(2)
      : '0.00';

  // Get critical threshold from config, or use default 1.50
  const criticalThreshold = config?.criticalThreshold?.toFixed(2) || '1.50';

  return (
    <div className="strategy-card">
      {/* Header */}
      <div
        className="strategy-card__header"
        onClick={() => setCollapsed(!collapsed)}
        style={{ cursor: 'pointer' }}
      >
        <div className="strategy-card__title-section">
          <div className="strategy-card__title-row">
            <h3 className="strategy-card__title">Health Factor Monitor</h3>
            {criticalCount > 0 && (
              <span className="strategy-badge strategy-badge--warning">⚠️ Action Needed</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="strategy-card__actions" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <button onClick={onEdit} className="btn-base btn-primary">
                Edit
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} className="btn-base btn-danger">
                Delete
              </button>
            )}
          </div>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 0.2s',
              color: 'var(--app-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Stats */}
          <div className="strategy-card__stats">
            <div className="strategy-card__stat">
              <div className="strategy-card__stat-label">Positions</div>
              <div className="strategy-card__stat-value">{statuses.length}</div>
            </div>
            <div className="strategy-card__stat">
              <div className="strategy-card__stat-label">Avg Target HF</div>
              <div className="strategy-card__stat-value strategy-card__stat-value--accent">
                {avgTargetHF}
              </div>
            </div>
            <div className="strategy-card__stat">
              <div className="strategy-card__stat-label">Critical Threshold</div>
              <div className="strategy-card__stat-value strategy-card__stat-value--critical">
                {criticalThreshold}
              </div>
            </div>
          </div>

          {/* Positions Table */}
          <div className="strategy-table-container">
            <table className="strategy-table">
              <thead>
                <tr>
                  <th className="text-left">Protocol</th>
                  <th className="text-left">Chain</th>
                  <th className="text-center">Current HF</th>
                  <th className="text-center">Target HF</th>
                  <th className="text-center">Critical</th>
                  <th className="text-center">Delta</th>
                  <th className="text-center">Lend</th>
                  <th className="text-center">Borrow</th>
                  <th className="text-center">Net</th>
                  <th className="text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {statuses.map((status, index) => {
                  const delta = status.current - status.target;
                  const deltaPercent = ((status.current / status.target - 1) * 100).toFixed(1);
                  const isDeltaNegative = delta < 0;
                  const netPosition = status.collateralValue - status.debtValue;

                  return (
                    <tr key={index}>
                      <td>
                        <div className="strategy-cell-with-logo strategy-cell-with-logo--left">
                          {status.protocolLogo && (
                            <img src={status.protocolLogo} alt={status.protocolName} />
                          )}
                          <span className="strategy-cell__text">{status.protocolName}</span>
                        </div>
                      </td>
                      <td>
                        <div className="strategy-cell-with-logo strategy-cell-with-logo--left">
                          {status.chainLogo && <img src={status.chainLogo} alt={status.chain} />}
                          <span className="strategy-cell__text">{status.chain}</span>
                        </div>
                      </td>
                      <td className="text-center">
                        <span className={`strategy-hf-value ${getStatusClassName(status.status)}`}>
                          {status.current.toFixed(2)}
                        </span>
                      </td>
                      <td className="text-center">{status.target.toFixed(2)}</td>
                      <td className="text-center">
                        <span className="strategy-hf-value strategy-hf-value--danger">
                          {status.criticalThreshold?.toFixed(2) || '1.50'}
                        </span>
                      </td>
                      <td className="text-center">
                        <span
                          className={
                            isDeltaNegative
                              ? 'strategy-delta--negative'
                              : 'strategy-delta--positive'
                          }
                        >
                          {delta > 0 ? '+' : ''}
                          {delta.toFixed(2)} ({deltaPercent}%)
                        </span>
                      </td>
                      <td className="text-center">
                        <span style={{ color: theme.success, fontWeight: 600 }}>
                          {formatValue(status.collateralValue)}
                        </span>
                      </td>
                      <td className="text-center">
                        <span style={{ color: theme.error, fontWeight: 600 }}>
                          {formatValue(status.debtValue)}
                        </span>
                      </td>
                      <td className="text-center">
                        <span style={{ color: theme.success, fontWeight: 600 }}>
                          {formatValue(netPosition)}
                        </span>
                      </td>
                      <td>
                        <div className="strategy-cell-with-logo strategy-cell-with-logo--left">
                          <span>{getStatusIcon(status.status)}</span>
                          <span
                            className={`strategy-hf-value ${getStatusClassName(status.status)}`}
                          >
                            {getStatusText(status.status)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
