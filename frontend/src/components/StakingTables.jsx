import React from 'react'
import { useTheme } from '../context/ThemeProvider'
import { formatPrice, formatTokenAmount } from '../utils/walletUtils'
import { useMaskValues } from '../context/MaskValuesContext'
import TokenDisplay from './TokenDisplay'
import { ratioToColGroup } from '../utils/tableLayout'

// Styled staking tables (Staked / Rewards) similar to PoolTables / LendingTables
export default function StakingTables({ staked = [], rewards = [] }) {
  const { theme } = useTheme(); const { maskValue } = useMaskValues()
  if ((staked?.length || 0) === 0 && (rewards?.length || 0) === 0) return null

  const Section = ({ title, tokens }) => {
    if (!tokens || tokens.length === 0) return null
    return (
  <div style={{ background: theme.tableBg, border: `1px solid ${theme.tableBorder}`, borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', color: theme.textPrimary }}>
          {ratioToColGroup([2,1,1])}
          <thead>
            <tr style={{ backgroundColor: theme.tableHeaderBg, borderBottom: `2px solid ${theme.tableBorder}` }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textSecondary }}>{title}</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textSecondary }}>Amount</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 500, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textSecondary }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t, idx) => (
              <tr key={idx}
                  style={{ borderBottom: idx === tokens.length - 1 ? 'none' : `1px solid ${theme.tableBorder}`, transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.tableRowHoverBg}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                <td style={{ padding: '12px 14px', fontSize: 13, color: theme.textPrimary }}>
                  <TokenDisplay tokens={[t]} size={22} showChain={false} />
                </td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: theme.textPrimary, textAlign: 'right', fontFamily: 'monospace' }}>{maskValue(formatTokenAmount(t), { short: true })}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: theme.textPrimary, textAlign: 'right', fontFamily: 'monospace' }}>{maskValue(formatPrice(parseFloat(t.totalPrice) || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div>
      <Section title="Staked" tokens={staked} />
      <Section title="Rewards" tokens={rewards} />
    </div>
  )
}
