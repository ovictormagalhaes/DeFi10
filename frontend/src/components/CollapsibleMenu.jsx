import React, { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeProvider'

// Componente reutilizável de menu colapsável
function CollapsibleMenu({ 
  title, 
  isExpanded, 
  onToggle, 
  // Nova prop flexível para múltiplas colunas
  columns = {},
  // Props antigas mantidas para compatibilidade (opcionais)
  leftValue, 
  leftLabel,
  middleValue = '', 
  middleLabel = '',
  rightValue, 
  rightLabel,
  children,
  headerActions = null,
  optionsMenu = null,
  isNested = false // Nova prop para indicar se é um menu aninhado
}) {
  const [optionsExpanded, setOptionsExpanded] = useState(false)
  // Internal expand state when parent does not control
  const isControlled = typeof isExpanded === 'boolean'
  const [internalExpanded, setInternalExpanded] = useState(() => {
    if (isControlled) return !!isExpanded
    // Default agora: sempre expandido
    return true
  })
  const expanded = isControlled ? !!isExpanded : internalExpanded
  const { theme } = useTheme()

  // Processar colunas - prioriza o novo formato, fallback para o antigo
  const processedColumns = () => {
    // Se columns está definido e não é vazio, usa o novo formato
    if (Object.keys(columns).length > 0) {
      return columns
    }
    
    // Fallback para formato antigo
    const oldFormat = {}
    if (leftValue !== undefined || leftLabel) {
      oldFormat.left = { 
        label: leftLabel, 
        value: leftValue, 
        flex: 1 
      }
    }
    if (middleValue !== undefined || middleLabel) {
      oldFormat.middle = { 
        label: middleLabel, 
        value: middleValue, 
        flex: 1 
      }
    }
    if (rightValue !== undefined || rightLabel) {
      oldFormat.right = { 
        label: rightLabel, 
        value: rightValue, 
        flex: 1,
        highlight: true // Último valor geralmente é destacado
      }
    }
    return oldFormat
  }

  const finalColumns = processedColumns()

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (optionsExpanded) {
        setOptionsExpanded(false)
      }
    }

    if (optionsExpanded) {
      document.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [optionsExpanded])

  const basePadding = '10px 14px'
  const labelFontSize = '12px'
  const titleFontSize = '16px'
  const valueFontSize = '14px'
  const valueFontSizeHighlight = '15px'

  return (
    <div style={{ marginTop: 12, marginBottom: 12 }}>
      {/* Collapsible Header */}
      <div 
        style={{ 
          backgroundColor: expanded ? (theme.bgPanelAlt || theme.tableHeaderBg || theme.bgPanel) : 'transparent',
          padding: basePadding, 
          borderRadius: expanded ? '8px 8px 0 0' : '8px',
          border: `1px solid ${theme.tableBorder || theme.border}`,
          borderBottom: expanded ? 'none' : `1px solid ${theme.tableBorder || theme.border}`,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background-color 0.25s, border-color 0.25s'
        }}
        onClick={(e) => {
          if (onToggle) {
            onToggle(e)
          } else {
            setInternalExpanded(v => !v)
          }
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = expanded
            ? (theme.tableHeaderBg || theme.bgPanelAlt || e.currentTarget.style.backgroundColor)
            : (theme.tableHeaderBg || theme.bgPanelAlt || e.currentTarget.style.backgroundColor)
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = expanded
            ? (theme.bgPanelAlt || theme.tableHeaderBg || theme.bgPanel)
            : (theme.bgPanel || theme.tableBg)
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          {/* Título (lado esquerdo - cresce conforme necessário). Removido indicador aberto/fechado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '140px' }}>
            <span style={{ fontWeight: 'bold', fontSize: titleFontSize, color: theme.textPrimary }}>{title}</span>
          </div>

          {/* Container dos valores - flexível baseado no número de colunas */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
            {Object.entries(finalColumns).map(([key, column]) => {
              const isHighlighted = column.highlight || false
              const flexValue = column.flex || 1
              
              return (
                <div key={key} style={{ 
                  flex: `${flexValue} 1 0%`, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  padding: '0 8px',
                  overflow: 'hidden',
                  minWidth: 0
                }}>
                  {column.label && (
                    <div style={{ 
                      fontWeight: 'bold', 
                      color: isHighlighted ? theme.textPrimary : theme.textSecondary, 
                      fontSize: labelFontSize, 
                      marginBottom: '2px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: '100%'
                    }}>
                      {column.label}
                    </div>
                  )}
                  {column.value !== undefined && column.value !== null && column.value !== '' && (
                    <div style={{ 
                      fontFamily: 'monospace', 
                      fontWeight: isHighlighted ? 'bold' : 600, 
                      fontSize: isHighlighted ? valueFontSizeHighlight : valueFontSize, 
                      color: isHighlighted ? theme.textPrimary : theme.textSecondary,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: '100%',
                      background: isHighlighted ? (theme.primarySubtle || 'transparent') : 'transparent',
                      borderRadius: 6,
                      padding: isHighlighted ? '2px 6px' : '0'
                    }}>
                      {column.value}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Coluna de Opções - largura fixa, sempre presente para manter alinhamento */}
          <div style={{ 
            width: '28px', 
            minWidth: '28px',
            display: 'flex', 
            justifyContent: 'right', 
            alignItems: 'right', 
            position: 'relative' 
          }}>
            {optionsMenu && (
              <>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOptionsExpanded(!optionsExpanded)
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.bgInteractiveHover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="5" r="2" fill={theme.textSecondary}/>
                    <circle cx="12" cy="12" r="2" fill={theme.textSecondary}/>
                    <circle cx="12" cy="19" r="2" fill={theme.textSecondary}/>
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {optionsExpanded && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      backgroundColor: theme.bgPanel,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '8px',
                      // shadow removed per request
                      boxShadow: 'none',
                      padding: '8px 0',
                      minWidth: '200px',
                      zIndex: 1000
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {optionsMenu}
                  </div>
                )}
              </>
            )}
            {/* Espaço vazio quando não há optionsMenu, mantém o layout consistente */}
          </div>
        </div>
      </div>
      
      {/* Header Actions (como configurações) */}
  {expanded && headerActions && (
        <div style={{ 
          backgroundColor: 'transparent', 
          padding: basePadding, 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center',
          transition: 'background-color 0.25s'
        }}>
          {headerActions}
        </div>
      )}
      
      {/* Collapsible Content */}
      {expanded && (
        <div style={{ paddingLeft: isNested ? '8px' : '0', paddingRight: isNested ? '8px' : '0', background: 'transparent' }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default CollapsibleMenu
