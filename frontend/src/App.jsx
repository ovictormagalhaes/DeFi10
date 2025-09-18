import React, { useEffect, useState, useRef } from 'react'
import { MaskValuesProvider } from './context/MaskValuesContext'
import { ChainIconsProvider } from './context/ChainIconsProvider'
import CollapsibleMenu from './components/CollapsibleMenu'
import TokensMenu from './components/TokensMenu'
import DeFiMenu from './components/DeFiMenu'
import { useWalletConnection, useWalletData, useTooltip } from './hooks/useWallet'
import ActionButton from './components/ActionButton'
import useWalletMenus from './hooks/useWalletMenus'
import colors from './styles/colors'
import { useTheme } from './context/ThemeProvider'
import WalletTokensTable from './components/WalletTokensTable'
import PoolTokenCell from './components/PoolTokenCell'
import CellsContainer from './components/CellsContainer'
import ProtocolTables from './components/ProtocolTables'
import LendingTables from './components/LendingTables'
import StakingTables from './components/StakingTables'
import PoolTables from './components/PoolTables'
import SectionTable from './components/SectionTable'
import {
  formatBalance,
  formatNativeBalance,
  formatPrice,
  formatTokenAmount,
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

function App() {
  const { theme, mode, toggleTheme } = useTheme()
  const [maskValues, setMaskValues] = useState(false)
  const toggleMaskValues = () => setMaskValues(m => !m)

  // Persist maskValues in localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('defi10_mask_values')
      if (stored === 'true') setMaskValues(true)
      if (stored === 'false') setMaskValues(false)
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem('defi10_mask_values', String(maskValues)) } catch {}
  }, [maskValues])
  // Responsive horizontal padding logic: 15% on large notebook/desktop screens
  const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
  const [viewportWidth, setViewportWidth] = useState(initialWidth)
  useEffect(() => {
    const handleResize = () => setViewportWidth(typeof window !== 'undefined' ? window.innerWidth : initialWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  // Breakpoints: >=1100px => 15% side padding, >=800px => 8%, below => fixed 20px
  const sidePadding = viewportWidth >= 1100
    ? '15%'
    : (viewportWidth >= 800 ? '8%' : '20px')
  // Wallet connection
  const { account, loading, setLoading, connectWallet, copyAddress, disconnect, supportedChains, chainsLoading, refreshSupportedChains } = useWalletConnection()
  // Track first connect for pulse animation
  const hasPulsedRef = useRef(false)
  const [showPulse, setShowPulse] = useState(false)
  // Hover state for account badge (to reveal disconnect inside badge)
  const [showAccountHover, setShowAccountHover] = useState(false)
  useEffect(() => {
    if (account && !hasPulsedRef.current) {
      setShowPulse(true)
      hasPulsedRef.current = true
      const t = setTimeout(() => setShowPulse(false), 1600)
      return () => clearTimeout(t)
    }
  }, [account])
  // Wallet data API
  const { walletData, callAccountAPI, refreshWalletData, clearWalletData } = useWalletData()
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
  // Chain selection (null or Set of canonical keys). Default: all selected
  const [selectedChains, setSelectedChains] = useState(null)

  const [defaultStates, setDefaultStates] = useState({})
  const [protocolExpansions, setProtocolExpansions] = useState({})
  // Ensure any new protocol defaults to expanded=true (so Uniswap/Aave open automatically)
  useEffect(() => {
    // After walletData loaded, infer protocol names and set default true if not set
    const allDefi = [
      ...(getLiquidityPoolsData() || []),
      ...(getLendingAndBorrowingData() || []),
      ...(getStakingData() || [])
    ]
    if (!allDefi.length) return
    const protocolNames = new Set()
    allDefi.forEach(p => {
      const name = (p.protocol?.name || p.position?.protocol?.name || p.position?.name || p.protocolName || p.name)
      if (name) protocolNames.add(name)
    })
    setProtocolExpansions(prev => {
      let changed = false
      const next = { ...prev }
      protocolNames.forEach(n => {
        if (next[n] === undefined) { next[n] = true; changed = true }
      })
      return changed ? next : prev
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletData])
  const toggleProtocolExpansion = (protocolName) => setProtocolExpansions(prev => ({ ...prev, [protocolName]: !prev[protocolName] }))

  // Search any address
  const [searchAddress, setSearchAddress] = useState('')
  const resetSelectionAndSnapshot = () => {
    setSelectedChains(null)
    walletDataSnapshotRef.current = null
  }
  const handleSearch = () => {
    const addr = (searchAddress || '').trim()
    if (!addr) {
      alert('Please enter a wallet address')
      return
    }
    resetSelectionAndSnapshot()
    callAccountAPI(addr, setLoading)
    refreshSupportedChains(true)
  }

  // Refresh current account
  const handleRefreshWalletData = () => {
    resetSelectionAndSnapshot()
    refreshWalletData(account, setLoading)
    refreshSupportedChains(true)
  }

  // Load data when account changes
  useEffect(() => {
    if (account) {
      resetSelectionAndSnapshot()
      callAccountAPI(account, setLoading)
      refreshSupportedChains(true)
    } else {
      clearWalletData()
      walletDataSnapshotRef.current = null
      setSelectedChains(null)
    }
    // refreshSupportedChains is stable (useCallback) but omit to prevent redundant triggers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, callAccountAPI, setLoading, clearWalletData])

  // Immutable snapshot of the last full walletData to ensure global aggregates (chainTotals) are independent from any UI filtering mutations.
  const walletDataSnapshotRef = React.useRef(null)
  useEffect(() => {
    if (walletData) {
      // Deep-ish clone via JSON for immutability (acceptable for aggregate computation; optimize later if needed)
      try {
        walletDataSnapshotRef.current = JSON.parse(JSON.stringify(walletData))
      } catch {
        walletDataSnapshotRef.current = walletData
      }
    }
  }, [walletData])

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
      ), 0)

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

  // Mascara para valores financeiros quando maskValues ativo
  const maskValue = (formatted, opts = {}) => {
    if (!maskValues) return formatted
    const { short = false } = opts
    return short ? '•••' : '••••••'
  }

  // (Will redefine walletTokens after adding chain filtering helpers below)
  let walletTokens = []
  let walletValue = 0
  let walletPercent = '0%'

  // Initialize selected chains when they load the first time
  useEffect(() => {
    if (supportedChains && supportedChains.length > 0 && selectedChains === null) {
      const initial = new Set(supportedChains.map(sc => normalizeChainKey(sc.displayName || sc.name || sc.shortName || sc.id || sc.chainId || sc.chain || sc.network || sc.networkId)))
      setSelectedChains(initial)
    }
  }, [supportedChains, selectedChains])

  const isAllChainsSelected = selectedChains && supportedChains && selectedChains.size === supportedChains.length
  const toggleChainSelection = (chainCanonicalKey) => {
    setSelectedChains(prev => {
      if (!prev) return new Set([chainCanonicalKey])
      const next = new Set(prev)
      if (next.has(chainCanonicalKey)) {
        // Avoid empty selection: keep at least one
        if (next.size === 1) return next
        next.delete(chainCanonicalKey)
      } else {
        next.add(chainCanonicalKey)
      }
      return next
    })
  }

  // --- Chain alias & filtering utilities ---
  // Normalize helper (lowercase + trimmed string)
  const normalizeChainKey = (v) => {
    if (v === undefined || v === null) return undefined
    return String(v).trim().toLowerCase()
  }

  const chainAliasToCanonical = React.useMemo(() => {
    const map = {}
    if (Array.isArray(supportedChains)) {
      supportedChains.forEach(sc => {
        const canonicalRaw = sc.displayName || sc.name || sc.shortName || sc.id || sc.chainId || sc.chain || sc.network || sc.networkId
        const canonical = normalizeChainKey(canonicalRaw)
        const aliases = [sc.id, sc.chainId, sc.chainID, sc.chain, sc.networkId, sc.network, sc.displayName, sc.name, sc.shortName, canonicalRaw]
          .filter(a => a !== undefined && a !== null && a !== '')
        aliases.forEach(a => { map[normalizeChainKey(a)] = canonical })
      })
    }
    return map
  }, [supportedChains])

  const resolveAnyChain = (obj) => {
    if (!obj || typeof obj !== 'object') return undefined
    const direct = obj.chainId || obj.chainID || obj.chain_id || obj.chain || obj.networkId || obj.network || obj.chainName
    if (direct) return direct
    const p = obj.protocol
    if (p && typeof p === 'object') {
      return p.chainId || p.chainID || p.chain || p.networkId || p.network || p.chainName
    }
    // Generic scan for properties containing 'chain' or 'network'
    for (const k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue
      if (/(chain|network)/i.test(k)) {
        const v = obj[k]
        if (v && (typeof v === 'string' || typeof v === 'number')) return v
      }
    }
    return undefined
  }

  const getCanonicalFromObj = (obj) => {
    const raw = resolveAnyChain(obj)
    if (raw === undefined || raw === null) return undefined
    const norm = normalizeChainKey(raw)
    return chainAliasToCanonical[norm] || norm
  }

  const defiItemMatchesSelection = (item) => {
    if (!selectedChains || isAllChainsSelected) return true
    const base = (item && item.position) ? item.position : item
    const direct = getCanonicalFromObj(base)
    if (direct && selectedChains.has(direct)) return true
    const toks = Array.isArray(base?.tokens) ? base.tokens : []
    for (let i = 0; i < toks.length; i++) {
      const cc = getCanonicalFromObj(toks[i])
      if (cc && selectedChains.has(cc)) return true
    }
    return false
  }

  // Recompute wallet tokens with filtering
  walletTokens = React.useMemo(() => {
    const raw = getFilteredTokens(getWalletTokensData(), showOnlyPositiveBalance)
    if (!selectedChains || isAllChainsSelected) return raw
    return raw.filter(tokenData => {
      const token = tokenData.token || tokenData
      const canonical = getCanonicalFromObj(token) || getCanonicalFromObj(tokenData)
      if (!canonical) return false
      return selectedChains.has(canonical)
    })
  }, [walletData, showOnlyPositiveBalance, selectedChains, isAllChainsSelected, chainAliasToCanonical])
  walletValue = walletTokens.reduce((sum, tokenData) => { const token = tokenData.token || tokenData; return sum + (parseFloat(token.totalPrice) || 0) }, 0)
  walletPercent = calculatePercentage(walletValue, getTotalPortfolioValue())


  // Compute per-chain totals (net of borrowed like overall calculation) once per render dependencies
  const { mergedTotals: chainTotals, rawTotals: rawChainTotals } = React.useMemo(() => {
    const sourceData = walletDataSnapshotRef.current || walletData
    const totals = {} // raw keyed by any discovered chain id/name
    const addVal = (rawKey, v) => {
      if (rawKey === undefined || rawKey === null) return
      const key = String(rawKey)
      if (!totals[key]) totals[key] = 0
      totals[key] += (parseFloat(v) || 0)
    }

    // Helper to resolve chain key from an object (token or position)
    const resolveChainKey = (obj) => {
      if (!obj || typeof obj !== 'object') return undefined
      // Prefer explicit numeric/string chain identifiers
      const direct = obj.chainId || obj.chainID || obj.chain_id || obj.chain || obj.networkId || obj.network || obj.chainName
      if (direct) return direct
      // Look into protocol nested object (but avoid using protocol.id or name as chain accidentally)
      const p = obj.protocol
      if (p && typeof p === 'object') {
        return p.chainId || p.chainID || p.chain || p.networkId || p.network || p.chainName
      }
      // Generic scan for any key containing chain or network
      for (const k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue
        if (/(chain|network)/i.test(k)) {
          const v = obj[k]
          if (v && (typeof v === 'string' || typeof v === 'number')) return v
        }
      }
      return undefined
    }

    // Signed value logic (borrowed negative)
    const signedTokenValue = (token, position) => {
      const ty = (token?.type || '').toLowerCase()
      const val = Math.abs(parseFloat(token?.totalPrice) || 0)
      if (ty === 'borrowed' || ty === 'borrow' || ty === 'debt') return -val
      if (!ty) {
        const lbl = (position?.position?.label || position?.label || '').toLowerCase()
        if (lbl.includes('borrow') || lbl.includes('debt')) return -val
      }
      return val
    }

    // Wallet tokens (raw, not dust-filtered) -> always count full wallet contribution
    try {
      // Use snapshot-based accessor (do not rely on potentially filtered structures later in render)
      const snap = sourceData
      let rawWalletTokens = []
      if (snap) {
        if (snap.items && Array.isArray(snap.items)) rawWalletTokens = getWalletTokens(snap.items)
        else if (snap.data && Array.isArray(snap.data)) rawWalletTokens = getWalletTokens(snap.data)
        else rawWalletTokens = snap.tokens || []
      }
      rawWalletTokens.forEach(tkData => {
        const token = tkData.token || tkData
        const chainKey = resolveChainKey(token) || resolveChainKey(tkData)
        if (chainKey !== undefined) addVal(chainKey, token.totalPrice)
      })
    } catch { /* silent */ }

    // Helper to extract underlying position object (some data comes as { position: {...} })
    const extractPosition = (item) => (item && item.position) ? item.position : item

    const unmatchedDebug = { liquidity: 0, lending: 0, staking: 0 }

    // Liquidity pools
    try {
      let liqItems = []
      const snap = sourceData
      if (snap) {
        if (snap.items && Array.isArray(snap.items)) liqItems = getLiquidityPools(snap.items)
        else if (snap.data && Array.isArray(snap.data)) liqItems = getLiquidityPools(snap.data)
        else if (Array.isArray(snap.deFi)) liqItems = snap.deFi.filter(d => (d.position?.label || d.position?.name) === 'Liquidity')
        else liqItems = snap.liquidityPools || []
      }
      liqItems.forEach(item => {
        const base = extractPosition(item)
        const posChain = resolveChainKey(base) || resolveChainKey(item)
        const tokensArr = Array.isArray(base?.tokens) ? base.tokens : []
        tokensArr.forEach(tok => {
          const chainKey = resolveChainKey(tok) || posChain
          const val = parseFloat(tok.totalPrice) || 0
          if (chainKey === undefined) unmatchedDebug.liquidity += val
          else addVal(chainKey, val)
        })
        // rewards may be inside base.rewards
        if (Array.isArray(base?.rewards)) {
          base.rewards.forEach(rw => {
            const chainKey = resolveChainKey(rw) || posChain
            const val = parseFloat(rw.totalPrice) || 0
            if (chainKey === undefined) unmatchedDebug.liquidity += val
            else addVal(chainKey, val)
          })
        }
      })
    } catch { /* silent */ }

    // Lending & Borrowing
    try {
      let lendingItems = []
      const snap = sourceData
      if (snap) {
        if (snap.items && Array.isArray(snap.items)) lendingItems = getLendingAndBorrowingPositions(snap.items)
        else if (snap.data && Array.isArray(snap.data)) lendingItems = getLendingAndBorrowingPositions(snap.data)
        else if (Array.isArray(snap.deFi)) lendingItems = snap.deFi.filter(d => (d.position?.label || d.position?.name) !== 'Liquidity')
        else lendingItems = snap.lendingAndBorrowing || []
      }
      lendingItems.forEach(item => {
        const base = extractPosition(item)
        const posChain = resolveChainKey(base) || resolveChainKey(item)
        const rawTokens = Array.isArray(base?.tokens) ? base.tokens : []
        const tokens = showLendingDefiTokens ? rawTokens : rawTokens.filter(t => {
          const ty = (t.type || '').toLowerCase()
          const isInternal = ty === 'defi-token' || ty === 'internal' || t.isInternal || t.internal || t.category === 'internal'
          if (isInternal) return false
          if (!ty) return true
          return ['supplied','supply','deposit','borrowed','borrow','debt','reward','rewards'].includes(ty)
        })
        tokens.forEach(tok => {
          const chainKey = resolveChainKey(tok) || posChain
          const val = signedTokenValue(tok, base)
          if (chainKey === undefined) unmatchedDebug.lending += val
          else addVal(chainKey, val)
        })
      })
    } catch { /* silent */ }

    // Staking
    try {
      let stakingItems = []
      const snap = sourceData
      if (snap) {
        if (snap.items && Array.isArray(snap.items)) stakingItems = filterItemsByType(snap.items, ITEM_TYPES.STAKING)
        else if (snap.data && Array.isArray(snap.data)) stakingItems = getStakingPositions(snap.data)
        else stakingItems = snap.staking || []
      }
      stakingItems.forEach(item => {
        const base = extractPosition(item)
        const posChain = resolveChainKey(base) || resolveChainKey(item)
        let any = false
        const rawTokens = Array.isArray(base?.tokens) ? base.tokens : []
        const tokens = showStakingDefiTokens ? rawTokens : rawTokens.filter(t => {
          const ty = (t.type || '').toLowerCase()
          const isInternal = ty === 'defi-token' || ty === 'internal' || t.isInternal || t.internal || t.category === 'internal'
          if (isInternal) return false
          return ty === 'reward' || ty === 'rewards' || ty === 'staked'
        })
        tokens.forEach(tok => {
          any = true
          const chainKey = resolveChainKey(tok) || posChain
            const val = parseFloat(tok.totalPrice) || 0
            if (chainKey === undefined) unmatchedDebug.staking += val
            else addVal(chainKey, val)
        })
        if (!any) {
          const bal = parseFloat(base?.balance)
            if (!isNaN(bal)) {
              if (posChain === undefined) unmatchedDebug.staking += bal
              else addVal(posChain, bal)
            }
        }
      })
    } catch { /* silent */ }

    // Optional: could normalize numeric-only keys to align with supportedChains numeric ids
    // (Already using String() so matching done by same string form when rendering.)

    // Generic alias merging: every alias (id, name, displayName, etc.) for a supported chain receives the same aggregated sum.
    const merged = { ...totals }
    if (Array.isArray(supportedChains) && supportedChains.length > 0) {
      supportedChains.forEach(sc => {
        const aliases = [sc.id, sc.chainId, sc.chainID, sc.chain, sc.networkId, sc.network, sc.displayName, sc.name, sc.shortName]
          .filter(a => a !== undefined && a !== null && a !== '')
          .map(a => String(a))
        if (aliases.length === 0) return
        const uniqueAliases = Array.from(new Set(aliases))
        const sum = uniqueAliases.reduce((acc, key) => acc + (totals[key] || 0), 0)
        // Assign aggregated sum to all aliases so any lookup (id or name) returns the full value
        uniqueAliases.forEach(key => { merged[key] = sum })
        // Also ensure a canonical key (prefer displayName > name > id) exists
        const canonical = String(sc.displayName || sc.name || sc.shortName || sc.id || sc.chainId)
        merged[canonical] = sum
      })
    }

    if ((unmatchedDebug.liquidity + unmatchedDebug.lending + unmatchedDebug.staking) > 0) {
      try { console.log('[DEBUG] Unmatched chain value by category (USD):', unmatchedDebug) } catch {}
    }

    return { mergedTotals: merged, rawTotals: totals }
  }, [walletData, showLendingDefiTokens, showStakingDefiTokens, supportedChains])

  // Global total for percentages: sum only canonical keys (avoid alias duplication)
  const totalAllChains = React.useMemo(() => {
    if (!supportedChains || supportedChains.length === 0) return 0
    const seen = new Set()
    let sum = 0
    supportedChains.forEach(c => {
      const canonicalKey = String(c.displayName || c.name || c.shortName || c.id || c.chainId || c.chain || c.network || c.networkId)
      if (seen.has(canonicalKey)) return
      seen.add(canonicalKey)
      const v = chainTotals[canonicalKey]
      if (typeof v === 'number' && !isNaN(v)) sum += v
    })
    return sum
  }, [supportedChains, chainTotals])

  // UI
  return (
    <MaskValuesProvider value={{ maskValues, toggleMaskValues, setMaskValues, maskValue }}>
    <ChainIconsProvider supportedChains={supportedChains}>
  <style>{`@keyframes defiPulse{0%{transform:scale(.55);opacity:.65}60%{transform:scale(1.9);opacity:0}100%{transform:scale(1.9);opacity:0}}@keyframes defiSpin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
  <div style={{ padding: `8px ${sidePadding} 32px ${sidePadding}`, boxSizing: 'border-box', width: '100%' }}>
      {/* Top utility bar for theme & mask icons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '5px 0 10px 0' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          <button
            onClick={toggleTheme}
            title="Toggle light/dark mode"
            aria-label="Toggle light/dark mode"
            style={{
              background: 'transparent',
              border: 'none',
              width: 20,
              height: 20,
              minWidth: 20,
              minHeight: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: 12,
              transition: 'background 140ms',
              outline: 'none',
              padding: 0,
              marginLeft: 20,
              marginRight: 5
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = theme.bgPanelHover}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.focusRing}`}
            onBlur={e => e.currentTarget.style.boxShadow = 'none'}
          >
            {mode === 'dark' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
              </svg>
            ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
            )}
          </button>
          <button
            onClick={toggleMaskValues}
            title={maskValues ? 'Show values' : 'Hide values'}
            aria-label={maskValues ? 'Show Values' : 'Hide values'}
            style={{
              background: 'transparent',
              border: 'none',
              width: 20,
              height: 20,
              minWidth: 20,
              minHeight: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: 12,
              transition: 'background 140ms',
              outline: 'none',
              padding: 0,
              marginLeft: 20,
              marginRight: 5
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = theme.bgPanelHover}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.focusRing}`}
            onBlur={e => e.currentTarget.style.boxShadow = 'none'}
          >
            {maskValues ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>           
              ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a19.07 19.07 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.76 18.76 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {/* Header */}
      <div style={{
        background: theme.headerBg || theme.bgPanel,
        border: `1px solid ${theme.border}`,
        borderRadius: 18,
        padding: '12px 20px',
        marginBottom: 14,
        boxShadow: 'none',
        transition: 'background 0.25s,border-color 0.25s'
      }}>
        {/** Reusable small action button factory to keep consistent width & prevent layout shift */}
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 52 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {account ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textSecondary }}>Account Connected</span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: theme.bgInteractive,
                        border: `1px solid ${theme.border}`,
                        padding: '6px 12px',
                        borderRadius: 10,
                        minWidth: 300,
                        maxWidth: 380,
                        color: theme.textPrimary,
                        position: 'relative',
                        transition: 'background-color 140ms'
                      }}
                      title={account}
                    >
                      <div style={{ position: 'relative', width: 12, height: 12, flexShrink: 0 }}>
                        {showPulse && (
                          <span style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: '50%',
                            background: (theme.success || '#16a34a'),
                            opacity: 0.4,
                            animation: 'defiPulse 1.2s ease-out forwards'
                          }} />
                        )}
                        <span style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '50%',
                          background: theme.success || '#16a34a',
                          boxShadow: `0 0 0 0px ${theme.bgPanel}`
                        }} />
                      </div>
                      <span style={{ fontSize: 13, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {maskValues ? '••••••...••••' : `${account.slice(0,6)}...${account.slice(-4)}`}
                      </span>
                      {(() => {
                        const baseBtn = {
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          margin: 0,
                          cursor: 'pointer',
                          width: 30,
                          height: 30,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: theme.textPrimary,
                          borderRadius: 8,
                          transition: 'background-color 120ms, color 140ms, opacity 160ms'
                        }
                        const hoverNeutral = e => e.currentTarget.style.backgroundColor = theme.bgPanelHover
                        const leaveNeutral = e => e.currentTarget.style.backgroundColor = 'transparent'
                        return (
                          <>
                            {/* Copy */}
                            <button
                              onClick={copyAddress}
                              style={{ ...baseBtn }}
                              title="Copy address"
                              aria-label="Copy address"
                              onMouseEnter={hoverNeutral}
                              onMouseLeave={leaveNeutral}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            </button>
                            {/* Refresh wallet */}
                            <button
                              onClick={handleRefreshWalletData}
                              disabled={loading}
                              style={{
                                ...baseBtn,
                                opacity: loading ? 0.55 : 1,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                width: 30,
                                height: 30,
                                minWidth: 30,
                                minHeight: 30,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Refresh wallet data"
                              aria-label="Refresh wallet data"
                              onMouseEnter={e => { if(!loading) hoverNeutral(e) }}
                              onMouseLeave={leaveNeutral}
                            >
                              {loading ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'defiSpin 0.9s linear infinite', display: 'block', flexShrink: 0 }}>
                                  <path d="M21 12a9 9 0 1 1-9-9" />
                                </svg>
                              ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flexShrink: 0 }}>
                                  <path d="M3 2v6h6" />
                                  <path d="M21 12A9 9 0 0 0 6 5.3L3 8" />
                                  <path d="M21 22v-6h-6" />
                                  <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7" />
                                </svg>
                              )}
                            </button>
                            {/* Disconnect */}
                            <button
                              onClick={disconnect}
                              style={{ ...baseBtn }}
                              title="Disconnect wallet"
                              aria-label="Disconnect wallet"
                              onMouseEnter={e => {
                                e.currentTarget.style.backgroundColor = 'rgba(220,38,38,0.18)'
                                const svg = e.currentTarget.querySelector('svg')
                                if (svg) svg.style.stroke = theme.danger || '#dc2626'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.backgroundColor = 'transparent'
                                const svg = e.currentTarget.querySelector('svg')
                                if (svg) svg.style.stroke = theme.textPrimary
                              }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.textPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                                <path d="M3 12h11" />
                                <path d="M17 8l4 4-4 4" />
                                <path d="M10 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h3" />
                              </svg>
                            </button>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: theme.textSecondary, fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: theme.danger || '#dc2626', opacity: 0.6 }} />
                  <span>Not connected</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: theme.bgInteractive, border: `1px solid ${theme.border}`, padding: '8px 10px', borderRadius: 10 }}>
              {/* Search input for arbitrary address */}
              <input
                value={searchAddress}
                onChange={e => setSearchAddress(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                placeholder="Search address..."
                style={{
                  background: theme.bgPanel,
                  border: `1px solid ${theme.border}`,
                  color: theme.textPrimary,
                  fontSize: 12,
                  padding: '6px 8px',
                  borderRadius: 6,
                  width: 170,
                  outline: 'none'
                }}
              />
              <button
                onClick={handleSearch}
                style={{
                  background: theme.primarySubtle,
                  color: theme.textPrimary,
                  border: `1px solid ${theme.border}`,
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'background-color 120ms, box-shadow 160ms'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = theme.bgPanelHover}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = theme.primarySubtle}
                onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.focusRing}`}
                onBlur={e => e.currentTarget.style.boxShadow = 'none'}
              >Search</button>
              {/* Refresh removed (now only inside account badge) */}
              {/* Connect button (disconnect moved near account badge) */}
              {!account ? (
                <button
                  onClick={connectWallet}
                  style={{
                    background: theme.accentSubtle || theme.primarySubtle,
                    color: theme.textPrimary,
                    border: `1px solid ${theme.border}`,
                    padding: '6px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'background-color 120ms, box-shadow 160ms'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = theme.bgPanelHover}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = theme.accentSubtle || theme.primarySubtle}
                  onFocus={e => e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.focusRing}`}
                  onBlur={e => e.currentTarget.style.boxShadow = 'none'}
                >Connect</button>
              ) : null}
            </div>
          </div>
        </div>
        {/* Supported Chains only if wallet connected or data loaded from search */}
        { (account || walletData) && (
          <div style={{ marginTop: 14 }}>
            {chainsLoading && (!supportedChains || supportedChains.length === 0) && (
              <div style={{ fontSize: 12, color: theme.textSecondary }}>Loading chains...</div>
            )}
            {supportedChains && supportedChains.length > 0 && (
              <div style={{
                display: 'flex',
                gap: 14,
                overflowX: 'auto',
                paddingBottom: 4,
                scrollbarWidth: 'thin'
              }}>
                {supportedChains.map((c, idx) => {
                  const name = c.displayName || c.name || c.shortName || `Chain ${idx+1}`
                  const canonicalKeyRaw = c.displayName || c.name || c.shortName || c.id || c.chainId || c.chain || c.network || c.networkId
                  const canonicalKey = String(canonicalKeyRaw)
                  const canonicalKeyNormalized = normalizeChainKey(canonicalKey)
                  const chainKeyFallback = String(c.id || c.chainId || c.chainID || c.chain || c.networkId || c.network || name)
                  const value = chainTotals[canonicalKey] ?? chainTotals[chainKeyFallback] ?? chainTotals[canonicalKey.toLowerCase()] ?? 0
                  const selectedSet = selectedChains || new Set()
                  const isSelected = selectedSet.has(canonicalKeyNormalized)
                  const percent = calculatePercentage(value, totalAllChains)

                  const baseBg = theme.bgInteractive
                  const selectedBg = theme.primarySubtle || theme.bgInteractive
                  const hoverBg = theme.bgInteractiveHover

                  return (
                    <div
                      key={canonicalKey}
                      onClick={() => toggleChainSelection(canonicalKeyNormalized)}
                      style={{
                        minWidth: 130, // reduced from 180
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 14, // slightly smaller radius
                        padding: '8px 10px', // reduced padding
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: 4,
                        cursor: 'pointer',
                        userSelect: 'none',
                        opacity: isSelected ? 1 : 0.35, // start a bit lighter
                        transition: 'opacity .18s',
                      }}
                      title={isSelected ? 'Clique para desselecionar' : 'Clique para selecionar'}
                      onMouseEnter={e => { if(!isSelected) e.currentTarget.style.opacity = 0.55 }}
                      onMouseLeave={e => { if(!isSelected) e.currentTarget.style.opacity = 0.35 }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: c.iconUrl ? '32px 1fr' : '1fr', columnGap: 8, rowGap: 2, alignItems: 'center' }}>
                        {c.iconUrl && (
                          <div style={{ width: 32, height: 32, gridRow: '1 / span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, overflow: 'hidden' }}>
                            <img
                              src={c.iconUrl}
                              alt={name}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              onError={e => { e.currentTarget.style.display = 'none' }}
                            />
                          </div>
                        )}
                        <div style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary, lineHeight: 1.2 }}>{name}</div>
                        <div style={{ fontSize: 11, color: theme.textSecondary, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 600, color: theme.textPrimary, fontSize: 12 }}>{maskValue(formatPrice(value))}</span>
                          <span style={{ fontSize: 10, color: theme.textMuted }}>{percent}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

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
                    {token.logo && (<img src={token.logo} alt={token.symbol} style={{ width: 24, height: 24, marginRight: 10, borderRadius: '50%', border: `1px solid ${theme.border}` }} onError={(e) => (e.currentTarget.style.display = 'none')} />)}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: theme.textPrimary, marginBottom: 2 }}>{token.symbol}</div>
                      <div style={{ fontSize: 12, color: theme.textSecondary }}>{token.name}</div>
                    </div>
                  </div>
                ),
                amount: showBalanceColumn ? maskValue(formatBalance(token.balance, token.native), { short: true }) : undefined,
                price: showUnitPriceColumn ? maskValue(formatPrice(token.price), { short: true }) : undefined,
                value: maskValue(formatPrice(token.totalPrice))
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
                icon={(
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      // border removed as requested
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      overflow: 'hidden'
                    }}
                  >
                    <svg
                      width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-wallet-icon lucide-wallet">
                      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                    </svg>
                  </div>
                )}
                rightPercent={walletPercent}
                rightValue={maskValue(formatPrice(walletValue))}
                isExpanded={tokensExpanded}
                onToggle={() => setTokensExpanded(!tokensExpanded)}
                transparentBody={true}
                infoBadges={infoBadges}
                optionsMenu={optionsMenu}
                customContent={
                  <div style={{ background: 'transparent', border: 'none', borderRadius: 8 }}>
                    <WalletTokensTable tokens={walletTokens} showBalanceColumn={showBalanceColumn} showUnitPriceColumn={showUnitPriceColumn} />
                  </div>
                }
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

                  const icon = (protocolGroup.protocol.logoURI || protocolGroup.protocol.logo)
                    ? (
                      <img
                        src={protocolGroup.protocol.logoURI || protocolGroup.protocol.logo}
                        alt={protocolGroup.protocol.name}
                        style={{ width: 22, height: 22, borderRadius: '50%', border: `1px solid ${theme.border}` }}
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
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
                  return (
                    <SectionTable
                      key={protocolGroup.protocol.name}
                      icon={icon}
                      title={protocolGroup.protocol.name}
                      transparentBody={true}
                      metricsRatio={[2,1,1,1]}
                      rightPercent={protocolPercent}
                      rightValue={maskValue(formatPrice(protocolTotal))}
                      rewardsValue={totalRewardsValue > 0 ? maskValue(formatPrice(totalRewardsValue)) : null}
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
          })()}
        </div>
      )}

      {/* Tooltip */}
      {tooltipVisible && (
        <div style={{ position: 'fixed', left: tooltipPosition.x - (tooltipVisible?.length || 0) * 3, top: tooltipPosition.y - 40, backgroundColor: mode === 'light' ? 'rgba(0,0,0,0.75)' : 'rgba(0, 0, 0, 0.9)', color: theme.textPrimary, padding: '8px 12px', borderRadius: 4, fontSize: 12, whiteSpace: 'pre-line', zIndex: 1000, maxWidth: 300, wordWrap: 'break-word', border: `1px solid ${theme.border}` }}>
          {tooltipVisible}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.45)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: theme.bgPanel, padding: 20, borderRadius: 10, fontSize: 15, color: theme.textPrimary, border: `1px solid ${theme.border}`, boxShadow: theme.shadowHover }}>Loading wallet data...</div>
        </div>
      )}
    </div>
    </ChainIconsProvider>
    </MaskValuesProvider>
  )
}

export default App