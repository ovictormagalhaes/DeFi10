import React from 'react';
import { useTheme } from '../context/ThemeProvider.tsx';

/**
 * Thin vertical sidebar navigation.
 * Props:
 *  - active: string key of current view
 *  - onChange: (key) => void
 *  - collapsed (future): could allow expanding labels
 */
const ITEMS = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'summary', label: 'Summary', icon: 'Σ' },
  { key: 'rebalancing', label: 'Rebalance', icon: '♻' },
  { key: 'liquidity', label: 'Liquidity', icon: '💧' },
];

export default function SidebarNav({ active, onChange }) {
  const { theme } = useTheme();
  return (
    <nav
      style={{
        width: 60,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 8px',
        gap: 12,
        background: theme.bgPanel,
        borderRight: `1px solid ${theme.border}`,
        position: 'sticky',
        top: 0,
        height: '100vh',
        boxSizing: 'border-box',
        zIndex: 40,
      }}
      aria-label="Primary navigation"
    >
      <div style={{width: '100%', display:'flex', flexDirection:'column', gap:8}}>
        {ITEMS.map(it => {
          const isActive = it.key === active;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              className="sidebar-btn"
              aria-current={isActive ? 'page' : undefined}
              title={it.label}
              style={{
                width: '100%',
                height: 48,
                border: 'none',
                background: isActive ? theme.primarySubtle : 'transparent',
                color: theme.textPrimary,
                borderRadius: 12,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                position: 'relative',
                transition: 'background .18s, color .18s',
              }}
            >
              <span style={{lineHeight:1}}>{it.icon}</span>
              <span style={{
                position:'absolute',
                bottom:4,
                fontSize:9,
                letterSpacing:.5,
                fontWeight:600,
                textTransform:'uppercase',
                color: isActive ? theme.textPrimary : theme.textSecondary,
              }}>{it.label.slice(0,6)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
