import React from 'react'
import { formatPrice, formatTokenAmount } from '../utils/walletUtils'
import { useTheme } from '../context/ThemeProvider'
import { useMaskValues } from '../context/MaskValuesContext'
import TokenDisplay from './TokenDisplay'
import { ratioToColGroup } from '../utils/tableLayout'

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

  // Build a proportional ratio array: token column weight 2, each metric column weight 1.
  const hasAmount = !!showBalanceColumn
  const hasUnitPrice = !!showUnitPriceColumn
  const ratio = [2] // token col
  if (hasAmount) ratio.push(1)
  if (hasUnitPrice) ratio.push(1)
  ratio.push(1) // value col
  // We'll build the colgroup directly from ratio using helper

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', background: theme.tableBg, color: theme.textPrimary }}>
      {ratioToColGroup(ratio)}
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
