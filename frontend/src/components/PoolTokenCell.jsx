import React from 'react';

import { useTheme } from '../context/ThemeProvider.tsx';

import TokenDisplay from './TokenDisplay.tsx';

/**
 * PoolTokenCell
 * A reusable row cell for Liquidity Pool tokens with aligned columns.
 * Layout: | Token (icon + symbol) | Rewards | Balance |
 */
export default function PoolTokenCell({ token, rewardText, balanceText, isLast = false }) {
  const { theme } = useTheme();
  const baseContainerStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 0.7fr 0.7fr', // proportional columns
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

  const leftCellStyle = {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  };

  const rightCellStyle = {
    textAlign: 'right',
  };

  const labelStyle = {
    fontSize: '11px',
    color: theme.textSecondary,
    marginBottom: '2px',
  };

  const valueStyle = {
    fontFamily: 'monospace',
    fontSize: '14px',
    fontWeight: 400,
    color: theme.textPrimary,
  };

  const [hovered, setHovered] = React.useState(false);

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
