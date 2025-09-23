import React, { useEffect, useState } from 'react'
// Lucide settings icon (inline to avoid new dependency if lucide-react not installed)
import { useTheme } from '../context/ThemeProvider'
// Using proportional ratio [2,1,1,1] for 4-column metric alignment
import { ratioToColGroup } from '../utils/tableLayout'
import { getFontStyles } from '../styles/fontStyles'

// A unified component that renders header (icon | title | right balance) and a table beneath it.
// Optional: collapsible behavior if onToggle provided.

// Helper functions for common style patterns
const createBadgeStyle = (fontStyle, theme, additionalProps = {}) => ({
  display: 'inline-flex',
  alignItems: 'center', 
  justifyContent: 'center',
  height: 22,
  lineHeight: '18px',
  background: theme.bgInteractive,
  padding: '0 8px',
  borderRadius: 6,
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  ...fontStyle,
  ...additionalProps
})

const createCondensedBadgeStyle = (fontStyle, theme, additionalProps = {}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 24,
  lineHeight: '20px',
  background: 'transparent',
  border: `1px solid ${theme.border}`,
  padding: '0 8px',
  borderRadius: 6,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  ...fontStyle,
  ...additionalProps
})

const createCellStyle = (fontStyle, additionalProps = {}) => ({
  padding: '0px',
  textAlign: 'right',
  ...fontStyle,
  ...additionalProps
})

const createFlexRow = (gap = 8, additionalProps = {}) => ({
  display: 'flex',
  alignItems: 'center',
  gap,
  ...additionalProps
})

const createFlexCenter = (gap = 6, additionalProps = {}) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap,
  ...additionalProps
})

const createButtonStyle = (theme, fontStyles, additionalProps = {}) => ({
  background: 'transparent',
  ...fontStyles.button,
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  transition: 'opacity .18s',
  padding: 0,
  ...additionalProps
})

const createTableStyle = (additionalProps = {}) => ({
  width: '100%',
  tableLayout: 'fixed',
  borderCollapse: 'collapse',
  ...additionalProps
})

// Settings icon component
const SettingsIcon = ({ color, width = 16, height = 16 }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09c0 .7.4 1.34 1 1.51.46.17.96.05 1.32-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.38.38-.5.86-.33 1.32.17.46.51.81 1 .98H21a2 2 0 0 1 0 4h-.09c-.7 0-1.34.4-1.51 1Z"/>
  </svg>
)

// Circle Alert icon component
const CircleAlertIcon = ({ color, width = 14, height = 14, style = {}, onClick = undefined }) => (
  <svg 
    width={width} 
    height={height} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    style={style}
    onClick={onClick}
  >
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

// Percentage badge with tooltip component
const PercentBadge = ({ value, fontStyles, theme, style = {}, showTooltip = false }) => {
  const [showDialog, setShowDialog] = useState(false)
  const [dialogPosition, setDialogPosition] = useState({ top: 0, left: 0 })
  const containerRef = React.useRef(null)
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDialog && !event.target.closest('.percent-badge-container')) {
        setShowDialog(false)
      }
    }
    
    if (showDialog) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showDialog])

  const handleIconClick = (e) => {
    e.stopPropagation()
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDialogPosition({
        top: rect.bottom + 4,
        left: rect.left + (rect.width / 2)
      })
    }
    
    setShowDialog(!showDialog)
  }
  
  return (
    <div className="percent-badge-container" style={{ position: 'relative' }} ref={containerRef}>
      <span 
        style={createBadgeStyle(fontStyles.monospaceSmall, theme, { 
          minWidth: 60, 
          gap: 4,
          paddingRight: showTooltip ? '6px' : '8px',
          cursor: 'default',
          ...style 
        })}
      >
        {value}
        {showTooltip && (
          <CircleAlertIcon 
            color={showDialog ? theme.info : theme.textSecondary} 
            width={12} 
            height={12}
            style={{ cursor: 'pointer' }}
            onClick={handleIconClick}
          />
        )}
      </span>
      
      {/* Dialog */}
      {showDialog && showTooltip && (
        <div 
          style={{
            position: 'fixed',
            top: dialogPosition.top,
            left: dialogPosition.left,
            transform: 'translateX(-50%)',
            backgroundColor: theme.bgPanel,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: theme.shadowHover || '0 4px 12px rgba(0,0,0,0.25)',
            zIndex: 10000,
            minWidth: 250,
            maxWidth: 300,
            ...fontStyles.secondary
          }}
          onClick={(e) => e.stopPropagation()}
        >
          This percentage represents the proportion of the total portfolio value held in this category.
          <div 
            style={{
              position: 'absolute',
              top: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: `6px solid ${theme.border}`,
            }}
          />
          <div 
            style={{
              position: 'absolute',
              top: -5,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: `6px solid ${theme.bgPanel}`,
            }}
          />
        </div>
      )}
    </div>
  )
}

// Condensed percentage badge with tooltip component
const CondensedPercentBadge = ({ value, fontStyles, theme, style = {}, showTooltip = false }) => {
  const [showDialog, setShowDialog] = useState(false)
  const [dialogPosition, setDialogPosition] = useState({ top: 0, left: 0 })
  const containerRef = React.useRef(null)
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDialog && !event.target.closest('.condensed-percent-badge-container')) {
        setShowDialog(false)
      }
    }
    
    if (showDialog) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showDialog])

  const handleIconClick = (e) => {
    e.stopPropagation()
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDialogPosition({
        top: rect.bottom + 4,
        left: rect.left + (rect.width / 2)
      })
    }
    
    setShowDialog(!showDialog)
  }
  
  return (
    <div className="condensed-percent-badge-container" style={{ position: 'relative' }} ref={containerRef}>
      <span 
        style={createCondensedBadgeStyle(fontStyles.secondary, theme, { 
          minWidth: 70, 
          textAlign: 'center',
          gap: 4,
          paddingRight: showTooltip ? '6px' : '8px',
          cursor: 'default',
          ...style 
        })}
      >
        {value}
        {showTooltip && (
          <CircleAlertIcon 
            color={showDialog ? theme.info : theme.textSecondary} 
            width={12} 
            height={12}
            style={{ cursor: 'pointer' }}
            onClick={handleIconClick}
          />
        )}
      </span>
      
      {/* Dialog */}
      {showDialog && showTooltip && (
        <div 
          style={{
            position: 'fixed',
            top: dialogPosition.top,
            left: dialogPosition.left,
            transform: 'translateX(-50%)',
            backgroundColor: theme.bgPanel,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: theme.shadowHover || '0 4px 12px rgba(0,0,0,0.25)',
            zIndex: 10000,
            minWidth: 250,
            maxWidth: 300,
            ...fontStyles.secondary
          }}
          onClick={(e) => e.stopPropagation()}
        >
          This percentage represents the proportion of the total portfolio value held in this category.
          <div 
            style={{
              position: 'absolute',
              top: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: `6px solid ${theme.border}`,
            }}
          />
          <div 
            style={{
              position: 'absolute',
              top: -5,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: `6px solid ${theme.bgPanel}`,
            }}
          />
        </div>
      )}
    </div>
  )
}

const createMenuOption = (checked, onChange, children, name, value, fontStyles, stopPropagation = true) => (
  <label style={{ display: 'block', marginBottom: 4, cursor: 'pointer' }}>
    <input
      type="radio"
      name={name}
      value={value}
      checked={checked}
      onChange={stopPropagation ? (e) => { e.stopPropagation(); onChange(e.target.value); } : onChange}
      style={{ marginRight: 6 }}
    />
    <span style={fontStyles.secondary}>{children}</span>
  </label>
)

export default function SectionTable({
  icon = null,
  title,
  rightValue = null,
  rightPercent = null,
  rewardsValue = null,
  subtitle = null,
  columns = [],
  rows = [],
  getKey,
  isExpanded: controlledExpanded,
  onToggle,
  actions = null,
  infoBadges = null,
  optionsMenu = null,
  customContent = null,
  transparentBody = false,
  variant = 'card', // 'card' | 'plain'
  metricsRatio = [2,1,1,1], // allows adapting header / subtitle metrics layout (e.g. [2,1,1] for lending 3-col tables)
  // New: let consumers fully control metrics content and layout.
  // If provided, these take precedence over rightValue/rightPercent/rewardsValue/infoBadges/actions.
  // Each renderer should return: { ratio: number[], cells: React.ReactNode[] }
  renderHeaderMetrics = null,
  renderMetricsRow = null,
  // Simpler API: a summary row that mirrors a provided columns[] definition (exact count/order)
  summaryColumns = null,
  renderSummaryCell = null
}) {
  const { theme } = useTheme()
  const fontStyles = getFontStyles(theme)
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(true)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false)
  const [groupByType, setGroupByType] = useState(false)
  const [sortBy, setSortBy] = useState('balance')
  const [sortDirection, setSortDirection] = useState('desc')
  const isControlled = typeof controlledExpanded === 'boolean'
  const expanded = isControlled ? controlledExpanded : uncontrolledExpanded
  const [optionsExpanded, setOptionsExpanded] = useState(false)

  // Close options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showOptionsMenu && !event.target.closest('.options-menu-container')) {
        setShowOptionsMenu(false)
      }
    }
    
    if (showOptionsMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showOptionsMenu])

  const handleToggle = () => {
    if (onToggle) onToggle()
    else setUncontrolledExpanded(!uncontrolledExpanded)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => { if (optionsExpanded) setOptionsExpanded(false) }
    if (optionsExpanded) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [optionsExpanded])

  const isCard = variant === 'card'
  const cardBg = theme.cardBg || theme.bgPanel
  const headerBg = 'transparent'
  const bodyBg = transparentBody ? 'transparent' : (theme.tableBg || theme.bgPanel)
  const stripeBg = theme.tableStripeBg || (theme.mode === 'light' ? '#f7f9fa' : '#24272f')
  const hoverBg = theme.tableRowHoverBg || (theme.mode === 'light' ? '#ecf0f3' : '#2b2e37')
  const dividerColor = 'transparent' // borderless style

  const metricsCols = Array.isArray(metricsRatio) && metricsRatio.length >= 3 ? metricsRatio : [2,1,1,1]
  const isThreeColMetrics = metricsCols.length === 3
  const hasRewardsValue = rewardsValue !== null

  const renderMetricsTable = (descriptor) => {
    if (!descriptor || !Array.isArray(descriptor.ratio) || !Array.isArray(descriptor.cells)) return null
    const ratio = descriptor.ratio
    const cells = descriptor.cells
    return (
      <table style={createTableStyle()}>
        {ratioToColGroup(ratio)}
        <tbody>
          <tr>
            {cells.map((cell, i) => (
              <td key={i} style={{ padding: '0px' }}>{cell}</td>
            ))}
          </tr>
        </tbody>
      </table>
    )
  }

  const colGroupFromColumns = (cols = []) => {
    if (!Array.isArray(cols) || cols.length === 0) return null
    return (
      <colgroup>
        {cols.map((c, i) => (
          <col key={i} style={c && c.width ? { width: c.width } : undefined} />
        ))}
      </colgroup>
    )
  }

  return (
    <div style={{ margin: '12px 0px' }}>
      <div
        style={{
          background: isCard ? cardBg : 'transparent',
          border: isCard ? `1px solid ${theme.border}` : 'none',
          borderRadius: isCard ? 14 : 0,
          boxShadow: isCard ? (theme.shadowCard || '0 2px 6px rgba(0,0,0,0.08)') : 'none',
          overflow: 'hidden',
          transition: 'background-color .25s,border-color .25s,box-shadow .25s'
        }}
      >
        <div
          style={{
            ...createFlexRow(0, { justifyContent: 'space-between' }),
            background: headerBg,
            padding: '10px 16px',
            cursor: onToggle ? 'pointer' : 'default',
            userSelect: 'none'
          }}
          onClick={onToggle ? handleToggle : undefined}
        >
          <div style={createFlexRow(8, { flex: '1 1 auto' })}>
            {icon}
            <span style={fontStyles.menuHeader}>{title}</span>
          </div>
          <div style={createFlexRow(12)} onClick={(e) => e.stopPropagation()}>
            {/* Header metrics: prefer renderHeaderMetrics if provided; fallback to legacy props */}
            {(subtitle && (renderHeaderMetrics || infoBadges || rightPercent !== null || rightValue !== null)) && (
              <div style={{ minWidth: isThreeColMetrics ? 360 : 420, flex: '0 0 auto' }}>
                {renderHeaderMetrics ? (
                  renderMetricsTable(
                    renderHeaderMetrics({
                      theme,
                      fontStyles,
                      helpers: { createFlexRow, createFlexCenter, createBadgeStyle, createCondensedBadgeStyle, createCellStyle, createTableStyle, ratioToColGroup }
                    })
                  )
                ) : (
                  <table style={createTableStyle()}>
                  {ratioToColGroup(metricsCols)}
                  <tbody>
                    <tr>
                      {isThreeColMetrics ? (
                        <>
                          {/* 3-col: badges + options (col1) */}
                          <td style={{ padding: '0px' }}>
                            <div style={createFlexRow(6)}>
                              {infoBadges && (
                                <span style={createBadgeStyle(fontStyles.monospaceSmall, theme)}>{infoBadges}</span>
                              )}
                            </div>
                          </td>
                          {/* 3-col: percent + actions (col2) */}
                          <td style={{ padding: '0px', textAlign: 'center' }}>
                            <div style={createFlexCenter(6)}>
                              {rightPercent !== null && (
                                <PercentBadge value={rightPercent} fontStyles={fontStyles} theme={theme} showTooltip={true} />
                              )}
                              {actions}
                            </div>
                          </td>
                          {/* 3-col: value */}
                          <td style={createCellStyle(fontStyles.normal)}>
                            {rightValue !== null ? rightValue : ''}
                          </td>
                        </>
                      ) : (
                        <>
                          {/* 4-col: badges */}
                          <td style={{ padding: '0px' }}>
                            {infoBadges && (
                              <span style={createBadgeStyle(fontStyles.monospaceSmall, theme)}>{infoBadges}</span>
                            )}
                          </td>
                          {/* 4-col: percent */}
                          <td style={{ padding: '0px', textAlign: 'center' }}>
                            {rightPercent !== null && (
                              <PercentBadge value={rightPercent} fontStyles={fontStyles} theme={theme} showTooltip={true} />
                            )}
                          </td>
                          {/* 4-col: actions/options */}
                          <td style={{ padding: '0px', textAlign: 'right' }}>
                            <div style={createFlexRow(6, { justifyContent: 'flex-end' })}>
                              {actions}
                            </div>
                          </td>
                          {/* 4-col: rewards */}
                          <td style={createCellStyle(fontStyles.monospace)}>
                            {rewardsValue !== null ? rewardsValue : ''}
                          </td>
                          {/* 4-col: value */}
                          <td style={createCellStyle(fontStyles.monospace)}>
                            {rightValue !== null ? rightValue : ''}
                          </td>
                        </>
                      )}
                    </tr>
                  </tbody>
                  </table>
                )}
              </div>
            )}
            <div style={createFlexRow(8)}>
              {/* Options Button - só visível quando seção está expandida */}
              {expanded && (
                <div className="options-menu-container" style={{ position: 'relative' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowOptionsMenu(!showOptionsMenu); }}
                    style={createButtonStyle(theme, fontStyles, {
                      color: showOptionsMenu ? theme.textPrimary : theme.textSecondary,
                      opacity: showOptionsMenu ? 1 : 0.3
                    })}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = 1 }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = showOptionsMenu ? 1 : 0.3 }}
                  >
                    <SettingsIcon color={showOptionsMenu ? theme.textPrimary : theme.textSecondary} />
                  </button>

                  {/* Options Menu */}
                  {showOptionsMenu && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        backgroundColor: theme.bgPanel,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 8,
                        padding: 8,
                        boxShadow: theme.shadowHover || '0 4px 12px rgba(0,0,0,0.25)',
                        zIndex: 1000,
                        minWidth: 180,
                        marginTop: 4
                      }}
                    >
                      <div style={{ ...fontStyles.small, marginBottom: 6 }}>
                        Options
                      </div>
                      
                      {/* Group by Type */}
                      <label style={{ display: 'block', marginBottom: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={groupByType}
                          onChange={(e) => { e.stopPropagation(); setGroupByType(e.target.checked); }}
                          style={{ marginRight: 6 }}
                        />
                        <span style={fontStyles.secondary}>Group by Type</span>
                      </label>

                      {/* Sort Options */}
                      <div style={{ ...fontStyles.small, marginBottom: 4 }}>
                        Sort by
                      </div>
                      {['balance', 'name', 'type'].map(option => (
                        <div key={option}>
                          {createMenuOption(
                            sortBy === option,
                            setSortBy,
                            option.charAt(0).toUpperCase() + option.slice(1),
                            `sort-${title.replace(/\s+/g, '-')}`,
                            option,
                            fontStyles
                          )}
                        </div>
                      ))}

                      {/* Sort Direction */}
                      <div style={{ ...fontStyles.small, marginBottom: 4, marginTop: 8 }}>
                        Order
                      </div>
                      {['asc', 'desc'].map(direction => (
                        <div key={direction}>
                          {createMenuOption(
                            sortDirection === direction,
                            setSortDirection,
                            direction === 'asc' ? 'Ascending' : 'Descending',
                            `direction-${title.replace(/\s+/g, '-')}`,
                            direction,
                            fontStyles
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Hide/Show Toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); handleToggle(); }}
                style={createButtonStyle(theme, fontStyles)}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.7 }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = 1 }}
              >
                {expanded ? 'Hide -' : 'Show +'}
              </button>
            </div>
          </div>
        </div>

        {expanded && (
          <div style={{
            background: bodyBg,
            borderRadius: isCard ? '0 0 14px 14px' : 0
          }}>
            <div style={{ padding: '0px 0px' }}>
              {subtitle ? (
                <div style={{
                  ...fontStyles.secondary,
                  margin: '0 16px 6px 16px',
                  textTransform: 'uppercase'
                }}>{subtitle}</div>
              ) : null}
              {/* Body summary/metrics strip */}
              {(!subtitle && (summaryColumns && renderSummaryCell)) ? (
                <div style={{ padding: '6px 14px 4px 14px' }}>
                  <table style={createTableStyle()}>
                    {colGroupFromColumns(summaryColumns)}
                    <tbody>
                      <tr>
                        {summaryColumns.map((col, i) => (
                          <td key={col?.key || i} style={{ padding: '0px', textAlign: col?.align || 'left' }}>
                            {renderSummaryCell(col, i)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (!subtitle && (renderMetricsRow || rightPercent !== null || infoBadges || rightValue !== null)) && (
                <div style={{ padding: '6px 14px 4px 14px' }}>
                  {renderMetricsRow ? (
                    renderMetricsTable(
                      renderMetricsRow({
                        theme,
                        fontStyles,
                        context: { subtitle, columns, rows },
                        helpers: { createFlexRow, createFlexCenter, createBadgeStyle, createCondensedBadgeStyle, createCellStyle, createTableStyle, ratioToColGroup }
                      })
                    )
                  ) : (
                    <table style={createTableStyle()}>
                      {ratioToColGroup(metricsCols)}
                      <tbody>
                        <tr>
                          {isThreeColMetrics ? (
                            <>
                              {/* 3-col condensed metrics row with total forced to last column */}
                              <td style={{ padding: '0 0px' }}>
                                <div style={createFlexRow(8)}>
                                  {optionsMenu ? (
                                    <button
                                      style={{
                                        background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6,
                                        ...createFlexCenter()
                                      }}
                                      onClick={(e) => { e.stopPropagation(); setOptionsExpanded(v => !v) }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bgInteractiveHover}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                      title="Options"
                                    >
                                      <SettingsIcon color={theme.textSecondary} />
                                    </button>
                                  ) : null}
                                  {rightPercent !== null && (
                                    <CondensedPercentBadge value={rightPercent} fontStyles={fontStyles} theme={theme} showTooltip={true} />
                                  )}
                                  {infoBadges && (
                                    <span style={createCondensedBadgeStyle(fontStyles.secondary, theme, { maxWidth: '100%' })}>{infoBadges}</span>
                                  )}
                                  {optionsExpanded && optionsMenu && (
                                    <div
                                      style={{ position: 'absolute', background: bodyBg, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '0 8px', minWidth: 200, zIndex: 1000, marginTop: 30 }}
                                      onClick={(e) => e.stopPropagation()}
                                    >{optionsMenu}</div>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '0px' }} />
                              <td style={createCellStyle(fontStyles.monospace, { fontSize: 14 })}>
                                {rightValue !== null ? rightValue : ''}
                              </td>
                            </>
                          ) : (
                            <>
                              {/* 4-col metrics row with total forced last */}
                              <td style={{ padding: '0px' }}>
                                <div style={createFlexRow(8)}>
                                  {rightPercent !== null && (
                                    <CondensedPercentBadge value={rightPercent} fontStyles={fontStyles} theme={theme} showTooltip={true} />
                                  )}
                                  {infoBadges && (
                                    <span style={createCondensedBadgeStyle(fontStyles.secondary, theme, { maxWidth: '100%' })}>{infoBadges}</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '0 6px' }} />
                              <td style={createCellStyle(fontStyles.monospace, { fontSize: 14, paddingRight: 6})}>
                                {rewardsValue !== null ? rewardsValue : ''}
                              </td>
                              <td style={createCellStyle(fontStyles.monospace, { fontSize: 14 })}>
                                {rightValue !== null ? rightValue : ''}
                              </td>
                            </>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              {customContent ? (
                customContent
              ) : (
                <table style={createTableStyle()}>
                  <thead>
                    <tr style={{ backgroundColor: headerBg }}>
                      {columns.map((col) => (
                        <th key={col.key}
                          style={{
                            padding: '10px 16px',
                            textAlign: col.align || 'left',
                            ...fontStyles.tableHeader,
                            width: col.width,
                            borderBottom: `1px solid ${dividerColor}`
                          }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} style={{ padding: '14px 16px', textAlign: 'center', ...fontStyles.secondary }}>
                          No data
                        </td>
                      </tr>
                    ) : rows.map((row, idx) => {
                      const isStriped = idx % 2 === 1
                      return (
                        <tr
                          key={getKey ? getKey(row, idx) : idx}
                          style={{
                            backgroundColor: isStriped ? stripeBg : 'transparent',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isStriped ? stripeBg : 'transparent'}
                        >
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              style={{
                                padding: '12px 16px',
                                textAlign: col.align || 'left',
                                ...fontStyles.normal,
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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
