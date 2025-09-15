// Centralized shared style helpers to reduce repetition across tables/panels.
// These are small utilities (not a full design system) relying on the active theme object.
// Usage: import { tableLayoutStyles } from '../styles/sharedStyles'; then spread or call with theme.

export const tableLayoutStyles = (theme) => ({
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    color: theme.textPrimary
  },
  theadRow: {
    backgroundColor: theme.tableHeaderBg,
    borderBottom: `2px solid ${theme.tableBorder}`
  },
  thBase: {
    padding: '10px 14px',
    fontWeight: 500,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.textSecondary,
    textAlign: 'left'
  },
  tdBase: {
    padding: '12px 14px',
    fontSize: 13,
    fontWeight: 400,
    color: theme.textPrimary,
    fontFamily: 'inherit',
    textAlign: 'left'
  },
  row: (theme) => ({
    borderBottom: `1px solid ${theme.tableBorder}`,
    transition: 'background 0.2s'
  }),
  rowHover: (el, theme) => { if (el) el.style.backgroundColor = theme.tableRowHoverBg },
  rowUnhover: (el) => { if (el) el.style.backgroundColor = 'transparent' }
})

export const panelSurface = (theme) => ({
  background: theme.tableBg,
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 10,
  overflow: 'hidden'
})

export const headerSurface = (theme) => ({
  background: theme.tableHeaderBg,
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 10,
  padding: '10px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between'
})
