import React from 'react'
import CollapsibleMenu from './CollapsibleMenu'
import { formatBalance, formatPrice, getFilteredTokens } from '../utils/walletUtils'
import { useTheme } from '../context/ThemeProvider'
import Chip from './Chip'
import { useMaskValues } from '../context/MaskValuesContext'

const TokensMenu = ({ 
  title, 
  tokens, 
  isExpanded, 
  onToggle, 
  getTotalPortfolioValue,
  calculatePercentage,
  showOptionsMenu = false,
  optionsExpanded,
  toggleOptionsExpanded,
  searchTerm,
  setSearchTerm,
  selectedChains,
  setSelectedChains,
  selectedTokenTypes,
  setSelectedTokenTypes
}) => {
  if (!tokens || tokens.length === 0) return null

  const filteredTokens = getFilteredTokens(tokens, searchTerm, selectedChains, selectedTokenTypes)
  const { maskValue } = useMaskValues()
  
  const totalValue = filteredTokens.reduce((sum, token) => {
    const price = parseFloat(token.totalPrice) || 0
    return sum + (isNaN(price) ? 0 : price)
  }, 0)

  const getTokenColumns = () => ({
    tokens: {
      label: "Tokens",
      value: filteredTokens.length,
      flex: 1
    },
    balance: {
      label: "Balance",
  value: maskValue(formatPrice(totalValue)),
      flex: 2,
      highlight: true
    },
    percentage: {
      label: "%",
  value: calculatePercentage(totalValue, getTotalPortfolioValue()),
      flex: 0.8
    }
  })

  return (
    <CollapsibleMenu
      title={title}
      isExpanded={isExpanded}
      onToggle={onToggle}
      level={0}
      columns={getTokenColumns()}
      showOptionsMenu={showOptionsMenu}
      optionsExpanded={optionsExpanded}
      toggleOptionsExpanded={toggleOptionsExpanded}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      selectedChains={selectedChains}
      setSelectedChains={setSelectedChains}
      selectedTokenTypes={selectedTokenTypes}
      setSelectedTokenTypes={setSelectedTokenTypes}
      tokens={tokens}
    >
      <TokenTable tokens={filteredTokens} />
    </CollapsibleMenu>
  )
}

const TokenTable = ({ tokens }) => {
  const { theme } = useTheme(); const { maskValue } = useMaskValues()
  const headerBg = theme.tableHeaderBg || theme.bgPanelAlt || theme.bgPanel
  const stripeBg = theme.tableStripeBg || (theme.mode === 'light' ? '#f7f9fa' : '#24272f')
  const hoverBg = theme.tableRowHoverBg || (theme.mode === 'light' ? '#ecf0f3' : '#2b2e37')
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ backgroundColor: headerBg }}>
          {['TOKEN','BALANCE','PRICE','VALUE'].map((h, i) => (
            <th key={h}
              style={{
                padding: '10px 16px',
                textAlign: i === 0 ? 'left' : 'right',
                fontWeight: 400,
                color: theme.textSecondary,
                fontSize: 12,
                letterSpacing: '0.4px'
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tokens.map((token, index) => (
          <TokenRow key={index} token={token} index={index} stripeBg={stripeBg} hoverBg={hoverBg} />
        ))}
      </tbody>
    </table>
  )
}

const TokenRow = ({ token, index, stripeBg, hoverBg }) => {
  // Extract token data based on structure (nested or direct)
  const tokenData = token.tokenData?.token || token
  const logo = tokenData.logo || tokenData.logoURI || token.logo || token.logoURI
  const symbol = tokenData.symbol || token.symbol
  const name = tokenData.name || token.name
  const chain = token.chain
  const balance = token.balance || token.tokenData?.balance
  const price = token.price || token.tokenData?.price
  const totalPrice = token.totalPrice

  const { theme } = useTheme()
  const isStriped = index % 2 === 1
  return (
    <tr
      style={{
        backgroundColor: isStriped ? stripeBg : 'transparent',
        transition: 'background-color 0.18s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = hoverBg}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isStriped ? stripeBg : 'transparent'}
    >
      <td style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {logo && (
            <img 
              src={logo} 
              alt={symbol}
              style={{ 
                width: 32, 
                height: 32, 
                marginRight: 12,
                borderRadius: '50%',
                border: `1px solid ${theme.border}`
              }}
              onError={(e) => e.target.style.display = 'none'}
            />
          )}
          <div>
            <div style={{ 
              fontWeight: 600, 
              fontSize: 14,
              color: theme.textPrimary,
              marginBottom: 2
            }}>
              {symbol}
            </div>
            <div style={{ 
              fontSize: 12, 
              color: theme.textSecondary,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>{name}</span>
              {chain && (
                <Chip variant="muted" size="xs" minimal>{chain}</Chip>
              )}
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: '16px 20px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: theme.textPrimary }}>
  {balance ? maskValue(formatBalance(balance), { short: true }) : 'N/A'}
      </td>
      <td style={{ padding: '16px 20px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: theme.textPrimary }}>
  {price ? maskValue(formatPrice(price), { short: true }) : 'N/A'}
      </td>
      <td style={{ padding: '16px 20px', textAlign: 'right', fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>
  {maskValue(formatPrice(totalPrice))}
      </td>
    </tr>
  )
}

export default TokensMenu
