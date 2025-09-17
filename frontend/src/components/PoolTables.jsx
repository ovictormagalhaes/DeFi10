import React, { useState } from 'react'
import { formatPrice, formatTokenAmount } from '../utils/walletUtils'
import { useTheme } from '../context/ThemeProvider'
import { useMaskValues } from '../context/MaskValuesContext'
import TokenDisplay from './TokenDisplay'
import { ratioToColGroup } from '../utils/tableLayout'

// Renders a liquidity pools table with expandable pool rows showing underlying tokens
export default function PoolTables({ pools = {} }) {
  const [openPools, setOpenPools] = useState({})
  const { theme } = useTheme(); const { maskValue } = useMaskValues()

  const togglePool = (key) => setOpenPools(p => ({ ...p, [key]: !p[key] }))

  const poolEntries = Object.entries(pools)
  if (poolEntries.length === 0) return null

  return (
  <div style={{ background: theme.tableBg, border: `1px solid ${theme.tableBorder}`, borderRadius: 10, overflow: 'hidden' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', color: theme.textPrimary }}>
        {ratioToColGroup([2,1,1,1])}
        <thead>
          <tr style={{ backgroundColor: theme.tableHeaderBg, borderBottom: `2px solid ${theme.tableBorder}` }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textSecondary }}>Pool</th>
            <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textSecondary }}>Amount</th>
            <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textSecondary }}>Rewards</th>
            <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textSecondary }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {poolEntries.map(([key, pool], idx) => {
            const isOpen = !!openPools[key]
            const totalRewardsValue = pool.rewards?.reduce((s, r) => s + (parseFloat(r.totalPrice) || 0), 0) || 0
            return (
              <React.Fragment key={key}>
                <tr
                  onClick={() => togglePool(key)}
                  style={{ cursor: 'pointer', borderBottom: `1px solid ${theme.tableBorder}`, transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.tableRowHoverBg}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '12px 14px', fontSize: 13, color: theme.textPrimary, display: 'flex', alignItems: 'center' }}>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        lineHeight: '18px',
                        textAlign: 'center',
                        marginRight: 8,
                        borderRadius: 4,
                        fontFamily: 'inherit',
                        fontSize: 14,
                        opacity: 0.7,
                        userSelect: 'none',
                        display: 'inline-block'
                      }}
                      aria-label={isOpen ? 'Collapse pool' : 'Expand pool'}
                    >{isOpen ? '−' : '+'}</span>
                    {Array.isArray(pool.tokens) && pool.tokens.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <TokenDisplay tokens={pool.tokens.slice(0,2)} size={24} showChain={false} />
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: theme.textPrimary, textAlign: 'right', fontFamily: 'monospace' }}>-</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: theme.textPrimary, textAlign: 'right', fontFamily: 'monospace' }}>{maskValue(formatPrice(totalRewardsValue))}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: theme.textPrimary, textAlign: 'right', fontFamily: 'monospace' }}>{maskValue(formatPrice(pool.totalValue))}</td>
                </tr>
                {isOpen && pool.tokens && pool.tokens.map((t, tIdx) => {
                  const rewardForToken = (pool.rewards || []).filter(r => (r.symbol || '').toLowerCase() === (t.symbol || '').toLowerCase())
                  const rewardValue = rewardForToken.reduce((s, r) => s + (parseFloat(r.totalPrice) || 0), 0)
                  const amountDisplay = formatTokenAmount(t)
                  return (
                    <tr key={tIdx} style={{ borderBottom: `1px solid ${theme.tableBorder}` }}>
                      <td style={{ padding: '10px 34px', fontSize: 12, color: theme.textSecondary, display: 'flex', alignItems: 'center' }}>
                        <TokenDisplay tokens={[t]} size={18} showChain={false} />
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: theme.textPrimary, textAlign: 'right', fontFamily: 'monospace' }}>{maskValue(amountDisplay, { short: true })}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: theme.textPrimary, textAlign: 'right', fontFamily: 'monospace' }}>{rewardValue ? maskValue(formatPrice(rewardValue)) : '-'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: theme.textPrimary, textAlign: 'right', fontFamily: 'monospace' }}>{maskValue(formatPrice(parseFloat(t.totalPrice) || 0))}</td>
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
