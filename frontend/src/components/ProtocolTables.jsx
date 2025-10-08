import React from 'react';

import { useTheme } from '../context/ThemeProvider.tsx';

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
  const { theme } = useTheme();
  const showHeader = Boolean(icon || title || rightValue);
  return (
    <div className={showHeader ? 'mt-12 mb-6' : ''}>
      {showHeader && (
        <div className="protocol-header">
          <div className="flex align-center gap-8">
            {icon}
            <span className="protocol-header-title text-primary">{title}</span>
          </div>
          {rightValue !== null && <div className="protocol-header-value text-primary">{rightValue}</div>}
        </div>
      )}
      {tables.map((t, idx) => (
        <div key={idx} className="protocol-table-container">
          <div className="p-12 px-16">
            {t.subtitle ? <div className="subtitle">{t.subtitle}</div> : null}
            <table className="table">
              <thead>
                <tr className="thead-row">
                  {t.columns.map((col) => {
                    const align = col.align || 'left';
                    const alignClass = align === 'right' ? 'th-right' : align === 'center' ? 'th-center' : 'th-left';
                    return (
                      <th
                        key={col.key}
                        className={`th-head ${alignClass}`}
                        style={{ width: col.width }}
                      >
                        {col.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {!t.rows || t.rows.length === 0 ? (
                  <tr>
                    <td colSpan={t.columns.length} className="td text-center text-muted fs-11">
                      No data
                    </td>
                  </tr>
                ) : (
                  t.rows.map((row, rIdx) => (
                    <tr
                      key={t.getKey ? t.getKey(row, rIdx) : rIdx}
                      className={`table-row table-row-hover ${rIdx === t.rows.length - 1 ? '' : 'tbody-divider'}`}
                    >
                      {t.columns.map((col) => (
                        <td key={col.key} className="td text-primary" style={{ textAlign: col.align || 'left' }}>
                          {row[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
