import type { CSSProperties } from 'react';

import type { ThemePalette } from './colors';

// Centralized shared style helpers to reduce repetition across tables/panels.
// These are small utilities (not a full design system) relying on the active theme object.
// Usage: import { tableLayoutStyles } from '../styles/sharedStyles'; then spread or call with theme.

export interface TableLayoutStyles {
  table: CSSProperties;
  theadRow: CSSProperties;
  thBase: CSSProperties;
  tdBase: CSSProperties;
  row: (theme: ThemePalette) => CSSProperties;
  rowHover: (el: HTMLElement | null, theme: ThemePalette) => void;
  rowUnhover: (el: HTMLElement | null) => void;
}

export const tableLayoutStyles = (theme: ThemePalette): TableLayoutStyles => ({
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    tableLayout: 'fixed' as const,
    color: theme.textPrimary,
  },
  theadRow: {
    backgroundColor: theme.tableHeaderBg,
    borderBottom: `2px solid ${theme.tableBorder}`,
  },
  thBase: {
    padding: '10px 14px',
    fontWeight: 500,
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    color: theme.textSecondary,
    textAlign: 'left' as const,
  },
  tdBase: {
    padding: '12px 14px',
    fontSize: 13,
    fontWeight: 400,
    color: theme.textPrimary,
    fontFamily: 'inherit',
    textAlign: 'left' as const,
  },
  row: (theme: ThemePalette): CSSProperties => ({
    borderBottom: `1px solid ${theme.tableBorder}`,
    transition: 'background 0.2s',
  }),
  rowHover: (el: HTMLElement | null, theme: ThemePalette): void => {
    if (el) el.style.backgroundColor = theme.tableRowHoverBg;
  },
  rowUnhover: (el: HTMLElement | null): void => {
    if (el) el.style.backgroundColor = 'transparent';
  },
});

export const panelSurface = (theme: ThemePalette): CSSProperties => ({
  background: theme.tableBg,
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 10,
  overflow: 'hidden' as const,
});

export const headerSurface = (theme: ThemePalette): CSSProperties => ({
  background: theme.tableHeaderBg,
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 10,
  padding: '10px 16px',
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
});
