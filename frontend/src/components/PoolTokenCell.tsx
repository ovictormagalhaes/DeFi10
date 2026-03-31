import { useState } from 'react';

import { useTheme } from '../context/ThemeProvider';

import TokenDisplay from './TokenDisplay';

interface PoolTokenCellProps {
  token: Record<string, unknown>;
  rewardText: React.ReactNode;
  balanceText: React.ReactNode;
  isLast?: boolean;
}

/**
 * PoolTokenCell
 * A reusable row cell for Liquidity Pool tokens with aligned columns.
 * Layout: | Token (icon + symbol) | Rewards | Balance |
 */
export default function PoolTokenCell({
  token,
  rewardText,
  balanceText,
  isLast = false,
}: PoolTokenCellProps) {
  const { theme } = useTheme();
  const baseContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 0.7fr 0.7fr',
    gap: '24px',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: theme.bgPanel,
    borderRadius: '8px',
    marginBottom: isLast ? '0' : '6px',
    border: `1px solid ${theme.border}`,
    boxShadow: theme.shadowLight,
    transition: 'all 0.2s ease',
  };

  const leftCellStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  };

  const rightCellStyle: React.CSSProperties = {
    textAlign: 'right',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: theme.textSecondary,
    marginBottom: '2px',
  };

  const valueStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '14px',
    fontWeight: 400,
    color: theme.textPrimary,
  };

  const [hovered, setHovered] = useState<boolean>(false);

  return (
    <div
      style={{
        ...baseContainerStyle,
        backgroundColor: hovered ? theme.bgPanelAlt : theme.bgPanel,
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: hovered ? theme.shadowHover : theme.shadowLight,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left: Token icon + symbol */}
      <div style={leftCellStyle}>
        <TokenDisplay tokens={[token]} size={22} showChain={false} />
      </div>

      {/* Middle: Rewards */}
      <div style={rightCellStyle}>
        <div style={labelStyle}>Rewards</div>
        <span style={{ ...valueStyle, fontSize: '13px', fontWeight: 400 }}>{rewardText}</span>
      </div>

      {/* Right: Balance */}
      <div style={rightCellStyle}>
        <div style={labelStyle}>Balance</div>
        <span style={valueStyle}>{balanceText}</span>
      </div>
    </div>
  );
}
