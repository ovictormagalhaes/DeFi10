import React from 'react'

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
export default function TableSection({ title, columns = [], rows = [], getKey, emptyText = 'No data' }) {
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #e9ecef', borderRadius: 8, overflow: 'hidden', margin: '12px 0' }}>
      <div style={{ padding: '12px 16px' }}>
        {title ? (
          <div style={{
            fontSize: 12,
            color: '#6c757d',
            fontWeight: 600,
            marginBottom: 6,
            textTransform: 'uppercase'
          }}>{title}</div>
        ) : null}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
              {columns.map((col) => (
                <th key={col.key}
                    style={{
                      padding: '10px 14px',
                      textAlign: col.align || 'left',
                      fontWeight: 600,
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '14px', textAlign: 'center', color: '#868e96', fontSize: 12 }}>
                  {emptyText}
                </td>
              </tr>
            ) : rows.map((row, idx) => (
              <tr key={getKey ? getKey(row, idx) : idx}
                  style={{ borderBottom: idx === rows.length - 1 ? 'none' : '1px solid #e9ecef' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                {columns.map((col) => (
                  <td key={col.key}
                      style={{
                        padding: '12px 14px',
                        textAlign: col.align || 'left',
                        fontFamily: col.align === 'right' ? 'monospace' : 'inherit',
                        fontWeight: col.align === 'right' ? 600 : 500,
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
  )
}
