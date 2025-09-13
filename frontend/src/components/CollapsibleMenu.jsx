import React, { useEffect, useState } from 'react'

// Componente reutilizável de menu colapsível
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
  isNested = false, // Nova prop para indicar se é um menu aninhado
  level = 0 // Nova prop para indicar o nível hierárquico (0=root, 1=sub, 2=sub-sub, etc.)
}) {
  const [optionsExpanded, setOptionsExpanded] = useState(false)
  // Internal expand state when parent does not control
  const isControlled = typeof isExpanded === 'boolean'
  const [internalExpanded, setInternalExpanded] = useState(() => {
    if (isControlled) return !!isExpanded
    // Default: level 0 starts collapsed, deeper levels start expanded
    return level === 0 ? false : true
  })
  const expanded = isControlled ? !!isExpanded : internalExpanded

  // Calcula o tamanho da fonte baseado no level
  const getFontSize = (level) => {
    switch(level) {
      case 0: return '16px' // Root menu - mais compacto
      case 1: return '14px'
      case 2: return '13px'
      case 3: return '12px'
      default: return '11px'
    }
  }

  // Calcula o tamanho da fonte para labels baseado no level
  const getLabelFontSize = (level) => {
    switch(level) {
      case 0: return '12px'
      case 1: return '11px'
      case 2: return '10px'
      case 3: return '10px'
      default: return '9px'
    }
  }

  // Calcula o tamanho da fonte para valores baseado no level
  const getValueFontSize = (level, isHighlighted = false) => {
    const baseSize = {
      0: isHighlighted ? '15px' : '14px',
      1: isHighlighted ? '14px' : '13px',
      2: isHighlighted ? '13px' : '12px',
      3: isHighlighted ? '12px' : '11px',
    }
    return baseSize[level] || (isHighlighted ? '11px' : '10px')
  }

  // Calcula o padding baseado no level
  const getPadding = (level) => {
    switch(level) {
      case 0: return '10px 14px'
      case 1: return '8px 12px'
      case 2: return '6px 10px'
      case 3: return '5px 8px'
      default: return '4px 6px'
    }
  }

  // Calcula o margin baseado no level
  const getMargin = (level) => {
    switch(level) {
      case 0: return { marginTop: 12, marginBottom: 12 }
      case 1: return { marginTop: 8, marginBottom: 8 }
      case 2: return { marginTop: 6, marginBottom: 6 }
      case 3: return { marginTop: 4, marginBottom: 4 }
      default: return { marginTop: 3, marginBottom: 3 }
    }
  }

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

  return (
    <div style={{ 
      ...getMargin(level),
      marginLeft: isNested ? '0px' : '0',
      paddingLeft: isNested ? '0px' : '0',
      marginRight: isNested ? '0px' : '0',
      paddingRight: isNested ? '0px' : '0'
    }}>
      {/* Collapsible Header */}
      <div 
        style={{ 
          backgroundColor: 'white', 
          padding: getPadding(level), 
          borderRadius: expanded ? '8px 8px 0 0' : '8px',
          border: '1px solid #dee2e6',
          borderBottom: expanded ? 'none' : '1px solid #dee2e6',
          cursor: 'pointer',
          userSelect: 'none',
          boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
        }}
        onClick={(e) => {
          if (onToggle) {
            onToggle(e)
          } else {
            setInternalExpanded(v => !v)
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          {/* Título (lado esquerdo - cresce conforme necessário). Removido indicador aberto/fechado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '140px' }}>
            <span style={{ fontWeight: 'bold', fontSize: getFontSize(level), color: '#333333' }}>{title}</span>
          </div>

          {/* Container dos valores - flexível baseado no número de colunas */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
            {Object.entries(finalColumns).map(([key, column], index) => {
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
                      color: isHighlighted ? '#333333' : '#555555', 
                      fontSize: getLabelFontSize(level), 
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
                      fontWeight: isHighlighted ? 'bold' : '600', 
                      fontSize: getValueFontSize(level, isHighlighted), 
                      color: isHighlighted ? '#212529' : '#333333',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      width: '100%'
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
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setOptionsExpanded(!optionsExpanded)
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f0f0'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="5" r="2" fill="#333333"/>
                    <circle cx="12" cy="12" r="2" fill="#333333"/>
                    <circle cx="12" cy="19" r="2" fill="#333333"/>
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {optionsExpanded && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #dee2e6',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
          backgroundColor: '#f8f9fa', 
          padding: getPadding(level), 
          borderLeft: '1px solid #dee2e6',
          borderRight: '1px solid #dee2e6',
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center' 
        }}>
          {headerActions}
        </div>
      )}
      
      {/* Collapsible Content */}
      {expanded && (
        <div style={{
          paddingLeft: isNested ? `${4 + (level * 4)}px` : '0',
          paddingRight: isNested ? `${4 + (level * 4)}px` : '0'
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default CollapsibleMenu
