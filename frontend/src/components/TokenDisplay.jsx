import React from 'react';

import { useChainIcons } from '../context/ChainIconsProvider';
import { useTheme } from '../context/ThemeProvider.tsx';
import { formatTokenDisplay } from '../utils/tokenDisplay';

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
export default function TokenDisplay({
  tokens = [],
  showName = false,
  showText = true,
  size = 26,
  gap = 10,
  className = '',
  style = {},
  showChain = true,
  getChainIcon,
}) {
  const { theme } = useTheme();
  const { getIcon: getChainIconFromContext } = useChainIcons();
  // Normalize lending/position tokens: map [{token, type}, ...] to token objects when needed
  const normalizedTokens = Array.isArray(tokens)
    ? tokens.map((t) => (t && t.token ? t.token : t))
    : tokens;
  const { logos, text } = formatTokenDisplay(normalizedTokens, { showName });

  const isPair = logos.length === 2;
  const pairSize = Math.round(size * 0.77);
  const overlap = Math.round(pairSize * 0.52);

  // Determine chain (prefer first token's chain-like fields)
  const baseToken = normalizedTokens[0] || {};
  // Attempt direct field extraction
  let raw =
    baseToken.chain ||
    baseToken.chainId ||
    baseToken.chainID ||
    baseToken.network ||
    baseToken.networkId ||
    baseToken.chainName ||
    '';
  // If still empty, scan keys (covers variations like capitalized 'Chain')
  if (!raw && baseToken && typeof baseToken === 'object') {
    for (const k in baseToken) {
      if (!Object.prototype.hasOwnProperty.call(baseToken, k)) continue;
      if (/(chain|network)/i.test(k)) {
        const v = baseToken[k];
        if (v && (typeof v === 'string' || typeof v === 'number')) {
          raw = v;
          break;
        }
      }
    }
  }
  const lowerRaw = (typeof raw === 'number' ? String(raw) : String(raw || '')).toLowerCase().trim();

  // Normalize various chain representations (ids, labels, aliases)
  const chainNormalization = {
    // Ethereum
    1: 'ethereum',
    eth: 'ethereum',
    ethereum: 'ethereum',
    mainnet: 'ethereum',
    // Arbitrum
    42161: 'arbitrum',
    'arbitrum one': 'arbitrum',
    arbitrum: 'arbitrum',
    arb: 'arbitrum',
    // Arbitrum Nova
    42170: 'arbitrum',
    'arbitrum-nova': 'arbitrum',
    // Base
    8453: 'base',
    base: 'base',
    // Polygon
    137: 'polygon',
    matic: 'polygon',
    polygon: 'polygon',
    // Avalanche
    43114: 'avalanche',
    avax: 'avalanche',
    avalanche: 'avalanche',
    // Optimism
    10: 'optimism',
    optimism: 'optimism',
    op: 'optimism',
    // BSC
    56: 'bsc',
    bsc: 'bsc',
    bnb: 'bsc',
    binance: 'bsc',
    'binance smart chain': 'bsc',
    'bnb smart chain': 'bsc',
    // Fantom
    250: 'fantom',
    fantom: 'fantom',
    ftm: 'fantom',
    // Others (extend as needed)
    84531: 'base', // Base testnet alias if appears
  };

  const chainKey = chainNormalization[lowerRaw] || lowerRaw;

  let resolvedIcon = undefined;
  if (showChain && chainKey) {
    if (getChainIcon) resolvedIcon = getChainIcon(chainKey); // explicit prop resolver
    if (!resolvedIcon && getChainIconFromContext) resolvedIcon = getChainIconFromContext(chainKey); // context mapping
  }

  // Hooks MUST run before any conditional returns
  const [chainLoaded, setChainLoaded] = React.useState(false);
  const [chainFailed, setChainFailed] = React.useState(false);
  const chainImgRef = React.useRef(null);
  React.useEffect(() => {
    setChainLoaded(false);
    setChainFailed(false);
  }, [chainKey, resolvedIcon]);
  React.useEffect(() => {
    const img = chainImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) setChainLoaded(true);
  }, [resolvedIcon]);

  if (!logos.length) return null; // safe early return after hooks

  return (
    <div
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap, ...style }}
    >
      {/* Logo container */}
      <div
        style={{
          position: 'relative',
          width: isPair ? pairSize + overlap : size,
          height: size,
          flex: '0 0 auto',
        }}
      >
        {logos.map((l, idx) => {
          const dim = isPair ? pairSize : size;
          const left = isPair ? idx * overlap : 0;
          return (
            <div
              key={idx}
              style={{ position: 'absolute', left, top: (size - dim) / 2, width: dim, height: dim }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: theme.tableBg || theme.bgPanel || 'var(--mw-surface-1, var(--app-bg-panel))',
                  border: 'none',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {l.src ? (
                  <img
                    src={l.src}
                    alt={l.alt}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '50%',
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
        {resolvedIcon && !chainFailed ? (
          <div
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: Math.round(size * 0.45),
              height: Math.round(size * 0.45),
              borderRadius: '50%',
              background: theme.tableBg || theme.bgPanel || theme.bgApp,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 1px rgba(0,0,0,0.25)',
              opacity: chainLoaded ? 1 : 0,
              transition: 'opacity 120ms ease-in',
            }}
          >
            <img
              ref={chainImgRef}
              src={resolvedIcon}
              alt={chainKey}
              style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
              onLoad={() => setChainLoaded(true)}
              onError={() => {
                setChainFailed(true);
              }}
            />
          </div>
        ) : showChain && chainKey && (
          <div
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: Math.round(size * 0.45),
              height: Math.round(size * 0.45),
              borderRadius: '50%',
              background: theme.bgPanel,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: Math.round(size * 0.22),
              fontWeight: 600,
              color: theme.textSecondary,
              letterSpacing: '.5px',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 0 1px rgba(0,0,0,0.35)'
            }}
            title={chainKey}
          >
            {chainKey.slice(0,2).toUpperCase()}
          </div>
        )}
      </div>
      {/* Text */}
      {showText && (
        <div style={{ minWidth: 0 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: theme.textPrimary,
              lineHeight: '16px',
              whiteSpace: 'nowrap',
            }}
          >
            {text}
          </span>
        </div>
      )}
    </div>
  );
}
