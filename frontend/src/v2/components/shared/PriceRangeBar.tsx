import React from 'react';

interface PriceRangeBarProps {
  lower: number;
  upper: number;
  current: number;
  inRange: boolean;
}

export const PriceRangeBar: React.FC<PriceRangeBarProps> = ({ lower, upper, current, inRange }) => {
  const range = upper - lower;
  const pct = range > 0 ? Math.max(0, Math.min((current - lower) / range, 1)) : 0.5;
  const fmt = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(v < 10 ? 4 : 2)}`;
  const widthPct = upper + lower > 0 ? (range / (upper + lower)) * 100 : null;

  return (
    <div style={{ marginBottom: 11 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--v2-muted)',
          marginBottom: 5,
        }}
      >
        <span>Range: {fmt(lower)} — {fmt(upper)}</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {widthPct != null && (
            <span style={{ color: 'var(--v2-dim)' }}>±{widthPct.toFixed(widthPct < 10 ? 1 : 0)}%</span>
          )}
          <span style={{ color: 'var(--v2-text)', fontWeight: 600 }}>Now: {fmt(current)}</span>
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 6,
          background: 'var(--v2-bg-hover)',
          borderRadius: 3,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: 3,
            background: inRange ? 'var(--v2-green)' : 'var(--v2-red)',
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -4,
            left: `${pct * 100}%`,
            transform: 'translateX(-50%)',
            width: 3,
            height: 14,
            background: 'var(--v2-text)',
            borderRadius: 2,
            boxShadow: '0 0 5px rgba(255,255,255,0.35)',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9.5,
          color: 'var(--v2-dim)',
          marginTop: 4,
        }}
      >
        <span>{fmt(lower)}</span>
        <span style={{ color: 'var(--v2-accent)' }}>{fmt(current)}</span>
        <span>{fmt(upper)}</span>
      </div>
    </div>
  );
};

export default PriceRangeBar;
