import React from 'react'
import { useTheme } from '../context/ThemeProvider'

const DynamicCell = ({
  data,
  columns,
  onMouseEnter,
  onMouseLeave,
  style = {},
  className = ''
}) => {
  const { theme } = useTheme()
  // Calcula o flex total para normalizar os tamanhos
  const totalFlex = Object.values(columns).reduce((sum, col) => sum + (col.flex || 1), 0)

  const baseBg = theme.tableBg || theme.bgPanel || 'transparent'
  const hoverBg = theme.tableRowHoverBg || theme.bgPanelAlt || baseBg

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: baseBg,
        borderRadius: 8,
        // removendo borda & sombra para design flat
        border: 'none',
        boxShadow: 'none',
        transition: 'background-color 0.18s ease',
        ...style
      }}
      className={className}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = hoverBg
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = baseBg
        onMouseLeave?.(e)
      }}
    >
      {Object.entries(columns).map(([key, column], index) => {
        const flexValue = (column.flex || 1) / totalFlex * 100
        const value = typeof column.getValue === 'function' ? column.getValue(data) : data[key]

        return (
          <div
            key={key}
            style={{
              flex: `0 0 ${flexValue}%`,
              textAlign: column.align || (index === 0 ? 'left' : 'right'),
              ...column.style
            }}
          >
            {column.label && (
              <div style={{
                fontSize: 11,
                color: theme.textMuted,
                marginBottom: 2
              }}>
                {column.label}
              </div>
            )}
            <div style={{
              fontFamily: column.monospace ? 'monospace' : 'inherit',
              fontSize: column.fontSize || 14,
              fontWeight: column.fontWeight || (column.highlight ? 600 : 'normal'),
              color: column.color || (column.highlight ? theme.textPrimary : theme.textSecondary)
            }}>
              {value}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Componente especializado para células de token
const TokenCell = ({
  token,
  showRewards = false,
  showType = false,
  isLast = false,
  onMouseEnter,
  onMouseLeave
}) => {
  const { theme } = useTheme()
  const columns = {
    token: {
      flex: 3,
      align: 'left',
      getValue: (data) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {data.logo && (
            <img 
              src={data.logo} 
              alt={data.symbol}
              style={{ 
                width: 20,
                height: 20, 
                marginRight: 10,
                borderRadius: '50%',
                border: `1px solid ${theme.border}`
              }}
              onError={(e) => e.target.style.display = 'none'}
            />
          )}
          <span style={{ 
            fontWeight: 600,
            fontSize: 14,
            color: theme.textPrimary
          }}>
            {data.symbol}
          </span>
          {showType && data.type && (
            <span style={{
              marginLeft: 8,
              // design flat: removendo fundo pesado; apenas cor do texto
              color: data.type === 'supplied' ? theme.success : theme.danger,
              padding: '0 4px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 500
            }}>
              {data.type}
            </span>
          )}
        </div>
      )
    }
  }

  if (showRewards) {
    columns.rewards = {
      label: "Rewards",
      flex: 1,
      monospace: true,
      fontSize: '13px',
      fontWeight: '500',
      getValue: (data) => data.rewardValue || '0.00'
    }
  }

  columns.balance = {
    label: "Balance",
    flex: 2,
    monospace: true,
    fontSize: '14px',
    fontWeight: '600',
    highlight: true,
    getValue: (data) => data.formattedPrice || data.totalPrice || '0.00'
  }

  return (
    <DynamicCell
      data={token}
      columns={columns}
      style={{
        marginBottom: isLast ? 0 : 6
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  )
}

// Componente para container de células
const CellContainer = ({
  children,
  style = {},
  title,
  subtitle
}) => {
  const { theme } = useTheme()
  return (
    <div style={{
      backgroundColor: theme.bgPanel,
      padding: '16px 24px',
      margin: '8px 0',
      borderRadius: 8,
      // seguindo direção borderless
      border: 'none',
      ...style
    }}>
      {title && (
        <div style={{
          fontWeight: 600,
          marginBottom: subtitle ? 4 : 12,
          color: theme.textPrimary,
          fontSize: 14
        }}>
          {title}
        </div>
      )}
      {subtitle && (
        <div style={{
          fontSize: 12,
          color: theme.textSecondary,
          marginBottom: 12
        }}>
          {subtitle}
        </div>
      )}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }}>
        {children}
      </div>
    </div>
  )
}

export { DynamicCell, TokenCell, CellContainer }
export default DynamicCell
