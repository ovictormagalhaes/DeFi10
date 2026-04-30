import React, { useState } from 'react';
import type { HealthFactorStatus, HealthFactorTargetConfig } from '../../../types/strategy';
import MaskedValue from '../shared/MaskedValue';
import s from './StrategyCard.module.css';

interface Props {
  statuses: HealthFactorStatus[];
  config?: HealthFactorTargetConfig;
  onAddCollateral?: (action: any) => void;
  onRepayDebt?: (action: any) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const HealthFactorCard: React.FC<Props> = ({ statuses, config, onEdit, onDelete }) => {
  const [collapsed, setCollapsed] = useState(false);

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);

  const criticalCount = statuses.filter(
    (s) => s.status === 'danger' || s.status === 'critical'
  ).length;
  const warnCount = statuses.filter((s) => s.status === 'warning').length;

  const dotColor =
    criticalCount > 0 ? 'var(--v2-red)' : warnCount > 0 ? 'var(--v2-yellow)' : 'var(--v2-green)';
  const statColor =
    criticalCount > 0 ? 'var(--v2-red)' : warnCount > 0 ? 'var(--v2-yellow)' : 'var(--v2-green)';
  const statText =
    criticalCount > 0
      ? `${criticalCount} critical`
      : warnCount > 0
        ? `${warnCount} warning`
        : 'All safe';

  const hfColor = (st: HealthFactorStatus['status']) =>
    st === 'danger' || st === 'critical' ? s.hfDanger : st === 'warning' ? s.hfWarn : s.hfSafe;

  const hfBarColor = (st: HealthFactorStatus['status']) =>
    st === 'danger' || st === 'critical'
      ? 'var(--v2-red)'
      : st === 'warning'
        ? 'var(--v2-yellow)'
        : 'var(--v2-green)';

  const chipClass = (st: HealthFactorStatus['status']) =>
    st === 'danger' || st === 'critical'
      ? s.chipDanger
      : st === 'warning'
        ? s.chipWarn
        : s.chipSafe;

  const chipLabel = (st: HealthFactorStatus['status']) =>
    st === 'danger'
      ? 'Danger'
      : st === 'critical'
        ? 'Critical'
        : st === 'warning'
          ? 'Warning'
          : 'Safe';

  return (
    <div className={s.card}>
      <div className={s.header} onClick={() => setCollapsed((v) => !v)}>
        <div className={s.dot} style={{ background: dotColor }} />
        <div className={s.headerMeta}>
          <div className={s.name}>Health Factor Monitor</div>
          <div className={s.sub}>
            {statuses.length} position{statuses.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className={s.stat}>
          <div className={s.statVal} style={{ color: statColor }}>
            {statText}
          </div>
          <div className={s.statLbl}>Status</div>
        </div>
        <div className={s.actions} onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <button className={s.iconBtn} onClick={onEdit} title="Edit">
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M11 2.5l2.5 2.5L5 13.5H2.5V11L11 2.5z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button className={`${s.iconBtn} ${s.iconBtnDanger}`} onClick={onDelete} title="Delete">
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M3 4h10M6 4V2h4v2M5 4l.5 9h5l.5-9" />
              </svg>
            </button>
          )}
        </div>
        <svg
          className={`${s.chevron} ${!collapsed ? s.chevronOpen : ''}`}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
        >
          <path
            d="M3 5l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {!collapsed && statuses.length > 0 && (
        <div className={s.body}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th className={s.tl}>Protocol</th>
                  <th className={s.tl}>Chain</th>
                  <th className={s.tc}>Current HF</th>
                  <th className={s.tc}>Target HF</th>
                  <th className={s.tc}>Critical</th>
                  <th className={s.tc}>Delta</th>
                  <th className={s.tr}>Collateral</th>
                  <th className={s.tr}>Debt</th>
                  <th className={s.tc}>Status</th>
                </tr>
              </thead>
              <tbody>
                {statuses.map((st, i) => {
                  const delta = st.current - st.target;
                  const maxHF = Math.max(st.current, st.target, st.criticalThreshold || 1.5) * 1.2;
                  const barPct = Math.min((st.current / maxHF) * 100, 100);
                  const criticalPct = ((st.criticalThreshold || 1.5) / maxHF) * 100;
                  const targetPct = (st.target / maxHF) * 100;

                  return (
                    <tr key={i}>
                      <td className={s.tl}>
                        <div className={s.cellWithLogo}>
                          {st.protocolLogo && (
                            <img
                              src={st.protocolLogo}
                              alt={st.protocolName}
                              className={s.tokenImg}
                              onError={(e) =>
                                ((e.target as HTMLImageElement).style.display = 'none')
                              }
                            />
                          )}
                          <span className={s.bold}>{st.protocolName}</span>
                        </div>
                      </td>
                      <td className={s.tl}>
                        <div className={s.cellWithLogo}>
                          {st.chainLogo && (
                            <img
                              src={st.chainLogo}
                              alt={st.chain}
                              className={s.tokenImg}
                              onError={(e) =>
                                ((e.target as HTMLImageElement).style.display = 'none')
                              }
                            />
                          )}
                          <span>
                            {st.chain ? st.chain.charAt(0).toUpperCase() + st.chain.slice(1) : ''}
                          </span>
                        </div>
                      </td>
                      <td className={s.tc}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <div className={s.hfBarTrack}>
                            <div
                              className={s.hfBarFill}
                              style={{ width: `${barPct}%`, background: hfBarColor(st.status) }}
                            />
                            <div
                              className={s.hfMarker}
                              style={{
                                left: `${criticalPct}%`,
                                background: 'var(--v2-red)',
                                opacity: 0.8,
                              }}
                            />
                            <div
                              className={s.hfMarker}
                              style={{
                                left: `${targetPct}%`,
                                background: 'var(--v2-yellow)',
                                opacity: 0.8,
                              }}
                            />
                          </div>
                          <span className={`${s.hfVal} ${hfColor(st.status)}`}>
                            {st.current.toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td className={s.tc} style={{ color: 'var(--v2-muted)' }}>
                        {st.target.toFixed(2)}
                      </td>
                      <td className={s.tc} style={{ color: 'var(--v2-red)' }}>
                        {(st.criticalThreshold || 1.5).toFixed(2)}
                      </td>
                      <td className={s.tc}>
                        <span className={delta >= 0 ? s.deltaPos : s.deltaNeg}>
                          {delta >= 0 ? '+' : ''}
                          {delta.toFixed(2)}
                        </span>
                      </td>
                      <td className={s.tr} style={{ color: 'var(--v2-green)' }}>
                        <MaskedValue value={fmt(st.collateralValue)} />
                      </td>
                      <td className={s.tr} style={{ color: 'var(--v2-red)' }}>
                        <MaskedValue value={fmt(st.debtValue)} />
                      </td>
                      <td className={s.tc}>
                        <span className={`${s.chip} ${chipClass(st.status)}`}>
                          {chipLabel(st.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={s.legend}>
            <span>
              <span className={s.legendDot} style={{ background: 'var(--v2-yellow)' }} />
              Target HF (per position)
            </span>
            <span>
              <span className={s.legendDot} style={{ background: 'var(--v2-red)' }} />
              Critical threshold (per position)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthFactorCard;
