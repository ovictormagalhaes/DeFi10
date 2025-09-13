import React from 'react'

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
  const showHeader = Boolean(icon || title || rightValue)
  return (
    <div style={{ margin: showHeader ? '12px 0' : 0 }}>
      {showHeader && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: 'white', border: '1px solid #dee2e6', borderRadius: 8, padding: '10px 16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon}
            <span style={{ fontWeight: 700, fontSize: 16, color: '#333' }}>{title}</span>
          </div>
          {rightValue !== null && (
            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#212529' }}>{rightValue}</div>
          )}
        </div>
      )}
      {tables.map((t, idx) => (
        <div key={idx} style={{ backgroundColor: '#fff', border: '1px solid #e9ecef', borderTop: 'none', borderRadius: idx === tables.length - 1 ? '0 0 8px 8px' : 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px' }}>
            {t.subtitle ? (
              <div style={{
                fontSize: 12,
                color: '#6c757d',
                fontWeight: 400,
                marginBottom: 6,
                textTransform: 'uppercase'
              }}>{t.subtitle}</div>
            ) : null}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  {t.columns.map((col) => (
                    <th key={col.key}
                        style={{
                          padding: '10px 14px',
                          textAlign: col.align || 'left',
                          fontWeight: 400,
                          color: '#495057',
                          fontSize: 12,
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
                    <td colSpan={t.columns.length} style={{ padding: '14px', textAlign: 'center', color: '#868e96', fontSize: 12 }}>
                      No data
                    </td>
                  </tr>
                ) : t.rows.map((row, rIdx) => (
                  <tr key={t.getKey ? t.getKey(row, rIdx) : rIdx}
                      style={{ borderBottom: rIdx === t.rows.length - 1 ? 'none' : '1px solid #e9ecef' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    {t.columns.map((col) => (
                      <td key={col.key}
                          style={{
                            padding: '12px 14px',
                            textAlign: col.align || 'left',
                            fontFamily: 'inherit',
                            fontWeight: 400,
                            fontSize: 13,
                            color: '#212529'
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
