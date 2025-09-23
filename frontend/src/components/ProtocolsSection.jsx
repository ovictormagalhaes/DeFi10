import React from 'react'
import SectionTable from './SectionTable'
import PoolTables from './PoolTables'
import LendingTables from './LendingTables'
import StakingTables from './StakingTables'
import ProtocolTables from './ProtocolTables'
import { useChainIcons } from '../context/ChainIconsProvider'
import {
  formatPrice,
  groupDefiByProtocol,
  groupTokensByPool,
  groupTokensByType,
  groupStakingTokensByType
} from '../utils/walletUtils'

const ProtocolsSection = ({
  getLiquidityPoolsData,
  getLendingAndBorrowingData,
  getStakingData,
  selectedChains,
  isAllChainsSelected,
  getCanonicalFromObj,
  filterLendingDefiTokens,
  filterStakingDefiTokens,
  showLendingDefiTokens,
  showStakingDefiTokens,
  setShowLendingDefiTokens,
  setShowStakingDefiTokens,
  protocolExpansions,
  toggleProtocolExpansion,
  calculatePercentage,
  getTotalPortfolioValue,
  maskValue,
  theme
}) => {
  const { getIcon } = useChainIcons()
  const allDefi = [
    ...getLiquidityPoolsData(),
    ...getLendingAndBorrowingData(),
    ...getStakingData()
  ]

  if (allDefi.length === 0) return null

  const protocolGroups = groupDefiByProtocol(allDefi)

  return (
    <div>
      {protocolGroups.map((protocolGroup, pgIdx) => {
        // Classify positions by type using label/name heuristics
        const liqPositionsOriginal = protocolGroup.positions.filter(p => {
          const lbl = (p.position?.label || p.position?.name || p.label || '').toString().toLowerCase()
          return lbl.includes('liquidity')
        })
        const stakingPositionsOriginal = protocolGroup.positions.filter(p => {
          const lbl = (p.position?.label || p.position?.name || p.label || '').toString().toLowerCase()
          return lbl.includes('staking')
        })
        const lendingPositionsOriginal = protocolGroup.positions.filter(p => {
          const lbl = (p.position?.label || p.position?.name || p.label || '').toString().toLowerCase()
          return !lbl.includes('liquidity') && !lbl.includes('staking')
        })

        // Helper to filter tokens inside a position according to selected chains.
        // A position matches selection if its own chain OR any token chain is selected
        const positionMatchesSelection = (pos) => {
          if (!selectedChains || isAllChainsSelected) return true
          const container = pos.position || pos
          const chainSelf = getCanonicalFromObj(container) || getCanonicalFromObj(pos)
          if (chainSelf && selectedChains.has(chainSelf)) return true
          const toks = Array.isArray(container.tokens) ? container.tokens : []
          for (let i = 0; i < toks.length; i++) {
            const tc = getCanonicalFromObj(toks[i]) || chainSelf
            if (tc && selectedChains.has(tc)) return true
          }
          return false
        }

        // Filter tokens within positions but keep the position if it still matches selection
        const filterPositionArray = (positions) => {
          if (!positions || positions.length === 0) return []
          return positions
            .filter(p => positionMatchesSelection(p))
            .map(p => {
              if (!selectedChains || isAllChainsSelected) return p
              const cloned = p.position ? { ...p, position: { ...p.position } } : { ...p }
              const container = cloned.position || cloned
              const tokensArr = Array.isArray(container.tokens) ? container.tokens : []
              const filteredTokens = tokensArr.filter(t => {
                const canon = getCanonicalFromObj(t) || getCanonicalFromObj(container) || getCanonicalFromObj(p)
                return canon && selectedChains.has(canon)
              })
              if (container.tokens) container.tokens = filteredTokens
              return cloned
            })
        }

        // If selection active and protocol has no positions matching, skip early
        if (selectedChains && !isAllChainsSelected) {
          const anyMatch = protocolGroup.positions.some(pos => positionMatchesSelection(pos))
          if (!anyMatch) return null
        }

        const liqPositions = filterPositionArray(liqPositionsOriginal)
        const stakingPositions = filterPositionArray(stakingPositionsOriginal)
        const lendingPositions = filterPositionArray(lendingPositionsOriginal)

        // If after filtering everything vanished (should be rare now), still skip.
        if (!liqPositions.length && !stakingPositions.length && !lendingPositions.length) return null

        // Compute protocol total balance (lending borrowed negative)
        const liquidityTotal = liqPositions.reduce((sum, pos) => {
          const container = pos.position || pos
          return sum + (container.tokens?.reduce((s, t) => s + (parseFloat(t.totalPrice) || 0), 0) || 0)
        }, 0)
        const lendingTotal = lendingPositions.reduce((sum, pos) => {
          const tokens = Array.isArray(pos.tokens) ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens) : []
          const net = tokens.reduce((s, t) => {
            const ty = (t.type || '').toLowerCase()
            const val = Math.abs(parseFloat(t.totalPrice) || 0)
            if (ty === 'borrowed' || ty === 'borrow' || ty === 'debt') return s - val
            if (!ty) {
              const lbl = (pos?.position?.label || pos?.label || '').toLowerCase()
              if (lbl.includes('borrow') || lbl.includes('debt')) return s - val
            }
            return s + val
          }, 0)
          return sum + net
        }, 0)
        const stakingTotal = stakingPositions.reduce((sum, pos) => {
          const tokens = Array.isArray(pos.tokens) ? filterStakingDefiTokens(pos.tokens, showStakingDefiTokens) : []
          const v = tokens.reduce((s, t) => s + (parseFloat(t.totalPrice) || 0), 0)
          return sum + v
        }, 0)
        const protocolTotal = liquidityTotal + lendingTotal + stakingTotal

        // Build tables for this protocol
        const tables = []

        let poolsGrouped = null
        let liquidityRewardsValue = 0
        if (liqPositions.length > 0) {
          poolsGrouped = groupTokensByPool(liqPositions)
          // Calculate total rewards value from liquidity positions
          liqPositions.forEach(pos => {
            if (pos.tokens && Array.isArray(pos.tokens)) {
              pos.tokens.forEach(token => {
                const t = (token.type || '').toLowerCase()
                const sym = (token.symbol || '').toLowerCase()
                const name = (token.name || '').toLowerCase()
                const isReward = t === 'reward' || t === 'rewards' ||
                                sym.includes('reward') || name.includes('reward') ||
                                sym.includes('comp') || sym.includes('crv') ||
                                sym.includes('cake') || sym.includes('uni')
                if (isReward) {
                  liquidityRewardsValue += parseFloat(token.totalPrice) || 0
                }
              })
            }
          })
        }

        let lendingGroup = null
        let lendingRewardsValue = 0
        if (lendingPositions.length > 0) {
          const filtered = lendingPositions.map(p => ({ ...p, tokens: Array.isArray(p.tokens) ? filterLendingDefiTokens(p.tokens, showLendingDefiTokens) : [] }))
          const grouped = groupTokensByType(filtered)
          lendingGroup = {
            supplied: grouped.supplied || [],
            borrowed: grouped.borrowed || [],
            rewards: grouped.rewards || []
          }
          // Calculate total rewards value from lending positions
          lendingRewardsValue = lendingGroup.rewards.reduce((sum, token) => sum + (parseFloat(token.totalPrice) || 0), 0)
        }

        let stakingGroup = null
        let stakingRewardsValue = 0
        if (stakingPositions.length > 0) {
          const filtered = stakingPositions.map(p => ({ ...p, tokens: Array.isArray(p.tokens) ? filterStakingDefiTokens(p.tokens, showStakingDefiTokens) : [] }))
          const grouped = groupStakingTokensByType(filtered)
          stakingGroup = {
            staked: grouped.staked || [],
            rewards: grouped.rewards || []
          }
          // Calculate total rewards value from staking positions
          stakingRewardsValue = stakingGroup.rewards.reduce((sum, token) => sum + (parseFloat(token.totalPrice) || 0), 0)
        }

        // Resolve chain icon to overlay
        const resolveChainRaw = (obj) => {
          if (!obj || typeof obj !== 'object') return undefined
          const direct = obj.chainId || obj.chainID || obj.chain_id || obj.chain || obj.networkId || obj.network || obj.chainName
          if (direct) return direct
          const p = obj.protocol
          if (p && typeof p === 'object') {
            return p.chainId || p.chainID || p.chain || p.networkId || p.network || p.chainName
          }
          for (const k in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, k)) continue
            if (/(chain|network)/i.test(k)) {
              const v = obj[k]
              if (v && (typeof v === 'string' || typeof v === 'number')) return v
            }
          }
          return undefined
        }
        const firstPos = protocolGroup?.positions?.[0] || null
        const basePos = firstPos && (firstPos.position || firstPos)
        let chainRaw = resolveChainRaw(protocolGroup?.protocol) || resolveChainRaw(basePos)
        if (!chainRaw && basePos && Array.isArray(basePos?.tokens)) {
          for (let i = 0; i < basePos.tokens.length; i++) {
            const c = resolveChainRaw(basePos.tokens[i])
            if (c) { chainRaw = c; break }
          }
        }
        const chainIcon = chainRaw ? getIcon(chainRaw) : undefined

        const icon = (protocolGroup.protocol.logoURI || protocolGroup.protocol.logo)
          ? (
            <div style={{ position: 'relative', width: 22, height: 22 }}>
              <img
                src={protocolGroup.protocol.logoURI || protocolGroup.protocol.logo}
                alt={protocolGroup.protocol.name}
                style={{ width: 22, height: 22, borderRadius: '50%', border: `1px solid ${theme.border}`, display: 'block' }}
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
              {chainIcon && (
                <img
                  src={chainIcon}
                  alt="chain"
                  style={{ position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: '50%', border: `1px solid ${theme.border}`, background: theme.bgPanel }}
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
            </div>
          )
          : null

        const protocolPercent = calculatePercentage(protocolTotal, getTotalPortfolioValue())
        const totalRewardsValue = liquidityRewardsValue + lendingRewardsValue + stakingRewardsValue
        const infoBadges = [
          liqPositions.length > 0 ? `Pools: ${Object.keys(poolsGrouped || {}).length}` : null,
          lendingPositions.length > 0 ? `Lending: ${lendingPositions.length}` : null,
          stakingPositions.length > 0 ? `Staking: ${stakingPositions.length}` : null
        ].filter(Boolean).join('  •  ')
        const optionsMenu = (
          <div style={{ padding: '6px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={showLendingDefiTokens} onChange={(e) => setShowLendingDefiTokens(e.target.checked)} />
              Show internal lending tokens
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={showStakingDefiTokens} onChange={(e) => setShowStakingDefiTokens(e.target.checked)} />
              Show internal staking tokens
            </label>
          </div>
        )
        // Decide layout AFTER we know which table(s) will render
        const hasPools = !!(poolsGrouped && Object.keys(poolsGrouped).length > 0)
        const hasLending = !!(lendingGroup && (lendingGroup.supplied.length > 0 || lendingGroup.borrowed.length > 0 || lendingGroup.rewards.length > 0))
        const hasStaking = !!(stakingGroup && (stakingGroup.staked.length > 0 || stakingGroup.rewards.length > 0))
        // Pools: 5 cols (Pool|Range|Amount|Rewards|Value), Lending/Staking: 3 cols ([2,1,1])
        const metricsRatio = hasPools ? [2,1,1,1,1] : [2,1,1]

        // Summary row schema mirrors the visible table for pools
        const poolSummaryColumns = hasPools
          ? [
              { key: 'pool', label: 'Pool', align: 'left', width: '33.333%' },
              { key: 'range', label: 'Range', align: 'center', width: '16.667%' },
              { key: 'amount', label: 'Amount', align: 'right', width: '16.667%' },
              { key: 'rewards', label: 'Rewards', align: 'right', width: '16.667%' },
              { key: 'value', label: 'Value', align: 'right', width: '16.667%' }
            ]
          : null
        const renderPoolSummaryCell = (col) => {
          if (col.key === 'pool') {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ border: `1px solid ${theme.border}`, padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>{protocolPercent}</span>
                {infoBadges && (
                  <span style={{ border: `1px solid ${theme.border}`, padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>{infoBadges}</span>
                )}
              </div>
            )
          }
          if (col.key === 'rewards') {
            return totalRewardsValue > 0 ? maskValue(formatPrice(totalRewardsValue)) : null
          }
          if (col.key === 'value') {
            return maskValue(formatPrice(protocolTotal))
          }
          return null
        }

        // Lending/Staking summary (no Rewards column): [2,1,1]
        const lendingSummaryColumns = (!hasPools && (hasLending || hasStaking))
          ? [
              { key: 'title', label: 'Title', align: 'left', width: '66.667%' },
              { key: 'amount', label: 'Amount', align: 'right', width: '16.667%' },
              { key: 'value', label: 'Value', align: 'right', width: '16.667%' }
            ]
          : null
        const renderLendingSummaryCell = (col) => {
          if (col.key === 'title') {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ border: `1px solid ${theme.border}`, padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>{protocolPercent}</span>
                {infoBadges && (
                  <span style={{ border: `1px solid ${theme.border}`, padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>{infoBadges}</span>
                )}
              </div>
            )
          }
          if (col.key === 'value') {
            return maskValue(formatPrice(protocolTotal))
          }
          return null
        }

        return (
          <SectionTable
            key={protocolGroup.protocol.name}
            icon={icon}
            title={protocolGroup.protocol.name}
            transparentBody={true}
            summaryColumns={poolSummaryColumns || lendingSummaryColumns}
            renderSummaryCell={(poolSummaryColumns ? renderPoolSummaryCell : (lendingSummaryColumns ? renderLendingSummaryCell : undefined))}
            isExpanded={protocolExpansions[protocolGroup.protocol.name] !== undefined ? protocolExpansions[protocolGroup.protocol.name] : true}
            onToggle={() => toggleProtocolExpansion(protocolGroup.protocol.name)}
            infoBadges={infoBadges}
            optionsMenu={optionsMenu}
            customContent={
              <>
                {poolsGrouped && Object.keys(poolsGrouped).length > 0 && (
                  <PoolTables pools={poolsGrouped} />
                )}
                {lendingGroup && (lendingGroup.supplied.length > 0 || lendingGroup.borrowed.length > 0 || lendingGroup.rewards.length > 0) && (
                  <LendingTables supplied={lendingGroup.supplied} borrowed={lendingGroup.borrowed} rewards={lendingGroup.rewards} />
                )}
                {stakingGroup && (stakingGroup.staked.length > 0 || stakingGroup.rewards.length > 0) && (
                  <StakingTables staked={stakingGroup.staked} rewards={stakingGroup.rewards} />
                )}
                {tables.length > 0 && (
                  <ProtocolTables
                    icon={null}
                    title={null}
                    rightValue={null}
                    tables={tables.filter(t => !['Supplied','Borrowed','Rewards'].includes(t.subtitle))}
                  />
                )}
              </>
            }
          />
        )
      })}
    </div>
  )
}

export default ProtocolsSection