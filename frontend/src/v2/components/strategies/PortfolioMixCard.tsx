import React, { useMemo, useState } from 'react';
import type { AllocationStrategy } from '../../../types/strategy';
import type { WalletItem } from '../../../types/wallet';
import MaskedValue from '../shared/MaskedValue';
import s from './StrategyCard.module.css';

const SEGMENT_META: Record<number, { label: string; color: string }> = {
  11: { label: 'Lending Net', color: '#8b5cf6' },
  21: { label: 'Liquidity Pool', color: '#f59e0b' },
  31: { label: 'Staking', color: '#14b8a6' },
  41: { label: 'Wallet', color: '#3b82f6' },
};

function computeSegmentValues(portfolio: WalletItem[]) {
  let supplyUsd = 0;
  let borrowUsd = 0;
  let lpUsd = 0;
  let stakingUsd = 0;
  let walletUsd = 0;

  for (const item of portfolio) {
    const tokens = (item.position?.tokens || []) as any[];
    if (item.type === 'LendingAndBorrowing') {
      for (const t of tokens) {
        const tt = (t.type || '').toString().toLowerCase();
        const val = Math.abs(t.financials?.totalPrice || 0);
        if (tt === 'borrowed' || tt === 'borrow') borrowUsd += val;
        else supplyUsd += val;
      }
    } else if (item.type === 'LiquidityPool') {
      for (const t of tokens) {
        if ((t.type || '').toString().toLowerCase() === 'liquidityuncollectedfee') continue;
        lpUsd += Math.abs(t.financials?.totalPrice || 0);
      }
    } else if (item.type === 'Staking' || item.type === 'Locking' || item.type === 'Depositing') {
      for (const t of tokens) {
        stakingUsd += Math.abs(t.financials?.totalPrice || 0);
      }
    } else if (item.type === 'Wallet') {
      for (const t of tokens) {
        walletUsd += Math.abs(t.financials?.totalPrice || 0);
      }
    }
  }

  const lendingNet = supplyUsd - borrowUsd;
  const total = Math.max(0, lendingNet) + lpUsd + stakingUsd + walletUsd;

  return { lending_net: lendingNet, lp: lpUsd, staking: stakingUsd, wallet: walletUsd, total };
}

const SEGMENT_KEYS: Record<number, keyof ReturnType<typeof computeSegmentValues>> = {
  11: 'lending_net',
  21: 'lp',
  31: 'staking',
  41: 'wallet',
};

interface Props {
  strategy: AllocationStrategy;
  portfolio: WalletItem[];
  onEdit?: () => void;
  onDelete: () => void;
}

export const PortfolioMixCard: React.FC<Props> = ({ strategy, portfolio, onEdit, onDelete }) => {
  const [collapsed, setCollapsed] = useState(false);

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  const { rows, maxDeviation, actionCount, totalValue } = useMemo(() => {
    const segValues = computeSegmentValues(portfolio);
    const allocations = [...(strategy.allocations || [])].sort(
      (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999)
    );

    let maxDeviation = 0;
    let actionCount = 0;

    const rows = allocations.map((alloc) => {
      const key = SEGMENT_KEYS[alloc.groupType];
      const rawVal = key ? segValues[key] : 0;
      const currentValue = typeof rawVal === 'number' ? rawVal : 0;
      const currentWeight =
        segValues.total > 0 ? (Math.max(0, currentValue) / segValues.total) * 100 : 0;
      const deltaWeight = alloc.targetWeight - currentWeight;
      const deviation = Math.abs(deltaWeight);
      if (deviation > maxDeviation) maxDeviation = deviation;
      if (deviation > 2) actionCount++;

      const meta = SEGMENT_META[alloc.groupType] ?? {
        label: alloc.group || 'Unknown',
        color: 'var(--v2-muted)',
      };

      return {
        groupType: alloc.groupType,
        label: meta.label,
        color: meta.color,
        targetWeight: alloc.targetWeight,
        currentWeight,
        deltaWeight,
        currentValue,
        targetValue: segValues.total * (alloc.targetWeight / 100),
        needsAction: deviation > 2,
      };
    });

    return { rows, maxDeviation, actionCount, totalValue: segValues.total };
  }, [strategy, portfolio]);

  const dotColor =
    actionCount === 0
      ? 'var(--v2-green)'
      : maxDeviation > 10
        ? 'var(--v2-red)'
        : 'var(--v2-yellow)';
  const statColor = actionCount === 0 ? 'var(--v2-green)' : 'var(--v2-yellow)';

  return (
    <div className={s.card}>
      <div className={s.header} onClick={() => setCollapsed((v) => !v)}>
        <div className={s.dot} style={{ background: dotColor }} />
        <div className={s.headerMeta}>
          <div className={s.name}>{strategy.name || 'Segments'}</div>
          <div className={s.sub}>
            {rows.length} segments · max deviation{' '}
            {isFinite(maxDeviation) ? maxDeviation.toFixed(1) : '0.0'}%
          </div>
        </div>
        <div className={s.stat}>
          <div className={s.statVal} style={{ color: statColor }}>
            {actionCount > 0 ? `${actionCount} off-target` : 'On track'}
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

      {!collapsed && rows.length > 0 && (
        <div className={s.body}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={s.tl}>Segment</th>
                  <th className={s.tl}>Protocol</th>
                  <th className={s.tl}>Chain</th>
                  <th className={s.tc}>Target</th>
                  <th className={s.tc}>Current</th>
                  <th className={s.tc}>Delta</th>
                  <th className={s.tc}>Value</th>
                  <th className={s.tc}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const deltaClass =
                    row.deltaWeight > 2
                      ? s.deltaPos
                      : row.deltaWeight < -2
                        ? s.deltaNeg
                        : s.deltaNeu;
                  const sign = row.deltaWeight > 0 ? '+' : '';
                  return (
                    <tr key={row.groupType}>
                      <td className={s.tl}>
                        <div className={s.cellWithLogo}>
                          <span className={s.bold} style={{ color: row.color }}>
                            {row.label}
                          </span>
                        </div>
                      </td>
                      <td className={s.tl}>
                        <div className={s.cellWithLogo}>
                          <span>All</span>
                        </div>
                      </td>
                      <td className={s.tl}>
                        <div className={s.cellWithLogo}>
                          <span>All</span>
                        </div>
                      </td>
                      <td className={s.tc}>
                        <div className={s.targetCell}>
                          <div className={s.barWrap}>
                            <div
                              className={s.barFill}
                              style={{
                                width: `${Math.min(row.targetWeight, 100)}%`,
                                background: row.color,
                              }}
                            />
                          </div>
                          <span>{row.targetWeight.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className={s.tc}>{row.currentWeight.toFixed(1)}%</td>
                      <td className={s.tc}>
                        <span className={deltaClass}>
                          {sign}
                          {row.deltaWeight.toFixed(1)}%
                        </span>
                      </td>
                      <td className={s.tc}>
                        <MaskedValue value={fmt(row.currentValue)} />
                      </td>
                      <td className={s.tc}>
                        {row.deltaWeight > 2 ? (
                          <span className={`${s.chip} ${s.chipBuy}`}>Buy</span>
                        ) : row.deltaWeight < -2 ? (
                          <span className={`${s.chip} ${s.chipSell}`}>Sell</span>
                        ) : (
                          <span className={`${s.chip} ${s.chipHold}`}>Hold</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalValue > 0 && (
            <div
              style={{
                padding: '8px 12px',
                borderTop: '1px solid var(--v2-border-sub)',
                fontSize: 11,
                color: 'var(--v2-muted)',
                textAlign: 'right',
              }}
            >
              Net portfolio: <MaskedValue value={fmt(totalValue)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PortfolioMixCard;
