import React from 'react';
import MaskedValue from './MaskedValue';

interface SectionHeaderProps {
  title: string;
  count?: number;
  total?: string;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  count,
  total,
  badge,
  right,
  onClick,
}) => (
  <div
    onClick={onClick}
    onMouseEnter={onClick ? e => (e.currentTarget.style.background = 'var(--v2-bg-hover)') : undefined}
    onMouseLeave={onClick ? e => (e.currentTarget.style.background = 'transparent') : undefined}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: onClick ? '4px 8px 11px' : '0 0 9px',
      margin: onClick ? '-4px -8px 11px' : '0 0 13px',
      borderBottom: '1px solid var(--v2-border-sub)',
      cursor: onClick ? 'pointer' : undefined,
      borderRadius: onClick ? 8 : undefined,
      transition: 'background 0.14s ease',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.09em',
          color: 'var(--v2-dim)',
        }}
      >
        {title}
      </span>
      {count !== undefined && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '1px 7px',
            background: 'var(--v2-bg-card)',
            border: '1px solid var(--v2-border)',
            borderRadius: 8,
            color: 'var(--v2-muted)',
          }}
        >
          {count}
        </span>
      )}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {total && (
        <span style={{ fontSize: 14, fontWeight: 700 }}>
          <MaskedValue value={total} />
        </span>
      )}
      {badge}
      {right}
    </div>
  </div>
);

export const ApyBadge: React.FC<{ label: string; onClick?: () => void }> = ({ label, onClick }) => (
  <span
    onClick={onClick}
    style={{
      fontSize: 11.5,
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 6,
      background: 'var(--v2-green-s)',
      color: 'var(--v2-green)',
      cursor: onClick ? 'pointer' : undefined,
    }}
  >
    {label}
  </span>
);

export default SectionHeader;
