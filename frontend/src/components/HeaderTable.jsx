import React from 'react'

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
  return (
    <div style={{ margin: '12px 0' }}>
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
      <div style={{ marginTop: 8 }}>
        {children}
      </div>
    </div>
  )
}
