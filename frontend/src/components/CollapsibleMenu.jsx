import React, { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeProvider'

// Componente reutilizável de menu colapsável
function CollapsibleMenu({ 
  title, 
  isExpanded, 
  onToggle, 
  // Colunas (mantidas para compat) agora renderizadas como linha de resumo dentro do card
  columns = {},
  // Props antigas (fallback)
  leftValue, 
  leftLabel,
  middleValue = '', 
  middleLabel = '',
  rightValue, 
  rightLabel,
  children,
  headerActions = null,
  optionsMenu = null,
  isNested = false,
  // Novo: permitir desabilitar a barra de resumo
  showSummary = true,
  // Novo: estilo do card (p/ futuras variações)
  variant = 'card'
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
  const titleFontSize = '16px'

  // Helper para montar segmentos inline a partir das colunas
  const buildSummarySegments = () => {
    const entries = Object.entries(finalColumns)
    if (!entries.length) return []
    return entries.map(([key, col]) => {
      const pieces = []
      if (col.label && col.value !== undefined && col.value !== null && col.value !== '') {
        pieces.push(`${col.label}: ${col.value}`)
      } else if (col.label && (col.value === undefined || col.value === null || col.value === '')) {
        pieces.push(col.label)
      } else if (!col.label && col.value !== undefined && col.value !== null && col.value !== '') {
        pieces.push(String(col.value))
      }
      return { key, text: pieces.join(' '), highlight: !!col.highlight }
    }).filter(s => s.text)
  }

  const summarySegments = buildSummarySegments()

  // Reordena segmentos (sem alterar valores) para: % | Tokens | $ | outros (sem separadores visuais automáticos)
  const orderedSummarySegments = (() => {
    if (!summarySegments.length) return []
    const percent = []
    const tokens = []
    const dollars = []
    const others = []
    summarySegments.forEach(seg => {
      const txt = seg.text || ''
      if (/%/.test(txt) && !/tokens?/i.test(txt)) percent.push(seg)
      else if (/tokens?/i.test(txt)) tokens.push(seg)
      else if (/\$/.test(txt)) dollars.push(seg)
      else others.push(seg)
    })
    return [...percent, ...tokens, ...dollars, ...others]
  })()

  return (
    <div style={{ marginTop: 12, marginBottom: 12 }}>
      {/* Card Container */}
      <div style={{
        border: `1px solid ${theme.tableBorder || theme.border}`,
        borderRadius: 10,
        background: theme.bgPanelAlt || theme.bgPanel,
        overflow: 'hidden',
        transition: 'border-color .25s, background-color .25s'
      }}>
        {/* Header apenas com título + toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: basePadding,
            cursor: 'pointer',
            userSelect: 'none'
          }}
          onClick={(e) => {
            if (onToggle) onToggle(e)
            else setInternalExpanded(v => !v)
          }}
        >
          <span style={{ fontWeight: 'bold', fontSize: titleFontSize, color: theme.textPrimary }}>{title}</span>
          <span style={{ fontSize: 13, fontFamily: 'monospace', color: theme.textSecondary }}>
            {expanded ? 'Hide -' : 'Show +'}
          </span>
        </div>

        {/* Linha de resumo (sempre visível para dar cara de card) */}
        {showSummary && orderedSummarySegments.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'nowrap',
            gap: 12,
            padding: '4px 14px 8px 14px',
            borderTop: `1px solid ${theme.tableBorder || theme.border}`,
            fontSize: 13,
            background: expanded ? 'transparent' : (theme.bgPanel || 'transparent'),
            opacity: expanded ? 1 : 0.8
          }}>
            <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
              {orderedSummarySegments.map((seg, idx) => (
                <span key={seg.key} style={{
                  color: seg.highlight ? theme.textPrimary : theme.textSecondary,
                  fontWeight: seg.highlight ? 600 : 500,
                  background: seg.highlight ? (theme.primarySubtle || 'transparent') : 'transparent',
                  padding: seg.highlight ? '2px 6px' : 0,
                  borderRadius: 6,
                  whiteSpace: 'nowrap'
                }}>
                  {idx === 0 ? `-${seg.text}` : seg.text}
                </span>
              ))}
            </div>
            {optionsMenu && (
              <div style={{ position: 'relative' }}>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.textSecondary,
                    cursor: 'pointer',
                    padding: '2px 6px',
                    fontSize: 12,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  onClick={(e) => { e.stopPropagation(); setOptionsExpanded(o => !o) }}
                >
                  Options
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="5" r="2" fill={theme.textSecondary}/>
                    <circle cx="12" cy="12" r="2" fill={theme.textSecondary}/>
                    <circle cx="12" cy="19" r="2" fill={theme.textSecondary}/>
                  </svg>
                </button>
                {optionsExpanded && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      background: theme.bgPanel,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 8,
                      padding: '8px 0',
                      minWidth: 200,
                      zIndex: 50
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {optionsMenu}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Header actions posicionados após resumo (se houver) */}
        {expanded && headerActions && (
          <div style={{
            padding: '4px 14px 8px 14px',
            borderTop: `1px solid ${theme.tableBorder || theme.border}`,
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            {headerActions}
          </div>
        )}

        {/* Conteúdo colapsável */}
        {expanded && (
          <div style={{
            padding: isNested ? '0 8px 8px 8px' : '0 14px 14px 14px',
            background: 'transparent'
          }}>
            {children}
          </div>
        )}
      </div>
      
    </div>
  )
}

export default CollapsibleMenu
