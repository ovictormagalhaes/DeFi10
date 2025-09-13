import React, { useEffect, useState } from 'react'

// A unified component that renders header (icon | title | right balance) and a table beneath it.
// Optional: collapsible behavior if onToggle provided.
export default function SectionTable({
  icon = null,
  title,
  rightValue = null,
  rightPercent = null,
  subtitle = null,
  columns = [], // [{ key, label, align, width }]
  rows = [], // [ { key: value } ]
  getKey,
  isExpanded: controlledExpanded,
  onToggle,
  actions = null,
  infoBadges = null,
  optionsMenu = null,
  customContent = null,
  level = 1
}) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(true)
  const isControlled = typeof controlledExpanded === 'boolean'
  const expanded = isControlled ? controlledExpanded : uncontrolledExpanded
  const [optionsExpanded, setOptionsExpanded] = useState(false)

  const handleToggle = () => {
    if (onToggle) onToggle()
    else setUncontrolledExpanded(!uncontrolledExpanded)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (optionsExpanded) setOptionsExpanded(false)
    }
    if (optionsExpanded) {
      document.addEventListener('click', handleClickOutside)
    }
    return () => document.removeEventListener('click', handleClickOutside)
  }, [optionsExpanded])

  const isLevel0 = level === 0

  return (
    <div style={{ margin: '12px 0' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: isLevel0 ? 'transparent' : 'white',
          border: isLevel0 ? 'none' : '1px solid #dee2e6',
          borderRadius: isLevel0 ? 0 : 8,
          padding: isLevel0 ? '6px 0' : '10px 16px',
          cursor: onToggle ? 'pointer' : 'default', userSelect: 'none'
        }}
        onClick={onToggle ? handleToggle : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <span style={{ fontWeight: 700, fontSize: 16, color: '#333' }}>{title}</span>
        </div>
        {(infoBadges || rightPercent !== null || rightValue !== null || optionsMenu || actions) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 80px 120px 20px',
              alignItems: 'center',
              gap: 12,
              minWidth: 352,
              flex: '0 0 auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Col 1: info badges */}
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <span
                style={{
                  display: 'inline-block',
          width: 100,
        textAlign: 'center',
      fontSize: 12,
      fontWeight: 700,
      color: '#374151',
      background: '#f3f4f6',
      border: '1px solid #e5e7eb',
      padding: '2px 6px',
      borderRadius: 6,
      fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {infoBadges}
              </span>
            </div>
            {/* Col 2: percentage */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {rightPercent !== null ? (
                <span
                  style={{
                    display: 'inline-block',
                    width: 72,
                    textAlign: 'center',
        fontSize: 12,
        fontWeight: 700,
        color: '#374151',
        background: '#f3f4f6',
        border: '1px solid #e5e7eb',
        padding: '2px 6px',
        borderRadius: 6,
        fontFamily: 'monospace'
                  }}
                >
                  {rightPercent}
                </span>
              ) : null}
            </div>
            {/* Col 3: balance */}
            <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#212529' }}>
              {rightValue !== null ? rightValue : ''}
            </div>
            {/* Col 4: options (and optional actions) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              {optionsMenu && (
                <div style={{ position: 'relative' }}>
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={() => setOptionsExpanded(v => !v)}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    title="Options"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="5" r="2" fill="#333333"/>
                      <circle cx="12" cy="12" r="2" fill="#333333"/>
                      <circle cx="12" cy="19" r="2" fill="#333333"/>
                    </svg>
                  </button>
                  {optionsExpanded && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        background: 'white',
                        border: '1px solid #dee2e6',
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        padding: '8px 0',
                        minWidth: 200,
                        zIndex: 1000
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {optionsMenu}
                    </div>
                  )}
                </div>
              )}
              {actions}
            </div>
          </div>
        )}
      </div>

      {expanded && (
        customContent ? (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e9ecef', borderTop: isLevel0 ? '1px solid #e9ecef' : 'none', borderRadius: isLevel0 ? '8px' : '0 0 8px 8px', overflow: 'hidden' }}>
            {customContent}
          </div>
        ) : (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e9ecef', borderTop: isLevel0 ? '1px solid #e9ecef' : 'none', borderRadius: isLevel0 ? '8px' : '0 0 8px 8px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px' }}>
              {subtitle ? (
                <div style={{
                  fontSize: 12,
                  color: '#6c757d',
                  fontWeight: 400,
                  marginBottom: 6,
                  textTransform: 'uppercase'
                }}>{subtitle}</div>
              ) : null}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    {columns.map((col) => (
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
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} style={{ padding: '14px', textAlign: 'center', color: '#868e96', fontSize: 12 }}>
                        No data
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
        )
      )}
    </div>
  )
}
