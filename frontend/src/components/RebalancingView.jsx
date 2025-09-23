import React from 'react'
import { useTheme } from '../context/ThemeProvider'
import { ITEM_TYPES } from '../utils/walletUtils'
import TokenDisplay from './TokenDisplay'
import { config } from '../config/api'
import { getFontStyles } from '../styles/fontStyles'

// Frontend mirror of backend enum
const RebalanceReferenceType = {
  Token: 'Token',
  Protocol: 'Protocol',
  Group: 'Group',
  TotalWallet: 'TotalWallet'
}

// Unified control height for selects and dropdowns
const CONTROL_HEIGHT = 38

const ASSET_TYPE_OPTIONS = [
  { value: ITEM_TYPES.WALLET, label: 'Wallet' },
  { value: ITEM_TYPES.LIQUIDITY_POOL, label: 'Liquidity Pools' },
  { value: ITEM_TYPES.LENDING_AND_BORROWING, label: 'Lending & Borrowing' },
  { value: ITEM_TYPES.STAKING, label: 'Staking' }
]

const GROUP_OPTIONS = [
  { value: ITEM_TYPES.WALLET, label: 'Wallet' },
  { value: ITEM_TYPES.LIQUIDITY_POOL, label: 'Liquidity Pools' },
  { value: ITEM_TYPES.LENDING_AND_BORROWING, label: 'Lending & Borrowing' },
  { value: ITEM_TYPES.STAKING, label: 'Staking' }
]

export default function RebalancingView({ walletTokens = [], getLiquidityPoolsData, getLendingAndBorrowingData, getStakingData, theme: themeProp, account, initialSavedKey, initialSavedCount, initialSavedItems }) {
  const { theme: themeCtx } = useTheme()
  const theme = themeProp || themeCtx
  const fontStyles = getFontStyles(theme)

  // Lightweight chain key resolver for uniqueness in IDs
  const getChainKey = React.useCallback((obj) => {
    if (!obj) return ''
    let raw = obj.chain || obj.chainId || obj.chainID || obj.network || obj.networkId || obj.chainName || ''
    if (!raw && typeof obj === 'object') {
      for (const k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue
        if (/(chain|network)/i.test(k)) {
          const v = obj[k]; if (v && (typeof v === 'string' || typeof v === 'number')) { raw = v; break }
        }
      }
    }
    const lower = (typeof raw === 'number' ? String(raw) : String(raw || '')).toLowerCase().trim()
    const norm = {
      '1': 'ethereum', 'eth': 'ethereum', 'ethereum': 'ethereum', 'mainnet': 'ethereum',
      '42161': 'arbitrum', 'arbitrum one': 'arbitrum', 'arbitrum': 'arbitrum', 'arb': 'arbitrum',
      '42170': 'arbitrum', 'arbitrum-nova': 'arbitrum',
      '8453': 'base', 'base': 'base',
      '137': 'polygon', 'matic': 'polygon', 'polygon': 'polygon',
      '43114': 'avalanche', 'avax': 'avalanche', 'avalanche': 'avalanche',
      '10': 'optimism', 'optimism': 'optimism', 'op': 'optimism',
      '56': 'bsc', 'bsc': 'bsc', 'bnb': 'bsc', 'binance': 'bsc', 'binance smart chain': 'bsc', 'bnb smart chain': 'bsc',
      '250': 'fantom', 'fantom': 'fantom', 'ftm': 'fantom',
      '84531': 'base'
    }
    return norm[lower] || lower
  }, [])

  // Prepare candidate lists
  const tokensList = React.useMemo(() => {
    return (walletTokens || []).map((t, i) => {
      const tok = t.token || t
      const baseId = tok.contractAddress || tok.tokenAddress || (tok.symbol || tok.name || 'token')
      const chainKey = getChainKey(tok)
      const id = `${baseId}#${chainKey || i}`
      const label = tok.symbol || tok.name || baseId
      return { id, label, raw: tok }
    })
  }, [walletTokens, getChainKey])

  const poolsList = React.useMemo(() => {
    const arr = (getLiquidityPoolsData?.() || [])
    return arr.map((item, i) => {
      const pos = item.position || item
      let label = pos?.name || item?.name
      if (!label && Array.isArray(pos?.tokens)) {
        const syms = pos.tokens.map(x => x?.symbol || x?.name).filter(Boolean)
        if (syms.length >= 2) label = `${syms[0]}/${syms[1]}`
      }
      const baseId = pos?.id || item?.id || label || `pool-${i}`
      const id = `${String(baseId)}#${i}`
      return { id, label: label || String(baseId), raw: item }
    })
  }, [getLiquidityPoolsData])

  const lendingList = React.useMemo(() => {
    const arr = (getLendingAndBorrowingData?.() || [])
    return arr.map((item, i) => {
      const pos = item.position || item
      const baseId = pos?.id || item?.id || `lend-${i}`
      const id = `${String(baseId)}#${i}`
      let label = pos?.name || item?.name
      if (!label) {
        const toks = Array.isArray(pos?.tokens) ? pos.tokens : []
        const norm = (x) => (x && x.token) ? x.token : x
        const supplied = toks.filter(t => {
          const ty = (t?.type || '').toString().toLowerCase()
          return ty === 'supplied' || ty === 'supply' || ty === 'deposit' || ty === 'collateral'
        }).map(norm)
        const choose = supplied.length ? supplied : toks.map(norm)
        const syms = choose.map(t => t?.symbol || t?.name).filter(Boolean)
        if (syms.length >= 2) label = `${syms[0]}/${syms[1]}`
        else if (syms.length === 1) label = syms[0]
      }
      if (!label) label = `Lending #${i+1}`
      return { id, label, raw: item }
    })
  }, [getLendingAndBorrowingData])

  const stakingList = React.useMemo(() => {
    const arr = (getStakingData?.() || [])
    return arr.map((item, i) => {
      const pos = item.position || item
      const baseId = pos?.id || item?.id || `stake-${i}`
      const id = `${String(baseId)}#${i}`
      const label = pos?.name || item?.name || `Staking #${i+1}`
      return { id, label, raw: item }
    })
  }, [getStakingData])

  // Reusable Info icon with click-to-toggle tooltip (matches SectionTable style)
  const CircleAlertIcon = ({ color, width = 14, height = 14, style = {}, onClick }) => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      onClick={onClick}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )

  const InfoIconWithTooltip = ({ content }) => {
    const [open, setOpen] = React.useState(false)
    const [pos, setPos] = React.useState({ top: 0, left: 0 })
    const ref = React.useRef(null)

    React.useEffect(() => {
      if (!open) return
      const onDocClick = (ev) => {
        if (!ref.current) return setOpen(false)
        if (!(ev.target instanceof Element)) return setOpen(false)
        if (!ev.target.closest('.rebalance-info-icon')) setOpen(false)
      }
      document.addEventListener('click', onDocClick)
      return () => document.removeEventListener('click', onDocClick)
    }, [open])

    const handleClick = (e) => {
      e.stopPropagation()
      if (ref.current) {
        const r = ref.current.getBoundingClientRect()
        setPos({ top: r.bottom + 4, left: r.left + r.width / 2 })
      }
      setOpen((v) => !v)
    }

    return (
      <span className="rebalance-info-icon" ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18 }}>
        <CircleAlertIcon color={open ? theme.info : theme.textSecondary} width={12} height={12} style={{ cursor: 'pointer' }} onClick={handleClick} />
        {open && (
          <div
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform: 'translateX(-50%)',
              backgroundColor: theme.bgPanel,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              padding: '10px 12px',
              boxShadow: theme.shadowHover || '0 4px 12px rgba(0,0,0,0.25)',
              zIndex: 10000,
              minWidth: 160,
              maxWidth: 320,
              ...fontStyles.secondary
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {content}
            <div
              style={{
                position: 'absolute',
                top: -6,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderBottom: `6px solid ${theme.border}`
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: -5,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderBottom: `6px solid ${theme.bgPanel}`
              }}
            />
          </div>
        )}
      </span>
    )
  }

  const allDefi = React.useMemo(() => {
    return [
      ...(getLiquidityPoolsData?.() || []),
      ...(getLendingAndBorrowingData?.() || []),
      ...(getStakingData?.() || [])
    ]
  }, [getLiquidityPoolsData, getLendingAndBorrowingData, getStakingData])

  const protocolsList = React.useMemo(() => {
    const set = new Map()
    const getLogoFromAny = (t) => {
      if (!t || typeof t !== 'object') return ''
      return t.logo || t.logoURI || t.image || t.icon || t.logoUrl || t.logo_url || t.iconUrl || t.icon_url || ''
    }
    allDefi.forEach((it, idx) => {
      const p = it.protocol || it.provider || it.platform || it?.position?.protocol
      const name = (typeof p === 'string' ? p : p?.name) || it?.protocolName || it?.position?.protocolName
      if (!name) return
      if (!set.has(name)) {
        // Try to find a logo from various shapes
        let logo = ''
        if (typeof p === 'object') logo = getLogoFromAny(p)
        if (!logo && it) logo = getLogoFromAny(it)
        if (!logo && it?.position) logo = getLogoFromAny(it.position)
        if (!logo && it?.position?.protocol) logo = getLogoFromAny(it.position.protocol)
        set.set(name, { id: name, label: name, raw: { logo } })
      }
    })
    return Array.from(set.values())
  }, [allDefi])

  // Form state
  // Start all selects unselected (placeholder)
  const [assetType, setAssetType] = React.useState('')
  const [assetId, setAssetId] = React.useState('')
  const [referenceType, setReferenceType] = React.useState('')
  const [referenceValue, setReferenceValue] = React.useState('')
  const [note, setNote] = React.useState(0)
  const [entries, setEntries] = React.useState([])
  const [saving, setSaving] = React.useState(false)
  const [saveResult, setSaveResult] = React.useState(null)
  const [showDialog, setShowDialog] = React.useState(false)
  const [editingId, setEditingId] = React.useState(null)

  // Options based on selections
  const assetOptions = React.useMemo(() => {
    switch (assetType) {
      case ITEM_TYPES.WALLET: return tokensList
      case ITEM_TYPES.LIQUIDITY_POOL: return poolsList
      case ITEM_TYPES.LENDING_AND_BORROWING: return lendingList
      case ITEM_TYPES.STAKING: return stakingList
      default: return []
    }
  }, [assetType, tokensList, poolsList, lendingList, stakingList])

  const referenceOptions = React.useMemo(() => {
    switch (referenceType) {
      case RebalanceReferenceType.Token: return tokensList
      case RebalanceReferenceType.Protocol: return protocolsList
      case RebalanceReferenceType.Group: return GROUP_OPTIONS.map(g => ({ id: String(g.value), label: g.label }))
      case RebalanceReferenceType.TotalWallet: return []
      default: return []
    }
  }, [referenceType, tokensList, protocolsList])

  // Reset dependent fields on changes
  React.useEffect(() => { if (!editingId) setAssetId('') }, [assetType, editingId])
  React.useEffect(() => { if (!editingId) setReferenceValue('') }, [referenceType, editingId])

  const canAdd = assetType !== '' && assetId && referenceType !== '' && (referenceType === RebalanceReferenceType.TotalWallet || referenceValue)

  const handleAdd = () => {
    if (!canAdd) return
    const atLabel = ASSET_TYPE_OPTIONS.find(a => a.value === assetType)?.label || String(assetType)
    const assetLabel = assetOptions.find(a => a.id === assetId)?.label || assetId
    const refLabel = referenceType === RebalanceReferenceType.TotalWallet
      ? 'Total Wallet'
      : (referenceOptions.find(r => r.id === referenceValue)?.label || referenceValue)
    const newId = `${assetType}-${assetId}-${referenceType}-${referenceValue || 'total'}`
    setEntries(prev => {
      if (prev.some(e => e.id === newId)) return prev // prevent duplicates
      return [
        ...prev,
        {
          id: newId,
          assetType,
          assetId,
          assetLabel,
          referenceType,
          referenceValue: referenceValue || null,
          referenceLabel: refLabel,
          note: Number(note) || 0
        }
      ]
    })
  }

  const handleSubmit = () => {
    if (!canAdd) return
    const refLabel = referenceType === RebalanceReferenceType.TotalWallet
      ? 'Total Wallet'
      : (referenceOptions.find(r => r.id === referenceValue)?.label || referenceValue)
    const assetLabel = assetOptions.find(a => a.id === assetId)?.label || assetId
    const newId = `${assetType}-${assetId}-${referenceType}-${referenceValue || 'total'}`
    if (editingId) {
      // Update existing
      const dup = entries.some(e => e.id === newId && e.id !== editingId)
      if (dup) return
      setEntries(prev => prev.map(e => e.id === editingId ? {
        ...e,
        id: newId,
        assetType,
        assetId,
        assetLabel,
        referenceType,
        referenceValue: referenceValue || null,
        referenceLabel: refLabel,
        note: Number(note) || 0
      } : e))
      setEditingId(null)
    } else {
      handleAdd()
    }
    setShowDialog(false)
  }

  const removeEntry = (id) => setEntries(prev => prev.filter(e => e.id !== id))

  // Helpers reused for icon rendering in entries list
  const getLogoFromAnyTop = React.useCallback((t) => {
    if (!t || typeof t !== 'object') return ''
    return t.logo || t.logoURI || t.image || t.icon || t.logoUrl || t.logo_url || t.iconUrl || t.icon_url || ''
  }, [])
  // No token logo fallbacks: rely only on provided logo fields

  const inputBase = {
    background: theme.bgPanel,
    border: `1px solid ${theme.border}`,
    color: theme.textPrimary,
    padding: '8px 10px',
    borderRadius: 8,
    fontSize: 13,
    outline: 'none',
    width: '100%',
    height: CONTROL_HEIGHT,
    boxSizing: 'border-box'
  }

  // --- Current value and percentage computations ---
  const getPositionTokens = React.useCallback((pos) => {
    if (!pos || typeof pos !== 'object') return []
    if (Array.isArray(pos.tokens) && pos.tokens.length) return pos.tokens
    if (Array.isArray(pos.pool?.tokens) && pos.pool.tokens.length) return pos.pool.tokens
    const t0 = pos.token0 || pos.tokenA || pos.baseToken || pos.primaryToken
    const t1 = pos.token1 || pos.tokenB || pos.quoteToken || pos.secondaryToken
    const arr = []
    if (t0) arr.push(t0)
    if (t1) arr.push(t1)
    return arr
  }, [])

  const toNumber = (v) => {
    const n = Number(v)
    return isFinite(n) ? n : 0
  }

  const tokenTotalPrice = React.useCallback((tok) => {
    if (!tok || typeof tok !== 'object') return 0
    const raw = tok.token || tok
    const direct = raw.totalPrice ?? raw.financials?.totalPrice
    return toNumber(direct)
  }, [])

  const signedTokenValue = React.useCallback((tok, pos) => {
    // Borrowed/debt negative, others positive (best-effort)
    const t = ((tok?.type || tok?.label || '') + '').toLowerCase()
    const val = Math.abs(tokenTotalPrice(tok))
    if (t.includes('borrow') || t.includes('debt')) return -val
    if (!t) {
      const lbl = ((pos?.position?.label || pos?.label || '') + '').toLowerCase()
      if (lbl.includes('borrow') || lbl.includes('debt')) return -val
    }
    return val
  }, [tokenTotalPrice])

  const entryCurrentValues = React.useMemo(() => {
    const map = new Map()
    entries.forEach(e => {
      let cur = 0
      if (e.assetType === ITEM_TYPES.WALLET) {
        const tok = tokensList.find(o => o.id === e.assetId)?.raw
        cur = tokenTotalPrice(tok)
      } else if (e.assetType === ITEM_TYPES.LIQUIDITY_POOL) {
        const raw = poolsList.find(o => o.id === e.assetId)?.raw
        const pos = raw?.position || raw
        const toks = getPositionTokens(pos).map(x => (x && x.token) ? x.token : x)
        if (toks.length) cur = toks.reduce((s, t) => s + tokenTotalPrice(t), 0)
        else cur = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice)
      } else if (e.assetType === ITEM_TYPES.LENDING_AND_BORROWING) {
        const raw = lendingList.find(o => o.id === e.assetId)?.raw
        const pos = raw?.position || raw
        const toks = Array.isArray(pos?.tokens) ? pos.tokens : []
        if (toks.length) cur = toks.reduce((s, t) => s + signedTokenValue(t, pos), 0)
        else cur = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice)
      } else if (e.assetType === ITEM_TYPES.STAKING) {
        const raw = stakingList.find(o => o.id === e.assetId)?.raw
        const pos = raw?.position || raw
        // Prefer explicit totalPrice/value; else sum tokens; else use balance (already USD?)
        const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice)
        if (explicit) cur = explicit
        else {
          const toks = getPositionTokens(pos).map(x => (x && x.token) ? x.token : x)
          if (toks.length) cur = toks.reduce((s, t) => s + tokenTotalPrice(t), 0)
          else cur = toNumber(pos?.balance)
        }
      }
      map.set(e.id, cur)
    })
    return map
  }, [entries, tokensList, poolsList, lendingList, stakingList, getPositionTokens, tokenTotalPrice, signedTokenValue])

  // Total portfolio current value (Wallet + Liquidity + Lending net + Staking)
  const totalPortfolioCurrent = React.useMemo(() => {
    // Wallet tokens
    const walletSum = tokensList.reduce((s, o) => s + tokenTotalPrice(o.raw), 0)
    // Liquidity pools
    const poolsSum = poolsList.reduce((s, o) => {
      const pos = (o.raw?.position || o.raw)
      const toks = getPositionTokens(pos).map(x => (x && x.token) ? x.token : x)
      if (toks.length) return s + toks.reduce((ss, t) => ss + tokenTotalPrice(t), 0)
      const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice)
      return s + explicit
    }, 0)
    // Lending (signed)
    const lendingSum = lendingList.reduce((s, o) => {
      const pos = (o.raw?.position || o.raw)
      const toks = Array.isArray(pos?.tokens) ? pos.tokens : []
      if (toks.length) return s + toks.reduce((ss, t) => ss + signedTokenValue(t, pos), 0)
      const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice)
      return s + explicit
    }, 0)
    // Staking
    const stakingSum = stakingList.reduce((s, o) => {
      const pos = (o.raw?.position || o.raw)
      const explicit = toNumber(pos?.totalPrice ?? pos?.value ?? pos?.financials?.totalPrice)
      if (explicit) return s + explicit
      const toks = getPositionTokens(pos).map(x => (x && x.token) ? x.token : x)
      if (toks.length) return s + toks.reduce((ss, t) => ss + tokenTotalPrice(t), 0)
      return s + toNumber(pos?.balance)
    }, 0)
    return walletSum + poolsSum + lendingSum + stakingSum
  }, [tokensList, poolsList, lendingList, stakingList, getPositionTokens, tokenTotalPrice, signedTokenValue])

  const bucketKey = (e) => `${e.referenceType}:${e.referenceValue ?? 'total'}`

  const bucketNoteSums = React.useMemo(() => {
    const m = new Map()
    entries.forEach(e => {
      const k = bucketKey(e)
      m.set(k, (m.get(k) || 0) + (Number(e.note) || 0))
    })
    return m
  }, [entries])

  const bucketCurrentSums = React.useMemo(() => {
    const m = new Map()
    entries.forEach(e => {
      const k = bucketKey(e)
      const v = entryCurrentValues.get(e.id) || 0
      m.set(k, (m.get(k) || 0) + v)
    })
    // For TotalWallet bucket, use the entire portfolio current value
    const hasTotalWallet = entries.some(e => e.referenceType === RebalanceReferenceType.TotalWallet)
    if (hasTotalWallet) {
      m.set(`${RebalanceReferenceType.TotalWallet}:total`, totalPortfolioCurrent)
    }
    return m
  }, [entries, entryCurrentValues, totalPortfolioCurrent])

  // Prefill entries from backend-saved items
  React.useEffect(() => {
    if (!Array.isArray(initialSavedItems) || initialSavedItems.length === 0) return
    // Build a lookup for labels
    const tokenById = new Map(tokensList.map(t => [t.id, t]))
    const poolById = new Map(poolsList.map(p => [p.id, p]))
    const lendById = new Map(lendingList.map(l => [l.id, l]))
    const stakeById = new Map(stakingList.map(s => [s.id, s]))
    const protoById = new Map(protocolsList.map(p => [p.id, p]))

    const mapRefType = (n) => {
      if (n === 0) return RebalanceReferenceType.Token
      if (n === 1) return RebalanceReferenceType.Protocol
      if (n === 2) return RebalanceReferenceType.Group
      if (n === 3) return RebalanceReferenceType.TotalWallet
      return RebalanceReferenceType.Protocol
    }

    const makeAssetLabel = (assetId, type) => {
      const src = type === ITEM_TYPES.WALLET ? tokenById
        : type === ITEM_TYPES.LIQUIDITY_POOL ? poolById
        : type === ITEM_TYPES.LENDING_AND_BORROWING ? lendById
        : type === ITEM_TYPES.STAKING ? stakeById
        : null
      return src?.get(assetId)?.label || assetId
    }

    const makeRefLabel = (refType, val) => {
      if (refType === RebalanceReferenceType.TotalWallet) return 'Total Wallet'
      if (refType === RebalanceReferenceType.Group) {
        const g = GROUP_OPTIONS.find(g => String(g.value) === String(val))
        return g?.label || String(val)
      }
      if (refType === RebalanceReferenceType.Token) return tokenById.get(val)?.label || String(val)
      if (refType === RebalanceReferenceType.Protocol) return protoById.get(val)?.label || String(val)
      return String(val)
    }

    const mapped = initialSavedItems.map(it => {
      const refType = mapRefType(it.byGroupType)
      const entry = {
        id: `${it.type}-${it.asset}-${refType}-${refType === RebalanceReferenceType.TotalWallet ? 'total' : (it.value || '')}`,
        assetType: it.type,
        assetId: it.asset,
        assetLabel: makeAssetLabel(it.asset, it.type),
        referenceType: refType,
        referenceValue: it.value,
        referenceLabel: makeRefLabel(refType, it.value),
        note: it.note ?? 0
      }
      return entry
    })
    // Deduplicate with existing entries and set
    setEntries(prev => {
      const byId = new Map(prev.map(e => [e.id, e]))
      mapped.forEach(m => { if (!byId.has(m.id)) byId.set(m.id, m) })
      return Array.from(byId.values())
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSavedItems, tokensList, poolsList, lendingList, stakingList, protocolsList])

  // Duplicate detection for current selection (used to disable Add in dialog)
  const candidateId = (assetType !== '' && assetId && referenceType !== '')
    ? `${assetType}-${assetId}-${referenceType}-${referenceType === RebalanceReferenceType.TotalWallet ? 'total' : (referenceValue || '')}`
    : ''
  const isDuplicateCandidate = candidateId ? entries.some(e => e.id === candidateId && e.id !== editingId) : false

  // Map reference type to backend enum numeric values (Token=0, Protocol=1, Group=2, TotalWallet=3)
  const REF_ENUM_MAP = {
    [RebalanceReferenceType.Token]: 0,
    [RebalanceReferenceType.Protocol]: 1,
    [RebalanceReferenceType.Group]: 2,
    [RebalanceReferenceType.TotalWallet]: 3
  }

  return (
    <div style={{
      background: theme.bgInteractive,
      border: `1px solid ${theme.border}`,
      borderRadius: 12,
      padding: 16,
      color: theme.textPrimary
    }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Rebalancing</div>
          {initialSavedKey && (
            <div style={{ fontSize: 12, color: theme.textSecondary }} title={`key: ${initialSavedKey}`}>
              last saved • items: {initialSavedCount ?? 0}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowDialog(true)}
          style={{
            background: theme.accentSubtle || theme.primarySubtle,
            color: theme.textPrimary,
            border: `1px solid ${theme.border}`,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            cursor: 'pointer'
          }}
        >Add</button>
      </div>

      {/* Modal Dialog for adding item */}
      {showDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: theme.bgPanel, border: `1px solid ${theme.border}`, borderRadius: 12, width: 'min(860px, 96vw)', maxWidth: 860, padding: 16, boxShadow: theme.shadowHover }}>
            <div style={{ marginBottom: 12, fontWeight: 700, fontSize: 16 }}>{editingId ? 'Edit Rebalancing Item' : 'Add Rebalancing Item'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 1.2fr 0.8fr', gap: 12, alignItems: 'start' }}>
              {/* Asset Type */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, color: theme.textSecondary, fontWeight: 600 }}>Asset Type</div>
                <select value={assetType} onChange={e => setAssetType(e.target.value === '' ? '' : Number(e.target.value))} style={inputBase}>
                  <option value="">Select asset type…</option>
                  {ASSET_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Asset (custom dropdown) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, color: theme.textSecondary, fontWeight: 600 }}>Asset</div>
                <AssetDropdown
                  theme={theme}
                  assetType={assetType}
                  value={assetId}
                  options={assetOptions}
                  onChange={setAssetId}
                  tokensList={tokensList}
                  placeholder="Select asset…"
                />
              </div>

              {/* Reference Type */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, color: theme.textSecondary, fontWeight: 600 }}>Reference Type</div>
                <select value={referenceType} onChange={e => setReferenceType(e.target.value)} style={inputBase}>
                  <option value="">Select reference type…</option>
                  {Object.values(RebalanceReferenceType).map(rt => (
                    <option key={rt} value={rt}>{rt}</option>
                  ))}
                </select>
              </div>

              {/* Reference Value (conditional) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, color: theme.textSecondary, fontWeight: 600 }}>Reference Value</div>
                {referenceType === RebalanceReferenceType.TotalWallet ? (
                  <div style={{ fontSize: 12, color: theme.textSecondary, padding: '0 10px', height: CONTROL_HEIGHT, display: 'flex', alignItems: 'center', border: `1px solid ${theme.border}`, borderRadius: 8, width: '100%', boxSizing: 'border-box' }}>—</div>
                ) : referenceType === RebalanceReferenceType.Token ? (
                  <AssetDropdown
                    theme={theme}
                    assetType={ITEM_TYPES.WALLET}
                    value={referenceValue}
                    options={tokensList}
                    onChange={setReferenceValue}
                    tokensList={tokensList}
                    placeholder="Select value…"
                  />
                ) : referenceType === RebalanceReferenceType.Protocol ? (
                  <AssetDropdown
                    theme={theme}
                    assetType="PROTOCOL"
                    value={referenceValue}
                    options={protocolsList}
                    onChange={setReferenceValue}
                    placeholder="Select value…"
                  />
                ) : (
                  <select value={referenceValue} onChange={e => setReferenceValue(e.target.value)} style={inputBase}>
                    <option value="">Select value…</option>
                    {referenceOptions.map((opt, idx) => (
                      <option key={`${opt.id}-${idx}`} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Note 0..100 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, color: theme.textSecondary, fontWeight: 600 }}>Note</div>
                <select value={note} onChange={e => setNote(Number(e.target.value))} style={inputBase}>
                  {Array.from({ length: 101 }, (_, n) => n).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
              <div style={{ fontSize: 12, color: isDuplicateCandidate ? theme.textSecondary : 'transparent' }}>
                {isDuplicateCandidate ? 'This item is already in the list.' : ' '}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { setShowDialog(false); if (editingId) setEditingId(null) }}
                  style={{ background: 'transparent', color: theme.textSecondary, border: `1px solid ${theme.border}`, padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
                >Cancel</button>
                <button
                  type="button"
                  disabled={!canAdd || isDuplicateCandidate}
                  onClick={() => { if (!isDuplicateCandidate && canAdd) { handleSubmit() } }}
                  style={{ background: (!canAdd || isDuplicateCandidate) ? theme.bgPanel : (theme.accentSubtle || theme.primarySubtle), color: theme.textPrimary, border: `1px solid ${theme.border}`, padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: (!canAdd || isDuplicateCandidate) ? 'not-allowed' : 'pointer' }}
                >{editingId ? 'Save' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Entries List */}
      {entries.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            border: `1px solid ${theme.border}`,
            borderRadius: 10,
            overflow: 'hidden'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.9fr 1.6fr 0.8fr 0.8fr 0.8fr 0.6fr 72px', gap: 0, background: theme.headerBg || theme.bgPanel, padding: '10px 12px', fontSize: 12, color: theme.textSecondary, fontWeight: 700 }}>
              <div>Asset</div>
              <div>Reference</div>
              <div>% Current</div>
              <div>% Target</div>
              <div>% Diff</div>
              <div>Note</div>
              <div></div>
            </div>
            {[ITEM_TYPES.WALLET, ITEM_TYPES.LIQUIDITY_POOL, ITEM_TYPES.LENDING_AND_BORROWING, ITEM_TYPES.STAKING]
              .filter(t => entries.some(e => e.assetType === t))
              .map(type => (
                <React.Fragment key={`grp-${type}`}>
                  {/* Group header */}
                  <div style={{
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    background: theme.bgPanelHover,
                    borderTop: `1px solid ${theme.border}`,
                    color: theme.textSecondary
                  }}>
                    {ASSET_TYPE_OPTIONS.find(a => a.value === type)?.label || String(type)}
                  </div>
                  {entries.filter(e => e.assetType === type).map(row => {
              // Resolve asset option by type
              let assetOpt = null
              if (row.assetType === ITEM_TYPES.WALLET) assetOpt = tokensList.find(o => o.id === row.assetId)
              else if (row.assetType === ITEM_TYPES.LIQUIDITY_POOL) assetOpt = poolsList.find(o => o.id === row.assetId)
              else if (row.assetType === ITEM_TYPES.LENDING_AND_BORROWING) assetOpt = lendingList.find(o => o.id === row.assetId)
              else if (row.assetType === ITEM_TYPES.STAKING) assetOpt = stakingList.find(o => o.id === row.assetId)

              const renderAssetIcons = () => {
                if (!assetOpt) return null
                const raw = assetOpt.raw || {}
                if (row.assetType === ITEM_TYPES.WALLET) {
                  return <TokenDisplay tokens={[raw]} showName={false} showText={false} size={18} gap={6} showChain={true} />
                }
                const pos = raw.position || raw
                let toks = []
                if (Array.isArray(pos?.tokens) && pos.tokens.length) {
                  toks = pos.tokens.map(x => (x && x.token) ? x.token : x)
                } else if (Array.isArray(pos?.pool?.tokens) && pos.pool.tokens.length) {
                  toks = pos.pool.tokens.map(x => (x && x.token) ? x.token : x)
                } else {
                  const t0 = pos.token0 || pos.tokenA || pos.baseToken || pos.primaryToken
                  const t1 = pos.token1 || pos.tokenB || pos.quoteToken || pos.secondaryToken
                  if (t0) toks.push((t0 && t0.token) ? t0.token : t0)
                  if (t1) toks.push((t1 && t1.token) ? t1.token : t1)
                }
                toks = toks.filter(Boolean)
                if (toks.length >= 2) return <TokenDisplay tokens={[toks[0], toks[1]]} showName={false} showText={false} size={18} gap={6} showChain={true} />
                if (toks.length === 1) return <TokenDisplay tokens={[toks[0]]} showName={false} showText={false} size={18} gap={6} showChain={true} />
                return <div style={{ width: 18, height: 18, borderRadius: '50%', background: theme.bgPanel, border: `1px solid ${theme.border}` }} />
              }

              const renderReferenceIcons = () => {
                if (row.referenceType === RebalanceReferenceType.TotalWallet) return null
                if (row.referenceType === RebalanceReferenceType.Token) {
                  const refOpt = tokensList.find(o => o.id === row.referenceValue)
                  const tok = refOpt?.raw
                  if (tok) return <TokenDisplay tokens={[tok]} showName={false} showText={false} size={18} gap={6} showChain={true} />
                  return null
                }
                if (row.referenceType === RebalanceReferenceType.Protocol) {
                  const refOpt = protocolsList.find(o => o.id === row.referenceValue)
                  const logo = getLogoFromAnyTop(refOpt?.raw)
                  if (logo) return <img src={logo} alt="protocol" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                  return <div style={{ width: 18, height: 18, borderRadius: '50%', background: theme.bgPanel, border: `1px solid ${theme.border}` }} />
                }
                // Group/no-icon fallback
                return null
              }

              // Compute % Current and % Target scoped to the same Reference bucket
              const bucket = bucketKey(row)
              const curSum = bucketCurrentSums.get(bucket) || 0
              const noteSum = bucketNoteSums.get(bucket) || 0
              const curVal = entryCurrentValues.get(row.id) || 0
              const pctCurrent = curSum > 0 ? ((curVal / curSum) * 100) : 0
              const pctTarget = noteSum > 0 ? (((Number(row.note) || 0) / noteSum) * 100) : 0

              const fmtPct = (n) => `${n.toFixed(2)}%`
              const fmtUSD = (n) => {
                const abs = Math.abs(n)
                const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                return (n < 0 ? '-$' : '$') + formatted
              }
              const targetVal = noteSum > 0 ? (((Number(row.note) || 0) / noteSum) * curSum) : 0
              const diffVal = targetVal - curVal

              return (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1.9fr 1.6fr 0.8fr 0.8fr 0.8fr 0.6fr 72px', gap: 0, borderTop: `1px solid ${theme.border}`, padding: '10px 12px', fontSize: 13, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {renderAssetIcons()}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.assetLabel}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {row.referenceType !== RebalanceReferenceType.TotalWallet && renderReferenceIcons()}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.referenceType === RebalanceReferenceType.TotalWallet
                        ? 'Total Wallet'
                        : `${row.referenceType}: ${row.referenceLabel}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {fmtPct(Math.max(0, pctCurrent))}
                    <InfoIconWithTooltip content={`Current: ${fmtUSD(curVal)}`} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {fmtPct(Math.max(0, pctTarget))}
                    <InfoIconWithTooltip content={`Target: ${fmtUSD(targetVal)}`} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: (pctTarget - pctCurrent) > 0 ? (theme.successText || '#16a34a') : ((pctTarget - pctCurrent) < 0 ? (theme.dangerText || '#dc2626') : theme.textPrimary) }}>
                    {((pctTarget - pctCurrent) >= 0 ? '+' : '') + (pctTarget - pctCurrent).toFixed(2) + '%'}
                    <InfoIconWithTooltip content={`Diff: ${fmtUSD(diffVal)}`} />
                  </div>
                   <div>{row.note}</div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <button
                      title="Edit"
                      onClick={() => {
                        setEditingId(row.id)
                        setAssetType(row.assetType)
                        setAssetId(row.assetId)
                        setReferenceType(row.referenceType)
                        setReferenceValue(row.referenceType === RebalanceReferenceType.TotalWallet ? '' : (row.referenceValue || ''))
                        setNote(Number(row.note) || 0)
                        setShowDialog(true)
                      }}
                      style={{
                        background: 'transparent',
                        color: theme.textSecondary,
                        border: 'none',
                        borderRadius: 6,
                        padding: 4,
                        width: 28,
                        height: 28,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = theme.bgPanelHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                        <path d="M14.06 6.19l3.75 3.75 1.44-1.44a1.5 1.5 0 0 0 0-2.12l-1.63-1.63a1.5 1.5 0 0 0-2.12 0l-1.44 1.44z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      </svg>
                    </button>
                     <button
                       title="Remove"
                       onClick={() => removeEntry(row.id)}
                       style={{
                         background: 'transparent',
                         color: theme.textSecondary,
                         border: 'none',
                         borderRadius: 6,
                         padding: 4,
                         width: 28,
                         height: 28,
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         cursor: 'pointer'
                       }}
                       onMouseEnter={e => e.currentTarget.style.background = theme.bgPanelHover}
                       onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                     >
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                         <path d="M3 6H5H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                         <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                         <path d="M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                         <path d="M10 11V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                         <path d="M14 11V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                       </svg>
                     </button>
                   </div>
                </div>
              )
                  })}
                </React.Fragment>
              ))}
          </div>
          {/* Save bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
            <div style={{ fontSize: 12, color: theme.textSecondary }}>
              {saveResult ? (
                <span>Saved: key {saveResult.key} • items {saveResult.itemsCount} • accounts {Array.isArray(saveResult.accounts) ? saveResult.accounts.join(', ') : ''}</span>
              ) : (
                <span>Add items and click Save to persist</span>
              )}
            </div>
            <button
              disabled={saving}
              onClick={async () => {
                try {
                  setSaving(true)
                  setSaveResult(null)
                  const payload = {
                    AccountId: account || undefined,
                    Items: entries.map(e => ({
                      Version: '1',
                      Asset: e.assetId,
                      Type: e.assetType,
                      Note: e.note,
                      ByGroupType: REF_ENUM_MAP[e.referenceType] ?? 0,
                      Value: e.referenceType === 'TotalWallet' ? null : (e.referenceValue || e.referenceLabel)
                    }))
                  }
                  const res = await fetch(`${config.API_BASE_URL}/api/v1/rebalances`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  })
                  if (!res.ok) {
                    let msg = `Save failed: ${res.status} ${res.statusText}`
                    try {
                      const errJson = await res.json()
                      if (errJson?.title || errJson?.error) msg += ` - ${errJson.title || errJson.error}`
                      if (errJson?.errors) msg += `\n${JSON.stringify(errJson.errors)}`
                    } catch {
                      const text = await res.text()
                      if (text) msg += ` - ${text}`
                    }
                    throw new Error(msg)
                  }
                  const data = await res.json()
                  setSaveResult({ key: data.key, itemsCount: data.itemsCount, accounts: data.accounts })
                } catch (err) {
                  console.error('Save error', err)
                  alert(err.message || 'Save failed')
                } finally {
                  setSaving(false)
                }
              }}
              style={{
                background: saving ? theme.bgPanel : (theme.accentSubtle || theme.primarySubtle),
                color: theme.textPrimary,
                border: `1px solid ${theme.border}`,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 13,
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AssetDropdown({ theme, assetType, value, options, onChange, tokensList = [], placeholder = 'Select asset…' }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef(null)

  React.useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selected = options.find(o => o.id === value)

  const renderPreview = () => {
    if (!selected) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Ghost icon placeholder to keep height stable (matches TokenDisplay size 18, pair width ~21) */}
        <div style={{ position: 'relative', width: 21, height: 18, flex: '0 0 auto' }}>
          <div style={{ position: 'absolute', left: 0, top: 2, width: 14, height: 14 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'transparent' }} />
          </div>
          <div style={{ position: 'absolute', left: 7, top: 2, width: 14, height: 14 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'transparent' }} />
          </div>
        </div>
        <span style={{ color: theme.textSecondary }}>{placeholder}</span>
      </div>
    )
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {renderAssetIcon(assetType, selected)}
        <span style={{ color: theme.textPrimary }}>{selected.label}</span>
      </div>
    )
  }

  const getLogoFromAny = (t) => {
    if (!t || typeof t !== 'object') return ''
    return t.logo || t.logoURI || t.image || t.icon || t.logoUrl || t.logo_url || t.iconUrl || t.icon_url || ''
  }

  const renderAssetIcon = (type, opt) => {
    const raw = opt.raw || {}
    if (type === ITEM_TYPES.WALLET) {
      const tok = raw
      return <TokenDisplay tokens={[tok]} showName={false} showText={false} size={18} gap={6} showChain={true} />
    }
    if (type === 'PROTOCOL') {
      const logo = getLogoFromAny(raw)
      if (logo) {
        return (
          <div style={{ position: 'relative', width: 18, height: 18, flex: '0 0 auto' }}>
            <img src={logo} alt="protocol" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
          </div>
        )
      }
      return (
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: theme.bgPanel, border: `1px solid ${theme.border}` }} />
      )
    }
    const pos = raw.position || raw
    // Try multiple shapes to extract up to 2 tokens with logo/symbol/name
    let toks = []
    if (Array.isArray(pos?.tokens) && pos.tokens.length) {
      toks = pos.tokens.map(x => (x && x.token) ? x.token : x)
    } else if (Array.isArray(pos?.pool?.tokens) && pos.pool.tokens.length) {
      toks = pos.pool.tokens.map(x => (x && x.token) ? x.token : x)
    } else {
      const t0 = pos.token0 || pos.tokenA || pos.baseToken || pos.primaryToken
      const t1 = pos.token1 || pos.tokenB || pos.quoteToken || pos.secondaryToken
      if (t0) toks.push((t0 && t0.token) ? t0.token : t0)
      if (t1) toks.push((t1 && t1.token) ? t1.token : t1)
    }
    toks = toks.filter(Boolean)
  // No token logo fallbacks: rely only on provided logo fields
    if (toks.length >= 2) {
      return <TokenDisplay tokens={[toks[0], toks[1]]} showName={false} showText={false} size={18} gap={6} showChain={true} />
    }
    if (toks.length === 1) {
      return <TokenDisplay tokens={[toks[0]]} showName={false} showText={false} size={18} gap={6} showChain={true} />
    }
    // Fallback icon
    return (
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: theme.bgPanel, border: `1px solid ${theme.border}` }} />)
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: theme.bgPanel,
          border: `1px solid ${theme.border}`,
          color: theme.textPrimary,
          padding: '8px 10px',
          borderRadius: 8,
          fontSize: 13,
          outline: 'none',
          width: '100%',
          minWidth: 0,
          height: CONTROL_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          cursor: 'pointer',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          {renderPreview()}
        </div>
        <span style={{ color: theme.textSecondary }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 6px)', left: 0, right: 0, background: theme.bgPanel, border: `1px solid ${theme.border}`, borderRadius: 8, boxShadow: theme.shadowHover, maxHeight: 300, overflowY: 'auto' }}>
          <div style={{ padding: 6 }}>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8, background: 'transparent', border: 'none', color: theme.textSecondary, padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
            >
              <span>— None —</span>
            </button>
            {options.map((opt, idx) => (
              <button
                key={`${opt.id}-${idx}`}
                type="button"
                onClick={() => { onChange(opt.id); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 10, background: 'transparent', border: 'none', color: theme.textPrimary, padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = theme.bgPanelHover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {renderAssetIcon(assetType, opt)}
                <span style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
