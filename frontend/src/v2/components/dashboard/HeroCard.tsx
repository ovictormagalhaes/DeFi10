import React from 'react';
import { useV2 } from '../../context/V2Context';
import { formatPrice } from '../../../utils/walletUtils';
import type { V2Breakdown } from '../../utils/breakdown';
import s from './HeroCard.module.css';

interface HeroCardProps {
  breakdown: V2Breakdown;
  onProjection?: () => void;
}

const MV: React.FC<{ value: string; className?: string }> = ({ value, className }) => {
  const { maskValues } = useV2();
  return <span className={className}>{maskValues ? '••••••' : value}</span>;
};

const Stat: React.FC<{ label: string; value: string; sub?: string; color?: string }> = ({
  label,
  value,
  sub,
  color,
}) => (
  <div className={s.stat}>
    <div className={s.statLabel}>{label}</div>
    <div className={s.statValue} style={color ? { color } : undefined}>
      <MV value={value} />
    </div>
    {sub && <div className={s.statSub}>{sub}</div>}
  </div>
);

export const HeroCard: React.FC<HeroCardProps> = ({ breakdown, onProjection }) => {
  const total = breakdown.totalValue;
  const categories = [
    { label: 'Wallet', value: breakdown.walletValue, color: '#14b8a6' },
    { label: 'Lending', value: breakdown.lendingNet, color: '#22c55e' },
    { label: 'Pools', value: breakdown.poolValue, color: '#f59e0b' },
    { label: 'Staking', value: breakdown.stakingValue, color: '#a78bfa' },
  ].filter((c) => c.value > 0);

  return (
    <div className={s.card} onClick={onProjection}>
      <div className={s.bg} />

      <div className={s.main}>
        <div className={s.totalLabel}>Net Worth</div>
        <div className={s.totalValue}>
          <MV value={formatPrice(total)} className={s.totalNum} />
        </div>

        {categories.length > 0 && (
          <div className={s.barLegend}>
            {categories.map((c) => (
              <div key={c.label} className={s.legendItem}>
                <div className={s.legendDot} style={{ background: c.color }} />
                <span className={s.legendLabel}>{c.label}</span>
                <span className={s.legendPct}>
                  {total > 0 ? `${((c.value / total) * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={s.stats}>
        <Stat label="Wallet" value={formatPrice(breakdown.walletValue)} />
        <div className={s.divider} />
        <Stat
          label="Supplied"
          value={formatPrice(breakdown.lendingSupplied)}
          color="var(--v2-green)"
        />
        <Stat
          label="Borrowed"
          value={formatPrice(breakdown.lendingBorrowed)}
          sub={
            breakdown.lendingSupplied > 0
              ? `LTV ${((breakdown.lendingBorrowed / breakdown.lendingSupplied) * 100).toFixed(1)}%`
              : undefined
          }
          color="var(--v2-red)"
        />
        <div className={s.divider} />
        <Stat label="Pools" value={formatPrice(breakdown.poolValue)} />
        <Stat label="Staking" value={formatPrice(breakdown.stakingValue)} />
      </div>
    </div>
  );
};

export default HeroCard;
