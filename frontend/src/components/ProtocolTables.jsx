import React from 'react'
import { useTheme } from '../context/ThemeProvider'

/**
 * ProtocolTables
 * Renders a protocol header (icon | title | right balance) and a sequence of tables underneath.
 * Props:
 * - icon?: JSX
 * - title: string
 * - rightValue?: string | JSX
 * - tables: Array<{
 *     subtitle?: string,
 *     columns: Array<{ key: string, label: string, align?: 'left'|'right'|'center', width?: string|number }>,
 *     rows: Array<Record<string, any>>,
 *     getKey?: (row, index) => string
 *   }>
 */
export default function ProtocolTables({ icon = null, title, rightValue = null, tables = [] }) {
  const { theme } = useTheme()
  const showHeader = Boolean(icon || title || rightValue)
  return (
    <div style={{ margin: showHeader ? '12px 0' : 0 }}>
      {showHeader && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: theme.tableHeaderBg,
          border: `1px solid ${theme.tableBorder}`,
          borderRadius: 10, padding: '10px 16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon}
            <span style={{ fontWeight: 700, fontSize: 15, color: theme.textPrimary }}>{title}</span>
          </div>
          {rightValue !== null && (
            <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 14, color: theme.textPrimary }}>{rightValue}</div>
          )}
        </div>
      )}
      {tables.map((t, idx) => (
        <div key={idx} style={{ backgroundColor: theme.tableBg, border: `1px solid ${theme.tableBorder}`, borderTop: 'none', borderRadius: idx === tables.length - 1 ? '0 0 10px 10px' : 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px' }}>
            {t.subtitle ? (
              <div style={{
                fontSize: 12,
                color: theme.textMuted,
                fontWeight: 400,
                marginBottom: 6,
                textTransform: 'uppercase'
              }}>{t.subtitle}</div>
            ) : null}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: theme.tableHeaderBg, borderBottom: `2px solid ${theme.tableBorder}` }}>
                  {t.columns.map((col) => (
                    <th key={col.key}
                        style={{
                          padding: '10px 14px',
                          textAlign: col.align || 'left',
                          fontWeight: 500,
                          color: theme.textSecondary,
                          fontSize: 11,
                          letterSpacing: '0.4px',
                          width: col.width
                        }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(!t.rows || t.rows.length === 0) ? (
                  <tr>
                    <td colSpan={t.columns.length} style={{ padding: '14px', textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>
                      No data
                    </td>
                  </tr>
                ) : t.rows.map((row, rIdx) => (
                  <tr key={t.getKey ? t.getKey(row, rIdx) : rIdx}
                      style={{ borderBottom: rIdx === t.rows.length - 1 ? 'none' : `1px solid ${theme.tableBorder}`, transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.tableRowHoverBg}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    {t.columns.map((col) => (
                      <td key={col.key}
                          style={{
                            padding: '12px 14px',
                            textAlign: col.align || 'left',
                            fontFamily: 'inherit',
                            fontWeight: 400,
                            fontSize: 13,
                            color: theme.textPrimary
                          }}>
                        {row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
