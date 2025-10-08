import React from 'react';

import { useTheme } from '../context/ThemeProvider.tsx';

/**
 * HeaderTable
 * Shared header + table wrapper. If title is provided, it follows the same look as Collapsible headers.
 * Props:
 * - icon?: JSX (optional)
 * - title: string
 * - rightValue?: string | JSX (Balance on the right)
 * - children: JSX (usually a TableSection)
 */
export default function HeaderTable({ icon = null, title, rightValue = null, children }) {
  const { theme } = useTheme();
  return (
    <div style={{ margin: '12px 0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.tableHeaderBg,
          border: `1px solid ${theme.tableBorder}`,
          borderRadius: 10,
          padding: '10px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <span style={{ fontWeight: 700, fontSize: 15, color: theme.textPrimary }}>{title}</span>
        </div>
        {rightValue !== null && (
          <div
            style={{
              fontFamily: 'monospace',
              fontWeight: 600,
              fontSize: 14,
              color: theme.textPrimary,
            }}
          >
            {rightValue}
          </div>
        )}
      </div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}
