import React, { useEffect, useState } from 'react'
import CollapsibleMenu from './components/CollapsibleMenu'
import TokensMenu from './components/TokensMenu'
import DeFiMenu from './components/DeFiMenu'
import { useWalletConnection, useWalletData, useTooltip } from './hooks/useWallet'
import useWalletMenus from './hooks/useWalletMenus'
import colors from './styles/colors'
import PoolTokenCell from './components/PoolTokenCell'
import CellsContainer from './components/CellsContainer'
import ProtocolTables from './components/ProtocolTables'
import SectionTable from './components/SectionTable'
import {
  formatBalance,
  formatNativeBalance,
  formatPrice,
  groupDefiByProtocol,
  getFilteredTokens,
  groupTokensByPool,
  groupTokensByType,
  groupStakingTokensByType,
  ITEM_TYPES,
  filterItemsByType,
  getWalletTokens,
  getLiquidityPools,
  getLendingAndBorrowingPositions,
  getStakingPositions
} from './utils/walletUtils'
import {
  DEFAULT_COLUMN_VISIBILITY,
  DEFAULT_EXPANSION_STATES,
  DEFAULT_FILTER_SETTINGS
} from './constants/config'

export default function App() {
  // Wallet connection
  const { account, loading, setLoading, connectWallet, copyAddress, disconnect } = useWalletConnection()
  // Wallet data API
  const { walletData, callAccountAPI, refreshWalletData } = useWalletData()
  // Tooltip
  const { tooltipVisible, tooltipPosition } = useTooltip()

  // Filters and UI states
  const [showOnlyPositiveBalance, setShowOnlyPositiveBalance] = useState(DEFAULT_FILTER_SETTINGS?.showOnlyPositiveBalance ?? true)
  const [tokensExpanded, setTokensExpanded] = useState(DEFAULT_EXPANSION_STATES?.tokensExpanded ?? true)
  // Top-level sections now are protocols; legacy section flags kept (not used)
  const [liquidityPoolsExpanded, setLiquidityPoolsExpanded] = useState(DEFAULT_EXPANSION_STATES?.liquidityPoolsExpanded ?? true)
  const [lendingAndBorrowingExpanded, setLendingAndBorrowingExpanded] = useState(true)
  const [stakingExpanded, setStakingExpanded] = useState(true)

  const [showBalanceColumn, setShowBalanceColumn] = useState(DEFAULT_COLUMN_VISIBILITY?.showBalanceColumn ?? true)
  const [showUnitPriceColumn, setShowUnitPriceColumn] = useState(DEFAULT_COLUMN_VISIBILITY?.showUnitPriceColumn ?? true)

  const [showLendingDefiTokens, setShowLendingDefiTokens] = useState(false)
  const [showStakingDefiTokens, setShowStakingDefiTokens] = useState(false)

  const [defaultStates, setDefaultStates] = useState({})
  const [protocolExpansions, setProtocolExpansions] = useState({})
  const toggleProtocolExpansion = (protocolName) => setProtocolExpansions(prev => ({ ...prev, [protocolName]: !prev[protocolName] }))

  // Search any address
  const [searchAddress, setSearchAddress] = useState('')
  const handleSearch = () => {
    const addr = (searchAddress || '').trim()
    if (!addr) {
      alert('Please enter a wallet address')
      return
    }
    callAccountAPI(addr, setLoading)
  }

  // Refresh current account
  const handleRefreshWalletData = () => refreshWalletData(account, setLoading)

  // Load data when account changes
  useEffect(() => {
    if (account) callAccountAPI(account, setLoading)
  }, [account, callAccountAPI, setLoading])

  // Data getters supporting multiple shapes
  const getWalletTokensData = () => {
    if (!walletData) return []
    if (walletData.items && Array.isArray(walletData.items)) return getWalletTokens(walletData.items)
    if (walletData.data && Array.isArray(walletData.data)) return getWalletTokens(walletData.data)
    return walletData.tokens || []
  }

  const getLiquidityPoolsData = () => {
    if (!walletData) return []
    if (walletData.items && Array.isArray(walletData.items)) return getLiquidityPools(walletData.items)
    if (walletData.data && Array.isArray(walletData.data)) return getLiquidityPools(walletData.data)
    if (Array.isArray(walletData.deFi)) return walletData.deFi.filter(d => (d.position?.label || d.position?.name) === 'Liquidity')
    return walletData.liquidityPools || []
  }

  const filterLendingDefiTokens = (tokens, showInternal) => {
    if (!Array.isArray(tokens)) return []
    if (showInternal) return tokens
    return tokens.filter(t => {
      const ty = (t.type || '').toString().toLowerCase()
      const isInternal = ty === 'defi-token' || ty === 'internal' || t.isInternal || t.internal || t.category === 'internal'
      if (isInternal) return false
  // Keep tokens with null/empty type (some protocols don't tag them)
  if (!ty) return true
  return ['supplied', 'supply', 'deposit', 'borrowed', 'borrow', 'debt', 'reward', 'rewards'].includes(ty)
    })
  }

  const filterStakingDefiTokens = (tokens, showInternal) => {
    if (!Array.isArray(tokens)) return []
    if (showInternal) return tokens
    return tokens.filter(t => {
      const ty = (t.type || '').toString().toLowerCase()
      const isInternal = ty === 'defi-token' || ty === 'internal' || t.isInternal || t.internal || t.category === 'internal'
      if (isInternal) return false
      return ty === 'reward' || ty === 'rewards' || ty === 'staked'
    })
  }

  const getLendingAndBorrowingData = () => {
    if (!walletData) return []
    if (walletData.items && Array.isArray(walletData.items)) return getLendingAndBorrowingPositions(walletData.items)
    if (walletData.data && Array.isArray(walletData.data)) return getLendingAndBorrowingPositions(walletData.data)
    if (Array.isArray(walletData.deFi)) return walletData.deFi.filter(d => (d.position?.label || d.position?.name) !== 'Liquidity')
    return walletData.lendingAndBorrowing || []
  }

  const getStakingData = () => {
    if (!walletData) return []
    if (walletData.items && Array.isArray(walletData.items)) return filterItemsByType(walletData.items, ITEM_TYPES.STAKING)
    if (walletData.data && Array.isArray(walletData.data)) return getStakingPositions(walletData.data)
    return walletData.staking || []
  }

  const getTotalPortfolioValue = () => {
    const signedTokenValue = (t, pos) => {
      const ty = (t.type || '').toLowerCase()
      const val = Math.abs(parseFloat(t.totalPrice) || 0)
      if (ty === 'borrowed' || ty === 'borrow' || ty === 'debt') return -val
      if (!ty) {
        const lbl = (pos?.position?.label || pos?.label || '').toLowerCase()
        if (lbl.includes('borrow') || lbl.includes('debt')) return -val
      }
      return val
    }
    const walletValue = getFilteredTokens(getWalletTokensData(), showOnlyPositiveBalance).reduce((sum, tokenData) => {
      const token = tokenData.token || tokenData
      return sum + (parseFloat(token.totalPrice) || 0)
    }, 0)

    const liquidityValue = groupDefiByProtocol(getLiquidityPoolsData()).reduce((total, group) =>
      total + group.positions.reduce((sum, pos) =>
        sum + (pos.tokens?.reduce((tokenSum, token) => tokenSum + (parseFloat(token.totalPrice) || 0), 0) || 0), 0
      ), 0
    )

    const lendingNet = groupDefiByProtocol(getLendingAndBorrowingData()).reduce((grand, group) => {
      const groupSum = group.positions.reduce((sum, pos) => {
        const tokens = Array.isArray(pos.tokens) ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens) : []
        const net = tokens.reduce((s, t) => s + signedTokenValue(t, pos), 0)
        return sum + net
      }, 0)
      return grand + groupSum
    }, 0)

    const stakingValue = getStakingData().reduce((total, position) => {
      const balance = parseFloat(position.balance) || 0
      return total + (isNaN(balance) ? 0 : balance)
    }, 0)

    return walletValue + liquidityValue + lendingNet + stakingValue
  }

  const calculatePercentage = (value, total) => {
    const v = parseFloat(value) || 0
    const t = parseFloat(total) || 0
    if (t <= 0) return '0%'
    return `${((v / t) * 100).toFixed(2)}%`
  }

  // Precomputed lists for rendering (reduce nesting inside JSX)
  const walletTokens = getFilteredTokens(getWalletTokensData(), showOnlyPositiveBalance)
  const walletValue = walletTokens.reduce((sum, tokenData) => { const token = tokenData.token || tokenData; return sum + (parseFloat(token.totalPrice) || 0) }, 0)
  const walletPercent = calculatePercentage(walletValue, getTotalPortfolioValue())

  // UI
  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1f2937 0%, #111827 60%, #0b1220 100%)',
        borderRadius: 16,
        padding: '16px 20px',
        marginBottom: 16,
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#ffffff' }}>My Web Wallet</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', padding: '8px 10px', borderRadius: 10 }}>
              <input
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                placeholder="Search address..."
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'white', width: 220, fontSize: 13 }}
              />
              <button onClick={handleSearch} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', padding: '6px 10px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Search</button>
            </div>
            {account ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  <div style={{ width: 8, height: 8, backgroundColor: '#4ade80', borderRadius: '50%', boxShadow: '0 0 8px rgba(74, 222, 128, 0.5)' }} />
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500, marginBottom: 2 }}>Connected Account</div>
                    <div style={{ fontSize: 13, color: 'white', fontFamily: 'monospace', fontWeight: 600 }}>{`${account.slice(0, 6)}...${account.slice(-4)}`}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={copyAddress} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '8px 12px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>📋 Copy</button>
                  <button onClick={handleRefreshWalletData} disabled={loading} style={{ background: loading ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: loading ? 'rgba(255,255,255,0.6)' : 'white', padding: '8px 12px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? '🔄 Refreshing...' : '🔄 Refresh'}</button>
                  <button onClick={disconnect} style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fecaca', padding: '8px 12px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>🚪 Disconnect</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={connectWallet} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '8px 12px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Connect Wallet</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading banner */}
      {loading && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%' }} />
          <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 500 }}>Loading wallet data...</span>
        </div>
      )}

      {/* Content */}
      {walletData && (
        <div>
          {/* Tokens using SectionTable */}
          {walletTokens.length > 0 && (() => {
            const columns = [
              { key: 'token', label: 'Token', align: 'left' },
              ...(showBalanceColumn ? [{ key: 'amount', label: 'Amount', align: 'right', width: 140 }] : []),
              ...(showUnitPriceColumn ? [{ key: 'price', label: 'Price', align: 'right', width: 120 }] : []),
              { key: 'value', label: 'Value', align: 'right', width: 160 }
            ]
            const rows = walletTokens.map((tokenData, index) => {
              const token = tokenData.token || tokenData
              return {
                key: token.contractAddress || token.tokenAddress || `${token.symbol}-${index}`,
                token: (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {token.logo && (<img src={token.logo} alt={token.symbol} style={{ width: 24, height: 24, marginRight: 10, borderRadius: '50%', border: '1px solid #e0e0e0' }} onError={(e) => (e.currentTarget.style.display = 'none')} />)}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#212529', marginBottom: 2 }}>{token.symbol}</div>
                      <div style={{ fontSize: 12, color: '#6c757d' }}>{token.name}</div>
                    </div>
                  </div>
                ),
                amount: showBalanceColumn ? formatBalance(token.balance, token.native) : undefined,
                price: showUnitPriceColumn ? formatPrice(token.price) : undefined,
                value: formatPrice(token.totalPrice)
              }
            })
            const infoBadges = `Tokens: ${walletTokens.length}`
            const optionsMenu = (
              <div style={{ padding: '6px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={!showOnlyPositiveBalance} onChange={(e) => setShowOnlyPositiveBalance(!e.target.checked)} />
                  Show assets with no balance
                </label>
                <div style={{ height: 1, background: '#e5e7eb', margin: '6px 0' }} />
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, padding: '6px 12px' }}>Visible Columns</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={showBalanceColumn} onChange={(e) => setShowBalanceColumn(e.target.checked)} />
                  Amount
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={showUnitPriceColumn} onChange={(e) => setShowUnitPriceColumn(e.target.checked)} />
                  Price
                </label>
                <div style={{ fontSize: 11, color: '#9ca3af', padding: '6px 12px', fontStyle: 'italic' }}>Token and Total Value are always visible</div>
              </div>
            )
            return (
              <SectionTable
                title="Wallet"
                level={0}
                rightPercent={walletPercent}
                rightValue={formatPrice(walletValue)}
                isExpanded={tokensExpanded}
                onToggle={() => setTokensExpanded(!tokensExpanded)}
                columns={columns}
                rows={rows}
                getKey={(row) => row.key}
                infoBadges={infoBadges}
                optionsMenu={optionsMenu}
              />
            )
          })()}

          {/* Protocols at level 0 (no Liquidity/Lending/Staking top-level) */}
          {(() => {
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
                  const liqPositions = protocolGroup.positions.filter(p => {
                    const lbl = (p.position?.label || p.position?.name || p.label || '').toString().toLowerCase()
                    return lbl.includes('liquidity')
                  })
                  const stakingPositions = protocolGroup.positions.filter(p => {
                    const lbl = (p.position?.label || p.position?.name || p.label || '').toString().toLowerCase()
                    return lbl.includes('staking')
                  })
                  const lendingPositions = protocolGroup.positions.filter(p => {
                    const lbl = (p.position?.label || p.position?.name || p.label || '').toString().toLowerCase()
                    return !lbl.includes('liquidity') && !lbl.includes('staking')
                  })

                  // Compute protocol total balance (lending borrowed negative)
                  const liquidityTotal = liqPositions.reduce((sum, pos) => sum + (pos.tokens?.reduce((s, t) => s + (parseFloat(t.totalPrice) || 0), 0) || 0), 0)
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

                  if (liqPositions.length > 0) {
                    const poolsMap = groupTokensByPool(liqPositions)
                    const pools = Object.entries(poolsMap)
                    const rows = pools.map(([poolName, data], idx) => {
                      const poolLabel = (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {data.tokens.slice(0, 3).map((t, i) => (
                            t.logo ? <img key={`${poolName}-logo-${i}`} src={t.logo} alt={t.symbol} style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid #e0e0e0' }} onError={(e) => (e.currentTarget.style.display = 'none')} /> : null
                          ))}
                          <span>{data.tokens.map(t => t.symbol).join(' / ')}</span>
                        </div>
                      )
                      return { pool: poolLabel, rewards: formatPrice(data.totalRewards || 0), balance: formatPrice(data.totalValue || 0) }
                    })
                    tables.push({
                      subtitle: 'Pools',
                      columns: [
                        { key: 'pool', label: 'Pool', align: 'left' },
                        { key: 'rewards', label: 'Rewards', align: 'right', width: 160 },
                        { key: 'balance', label: 'Balance', align: 'right', width: 180 }
                      ],
                      rows,
                      getKey: (row, idx) => `${protocolGroup.protocol.name}-pool-${idx}`
                    })
                  }

                  if (lendingPositions.length > 0) {
                    const filtered = lendingPositions.map(p => ({ ...p, tokens: Array.isArray(p.tokens) ? filterLendingDefiTokens(p.tokens, showLendingDefiTokens) : [] }))
                    const grouped = groupTokensByType(filtered)
                    const supplied = grouped.supplied || []
                    const borrowed = grouped.borrowed || []
                    if (supplied.length > 0) {
                      const rows = supplied.map((t, idx) => ({
                        token: (
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {t.logo && (
                              <img
                                src={t.logo}
                                alt={t.symbol}
                                style={{ width: 18, height: 18, marginRight: 8, borderRadius: '50%', border: '1px solid #e0e0e0' }}
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            )}
                            <span style={{ fontWeight: 600, fontSize: 13, color: '#212529' }}>{t.symbol}</span>
                          </div>
                        ),
                        balance: formatPrice(parseFloat(t.totalPrice) || 0)
                      }))
                      tables.push({
                        subtitle: 'Supplied',
                        columns: [
                          { key: 'token', label: 'Token', align: 'left' },
                          { key: 'balance', label: 'Balance', align: 'right', width: 180 }
                        ],
                        rows,
                        getKey: (row, idx) => `${protocolGroup.protocol.name}-sup-${idx}`
                      })
                    }
                    if (borrowed.length > 0) {
                      const rows = borrowed.map((t, idx) => {
                        const val = -(Math.abs(parseFloat(t.totalPrice) || 0))
                        return {
                          token: (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {t.logo && (
                                <img
                                  src={t.logo}
                                  alt={t.symbol}
                                  style={{ width: 18, height: 18, marginRight: 8, borderRadius: '50%', border: '1px solid #e0e0e0' }}
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                              )}
                              <span style={{ fontWeight: 600, fontSize: 13, color: '#212529' }}>{t.symbol}</span>
                            </div>
                          ),
                          balance: formatPrice(val)
                        }
                      })
                      tables.push({
                        subtitle: 'Borrowed',
                        columns: [
                          { key: 'token', label: 'Token', align: 'left' },
                          { key: 'balance', label: 'Balance', align: 'right', width: 180 }
                        ],
                        rows,
                        getKey: (row, idx) => `${protocolGroup.protocol.name}-bor-${idx}`
                      })
                    }
                  }

                  if (stakingPositions.length > 0) {
                    const filtered = stakingPositions.map(p => ({ ...p, tokens: Array.isArray(p.tokens) ? filterStakingDefiTokens(p.tokens, showStakingDefiTokens) : [] }))
                    const grouped = groupStakingTokensByType(filtered)
                    const staked = grouped.staked || []
                    const rewards = grouped.rewards || []
                    if (staked.length > 0) {
                      const rows = staked.map((t, idx) => ({
                        token: (
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {(t.logo || t.logoURI) && (
                              <img
                                src={t.logo || t.logoURI}
                                alt={t.symbol}
                                style={{ width: 18, height: 18, marginRight: 8, borderRadius: '50%', border: '1px solid #e0e0e0' }}
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            )}
                            <span style={{ fontWeight: 600, fontSize: 13, color: '#212529' }}>{t.symbol}</span>
                          </div>
                        ),
                        balance: formatPrice(parseFloat(t.totalPrice) || 0)
                      }))
                      tables.push({
                        subtitle: 'Staked',
                        columns: [
                          { key: 'token', label: 'Token', align: 'left' },
                          { key: 'balance', label: 'Balance', align: 'right', width: 180 }
                        ],
                        rows,
                        getKey: (row, idx) => `${protocolGroup.protocol.name}-stk-${idx}`
                      })
                    }
                    if (rewards.length > 0) {
                      const rows = rewards.map((t, idx) => ({
                        token: (
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {(t.logo || t.logoURI) && (
                              <img
                                src={t.logo || t.logoURI}
                                alt={t.symbol}
                                style={{ width: 18, height: 18, marginRight: 8, borderRadius: '50%', border: '1px solid #e0e0e0' }}
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            )}
                            <span style={{ fontWeight: 600, fontSize: 13, color: '#212529' }}>{t.symbol}</span>
                          </div>
                        ),
                        balance: formatPrice(parseFloat(t.totalPrice) || 0)
                      }))
                      tables.push({
                        subtitle: 'Rewards',
                        columns: [
                          { key: 'token', label: 'Token', align: 'left' },
                          { key: 'balance', label: 'Balance', align: 'right', width: 180 }
                        ],
                        rows,
                        getKey: (row, idx) => `${protocolGroup.protocol.name}-rwd-${idx}`
                      })
                    }
                  }

                  const icon = (protocolGroup.protocol.logoURI || protocolGroup.protocol.logo)
                    ? (<img src={protocolGroup.protocol.logoURI || protocolGroup.protocol.logo} alt={protocolGroup.protocol.name} style={{ width: 20, height: 20, borderRadius: '50%' }} onError={(e) => (e.currentTarget.style.display = 'none')} />)
                    : null

                  const protocolPercent = calculatePercentage(protocolTotal, getTotalPortfolioValue())
                  const infoBadges = [
                    liqPositions.length > 0 ? `Pools: ${Object.keys(groupTokensByPool(liqPositions)).length}` : null,
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
                  return (
                    <SectionTable
                      key={protocolGroup.protocol.name}
                      icon={icon}
                      title={protocolGroup.protocol.name}
                      level={0}
                      rightPercent={protocolPercent}
                      rightValue={formatPrice(protocolTotal)}
                      isExpanded={protocolExpansions[protocolGroup.protocol.name] || false}
                      onToggle={() => toggleProtocolExpansion(protocolGroup.protocol.name)}
                      infoBadges={infoBadges}
                      optionsMenu={optionsMenu}
                      customContent={
                        <ProtocolTables
                          icon={null}
                          title={null}
                          rightValue={null}
                          tables={tables}
                        />
                      }
                    />
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Tooltip */}
      {tooltipVisible && (
        <div style={{ position: 'fixed', left: tooltipPosition.x - (tooltipVisible?.length || 0) * 3, top: tooltipPosition.y - 40, backgroundColor: 'rgba(0, 0, 0, 0.9)', color: 'white', padding: '8px 12px', borderRadius: 4, fontSize: 12, whiteSpace: 'pre-line', zIndex: 1000, maxWidth: 300, wordWrap: 'break-word' }}>
          {tooltipVisible}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: 20, borderRadius: 8, fontSize: 16 }}>Loading wallet data...</div>
        </div>
      )}
    </div>
  )
}