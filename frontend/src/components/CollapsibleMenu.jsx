import React, { useEffect, useState } from 'react'

// Componente reutilizável de menu colapsível
function CollapsibleMenu({ 
  title, 
  isExpanded, 
  onToggle, 
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

  // Calcula o tamanho da fonte baseado no level
  const getFontSize = (level) => {
    switch(level) {
      case 0: return '18px' // Root menu - maior
      case 1: return '16px' // Sub menu 
      case 2: return '14px' // Sub-sub menu
      case 3: return '13px' // Sub-sub-sub menu
      default: return '12px' // Níveis mais profundos
    }
  }

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
      marginTop: 20,
      marginBottom: 20,
      marginLeft: isNested ? '0px' : '0',
      paddingLeft: isNested ? '0px' : '0',
      marginRight: isNested ? '0px' : '0',
      paddingRight: isNested ? '0px' : '0'
    }}>
      {/* Collapsible Header */}
      <div 
        style={{ 
          backgroundColor: 'white', 
          padding: '12px 20px', 
          borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
          border: '1px solid #dee2e6',
          borderBottom: isExpanded ? 'none' : '1px solid #dee2e6',
          cursor: 'pointer',
          userSelect: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          {/* Título com ícone (lado esquerdo - cresce conforme necessário) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
            <svg 
              style={{ 
                width: '16px', 
                height: '16px', 
                transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.2s ease'
              }} 
              viewBox="0 0 16 16" 
              fill="none"
            >
              <path d="M4 6L8 10L12 6" stroke="#333333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontWeight: 'bold', fontSize: getFontSize(level), color: '#333333' }}>{title}</span>
          </div>

          {/* Container dos valores - dividido em 3 seções iguais aproveitando espaço máximo */}
          <div style={{ display: 'flex', flex: 1, minWidth: 0 }}>
            {/* Seção Left - 1/3 do espaço disponível */}
            <div style={{ 
              flex: '1 1 33.333%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              padding: '0 8px',
              overflow: 'hidden',
              minWidth: 0
            }}>
              {leftLabel && (
                <div style={{ 
                  fontWeight: 'bold', 
                  color: '#555555', 
                  fontSize: '14px', 
                  marginBottom: '4px',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {leftLabel}
                </div>
              )}
              {leftValue !== undefined && leftValue !== null && leftValue !== '' && (
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontWeight: 'bold', 
                  fontSize: '16px', 
                  color: '#333333',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {leftValue}
                </div>
              )}
            </div>

            {/* Seção Middle - 1/3 do espaço disponível */}
            <div style={{ 
              flex: '1 1 33.333%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              padding: '0 8px',
              overflow: 'hidden',
              minWidth: 0
            }}>
              {middleLabel && (
                <div style={{ 
                  fontWeight: 'bold', 
                  color: '#555555', 
                  fontSize: '14px', 
                  marginBottom: '4px',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {middleLabel}
                </div>
              )}
              {middleValue !== undefined && middleValue !== null && middleValue !== '' && (
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontWeight: 'bold', 
                  fontSize: '16px', 
                  color: '#333333',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {middleValue}
                </div>
              )}
            </div>

            {/* Seção Right - 1/3 do espaço disponível */}
            <div style={{ 
              flex: '1 1 33.333%', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              padding: '0 8px',
              overflow: 'hidden',
              minWidth: 0
            }}>
              {rightLabel && (
                <div style={{ 
                  fontWeight: 'bold', 
                  color: '#555555', 
                  fontSize: '14px', 
                  marginBottom: '4px',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {rightLabel}
                </div>
              )}
              {rightValue !== undefined && rightValue !== null && rightValue !== '' && (
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontWeight: 'bold', 
                  fontSize: '16px', 
                  color: '#333333',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%'
                }}>
                  {rightValue}
                </div>
              )}
            </div>
          </div>

          {/* Coluna de Opções - largura fixa, sempre presente */}
          <div style={{ width: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            {optionsMenu ? (
              <>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
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
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
            ) : null}
          </div>
        </div>
      </div>
      
      {/* Header Actions (como configurações) */}
      {isExpanded && headerActions && (
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '8px 20px', 
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
      {isExpanded && (
        <div style={{
          paddingLeft: isNested ? '8px' : '0',
          paddingRight: isNested ? '8px' : '0'
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

export default CollapsibleMenu
