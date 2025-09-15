import React from 'react'
import { formatPrice, formatTokenAmount } from '../utils/walletUtils'
import { useTheme } from '../context/ThemeProvider'
import { useMaskValues } from '../context/MaskValuesContext'
import TokenDisplay from './TokenDisplay'

// Generate a stable unique key for a token row, combining address + chain when available.
function deriveTokenKey(token, index) {
  if (!token) return `tok-${index}`
  const addr = (token.contractAddress || token.tokenAddress || token.address || '').toLowerCase()
  const chain = (token.chainId || token.chainID || token.chain || token.networkId || token.network || token.chainName || '').toString().toLowerCase()
  if (addr) return `${addr}${chain ? `-${chain}` : ''}`
  // Some native tokens may share the placeholder (e.g., 0xeeee...) so disambiguate by symbol+index
  const symbol = (token.symbol || '').toLowerCase()
  const name = (token.name || '').toLowerCase()
  return `${symbol || name || 'token'}-${index}`
}

// Wallet tokens table styled similar to PoolTables (Uniswap style)
export default function WalletTokensTable({ tokens = [], showBalanceColumn = true, showUnitPriceColumn = true }) {
  if (!tokens || tokens.length === 0) return null
  const { theme } = useTheme()
  const { maskValue, maskValues } = useMaskValues()

  // Decide proportional widths based on visible columns
  const hasAmount = !!showBalanceColumn
  const hasUnitPrice = !!showUnitPriceColumn
  const totalCols = 1 + (hasAmount ? 1 : 0) + (hasUnitPrice ? 1 : 0) + 1 // token + optional + value
  let nameWidth = '46%'
  let otherWidth = '18%'
  if (totalCols === 3) { // name + one optional + value
    nameWidth = '50%'
    otherWidth = '25%'
  } else if (totalCols === 2) { // name + value
    nameWidth = '60%'
    otherWidth = '40%'
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', background: theme.tableBg, color: theme.textPrimary }}>
      <colgroup>
        <col style={{ width: nameWidth }} />
        {hasAmount && <col style={{ width: otherWidth }} />}
        {hasUnitPrice && <col style={{ width: otherWidth }} />}
        <col style={{ width: otherWidth }} />
      </colgroup>
      <thead>
        <tr style={{ backgroundColor: theme.tableHeaderBg, borderBottom: `2px solid ${theme.tableBorder}` }}>
          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, letterSpacing: 0.5, fontSize: 11, textTransform: 'uppercase', color: theme.textSecondary }}>Token</th>
          {showBalanceColumn && <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, letterSpacing: 0.5, fontSize: 11, textTransform: 'uppercase', color: theme.textSecondary }}>Amount</th>}
          {showUnitPriceColumn && <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, letterSpacing: 0.5, fontSize: 11, textTransform: 'uppercase', color: theme.textSecondary }}>Price</th>}
          <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, letterSpacing: 0.5, fontSize: 11, textTransform: 'uppercase', color: theme.textSecondary }}>Value</th>
        </tr>
      </thead>
      <tbody>
        {tokens.map((tokenData, index) => {
          const token = tokenData.token || tokenData
          const key = deriveTokenKey(token, index)
          return (
            <tr key={key}
                style={{ borderBottom: index === tokens.length - 1 ? 'none' : `1px solid ${theme.tableBorder}`, transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.tableRowHoverBg}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
              <td style={{ padding: '12px 14px', fontSize: 13, color: theme.textPrimary }}>
                <TokenDisplay tokens={[token]} />
              </td>
              {showBalanceColumn && (
                <td style={{ padding: '12px 14px', fontSize: 13, color: theme.textPrimary, textAlign: 'right', fontFamily: 'monospace' }}>
                  {maskValue(formatTokenAmount(token), { short: true })}
                </td>
              )}
              {showUnitPriceColumn && (
                <td style={{ padding: '12px 14px', fontSize: 13, color: theme.textPrimary, textAlign: 'right', fontFamily: 'monospace' }}>
                  {maskValue(formatPrice(token.price), { short: true })}
                </td>
              )}
              <td style={{ padding: '12px 14px', fontSize: 13, color: theme.textPrimary, textAlign: 'right', fontFamily: 'monospace' }}>
                {maskValue(formatPrice(token.totalPrice))}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
