import React from 'react'
import { formatTokenDisplay } from '../utils/tokenDisplay'
import { useTheme } from '../context/ThemeProvider'
import { useChainIcons } from '../context/ChainIconsProvider'

/**
 * TokenDisplay
 * Props:
 * - tokens: array (1 or 2 token-like objects)
 * - showName?: boolean (default false -> shows symbol(s) only)
 * - size?: number (base circle diameter for single token, default 26)
 * - gap?: number (space between logo block and text, default 10)
 * - className?: string (optional wrapper class)
 * - style?: object (extra wrapper styles)
 * - showChain?: boolean (default true -> show chain badge overlay)
 * - getChainIcon?: (chainKey: string) => string | undefined (optional custom resolver)
 */
export default function TokenDisplay({ tokens = [], showName = false, size = 26, gap = 10, className = '', style = {}, showChain = true, getChainIcon }) {
  const { theme } = useTheme()
  const { getIcon: getChainIconFromContext } = useChainIcons()
  const { logos, text } = formatTokenDisplay(tokens, { showName })
  if (!logos.length) return null

  const isPair = logos.length === 2
  const pairSize = Math.round(size * 0.77)
  const overlap = Math.round(pairSize * 0.52)

  // Determine chain (prefer first token's chain-like fields)
  const baseToken = tokens[0] || {}
  // Attempt direct field extraction
  let raw = baseToken.chain || baseToken.chainId || baseToken.chainID || baseToken.network || baseToken.networkId || baseToken.chainName || ''
  // If still empty, scan keys (covers variations like capitalized 'Chain')
  if (!raw && baseToken && typeof baseToken === 'object') {
    for (const k in baseToken) {
      if (!Object.prototype.hasOwnProperty.call(baseToken, k)) continue
      if (/(chain|network)/i.test(k)) {
        const v = baseToken[k]
        if (v && (typeof v === 'string' || typeof v === 'number')) { raw = v; break }
      }
    }
  }
  const lowerRaw = (typeof raw === 'number' ? String(raw) : String(raw || '')).toLowerCase().trim()

  // Normalize various chain representations (ids, labels, aliases)
  const chainNormalization = {
    // Ethereum
    '1': 'ethereum', 'eth': 'ethereum', 'ethereum': 'ethereum', 'mainnet': 'ethereum',
    // Arbitrum
    '42161': 'arbitrum', 'arbitrum one': 'arbitrum', 'arbitrum': 'arbitrum', 'arb': 'arbitrum',
    // Arbitrum Nova
    '42170': 'arbitrum', 'arbitrum-nova': 'arbitrum',
    // Base
    '8453': 'base', 'base': 'base',
    // Polygon
    '137': 'polygon', 'matic': 'polygon', 'polygon': 'polygon',
    // Avalanche
    '43114': 'avalanche', 'avax': 'avalanche', 'avalanche': 'avalanche',
    // Optimism
    '10': 'optimism', 'optimism': 'optimism', 'op': 'optimism',
  // BSC
  '56': 'bsc', 'bsc': 'bsc', 'bnb': 'bsc', 'binance': 'bsc', 'binance smart chain': 'bsc', 'bnb smart chain': 'bsc',
    // Fantom
    '250': 'fantom', 'fantom': 'fantom', 'ftm': 'fantom',
    // Others (extend as needed)
    '84531': 'base' // Base testnet alias if appears
  }

  const chainKey = chainNormalization[lowerRaw] || lowerRaw

  // Simple internal mapping (can be expanded / replaced)
  const builtinChainIcons = {
    ethereum: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    eth: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    arbitrum: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    arb: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    base: 'https://assets.coingecko.com/coins/images/31069/small/base-network_200x200.png',
    polygon: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    matic: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    avalanche: 'https://cryptologos.cc/logos/avalanche-avax-logo.png',
    avax: 'https://cryptologos.cc/logos/avalanche-avax-logo.png',
    optimism: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
    op: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
    bsc: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
    binance: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
    fantom: 'https://cryptologos.cc/logos/fantom-ftm-logo.png',
    ftm: 'https://cryptologos.cc/logos/fantom-ftm-logo.png'
  }

  let resolvedIcon = undefined
  if (showChain && chainKey) {
    // 1) explicit prop resolver
    if (getChainIcon) resolvedIcon = getChainIcon(chainKey)
    // 2) context mapping from supportedChains
    if (!resolvedIcon && getChainIconFromContext) resolvedIcon = getChainIconFromContext(chainKey)
    // 3) builtin fallback
    if (!resolvedIcon) resolvedIcon = builtinChainIcons[chainKey]
  }

  const [chainLoaded, setChainLoaded] = React.useState(false)
  const [chainFailed, setChainFailed] = React.useState(false)
  React.useEffect(() => {
    // Reset when chain changes
    setChainLoaded(false)
    setChainFailed(false)
  }, [chainKey, resolvedIcon])

  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center', gap, ...style }}>
      {/* Logo container */}
      <div style={{ position: 'relative', width: isPair ? pairSize + overlap : size, height: size, flex: '0 0 auto' }}>
        {logos.map((l, idx) => {
          const dim = isPair ? pairSize : size
          const left = isPair ? idx * overlap : 0
          return (
            <div key={idx} style={{ position: 'absolute', left, top: (size - dim) / 2, width: dim, height: dim }}>
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: theme.tableBg || theme.bgPanel || (theme.mode === 'light' ? '#FFFFFF' : '#22242b'),
                border: 'none',
                boxSizing: 'border-box',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {l.src ? (
                  <img
                    src={l.src}
                    alt={l.alt}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                ) : null}
              </div>
            </div>
          )
        })}
        {resolvedIcon && !chainFailed && chainLoaded && (
          <div style={{ position: 'absolute', top: -4, right: -4, width: Math.round(size * 0.45), height: Math.round(size * 0.45), borderRadius: '50%', background: (theme.tableBg || theme.bgPanel || theme.bgApp), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 1px rgba(0,0,0,0.25)' }}>
            <img
              src={resolvedIcon}
              alt={chainKey}
              style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
              onLoad={() => setChainLoaded(true)}
              onError={() => { setChainFailed(true) }}
            />
          </div>
        )}
        {resolvedIcon && !chainFailed && !chainLoaded && (
          // Preload hidden image (no empty badge placeholder)
          <img src={resolvedIcon} alt="preload" style={{ display: 'none' }} onLoad={() => setChainLoaded(true)} onError={() => setChainFailed(true)} />
        )}
      </div>
      {/* Text */}
      <div style={{ minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 400, color: theme.textPrimary, lineHeight: '16px', whiteSpace: 'nowrap' }}>{text}</span>
      </div>
    </div>
  )
}
