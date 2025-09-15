import React from 'react'
import { useTheme } from '../context/ThemeProvider'

/**
 * TableSection
 * Renders an optional subtle title (left side) above column headers and a simple table.
 * Props:
 * - title?: string
 * - columns: Array<{ key: string, label: string, align?: 'left'|'right'|'center', width?: string|number }>
 * - rows: Array<Record<string, any>> (values can be string/number/JSX)
 * - getKey?: (row, index) => string
 * - emptyText?: string
 */
export default function TableSection({
  title = null,
  columns = [],
  rows = [],
  getKey,
  emptyMessage = 'No data',
  actions = null
}) {
  const { theme } = useTheme()
  const headerBg = theme.tableHeaderBg || theme.bgPanelAlt || theme.bgPanel
  const bodyBg = theme.tableBg || theme.bgPanel
  const stripeBg = theme.tableStripeBg || (theme.mode === 'light' ? '#f7f9fa' : '#24272f')
  const hoverBg = theme.tableRowHoverBg || (theme.mode === 'light' ? '#ecf0f3' : '#2b2e37')

  return (
    <div style={{ margin: '12px 0' }}>
      {title && (
        <div style={{ padding: '8px 4px 4px 4px' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: theme.textPrimary }}>{title}</div>
        </div>
      )}
      <div style={{ backgroundColor: bodyBg, borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: headerBg }}>
              {columns.map((col) => (
                <th key={col.key}
                  style={{
                    padding: '10px 16px',
                    textAlign: col.align || 'left',
                    fontWeight: 400,
                    color: theme.textSecondary,
                    fontSize: 12,
                    letterSpacing: '0.4px',
                    width: col.width,
                    borderBottom: 'none'
                  }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '14px 16px', textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : rows.map((row, idx) => {
              const isStriped = idx % 2 === 1
              return (
                <tr
                  key={getKey ? getKey(row, idx) : idx}
                  style={{ backgroundColor: isStriped ? stripeBg : 'transparent', transition: 'background-color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isStriped ? stripeBg : 'transparent'}
                >
                  {columns.map((col) => (
                    <td key={col.key}
                      style={{
                        padding: '12px 16px',
                        textAlign: col.align || 'left',
                        fontFamily: 'inherit',
                        fontWeight: 400,
                        fontSize: 13,
                        color: theme.textPrimary,
                        borderBottom: 'none'
                      }}
                    >
                      {row[col.key]}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
