import React from 'react';
import { useChainIcons } from '../context/ChainIconsProvider';
import { useTheme } from '../context/ThemeProvider';
import { formatTokenDisplay } from '../utils/tokenDisplay.js';
import type { Token } from '../types/wallet';

interface TokenDisplayProps {
  tokens?: (Token | any)[];
  showName?: boolean;
  showText?: boolean;
  size?: number;
  gap?: number;
  className?: string;
  style?: React.CSSProperties;
  showChain?: boolean;
  getChainIcon?: (chainKey: string) => string | undefined;
}

/**
 * TokenDisplay
 * Componente TypeScript para exibir tokens com logos e informações
 */
const TokenDisplay: React.FC<TokenDisplayProps> = ({
  tokens = [],
  showName = false,
  showText = true,
  size = 26,
  gap = 10,
  className = '',
  style = {},
  showChain = true,
  getChainIcon,
}) => {
  const { theme } = useTheme();
  const { getIcon: getChainIconFromContext } = useChainIcons();
  
  // Normalize lending/position tokens: map [{token, type}, ...] to token objects when needed
  const normalizedTokens = Array.isArray(tokens)
    ? tokens.map((t: any) => (t && t.token ? t.token : t))
    : tokens;
    
  const { logos, text } = formatTokenDisplay(normalizedTokens, { showName });

  const isPair = logos.length === 2;
  const pairSize = Math.round(size * 0.77);
  const overlap = Math.round(pairSize * 0.52);

  // Determine chain (prefer first token's chain-like fields)
  const baseToken = normalizedTokens[0] || {};
  
  // Attempt direct field extraction
  let raw: string =
    baseToken.chain ||
    baseToken.chainId ||
    baseToken.chainID ||
    baseToken.network ||
    baseToken.networkId ||
    baseToken.networkID ||
    '';

  // Extract numeric ID if present
  let chainNumericId: number | null = null;
  if (typeof raw === 'string') {
    const match = raw.match(/\d+/);
    if (match) chainNumericId = parseInt(match[0], 10);
  } else if (typeof raw === 'number') {
    chainNumericId = raw;
  }

  // Chain key mapping
  let chainKey = '';
  if (typeof raw === 'string') {
    chainKey = raw.toLowerCase();
  }
  
  // Map numeric chain IDs to keys
  const chainIdMapping: Record<number, string> = {
    1: 'ethereum',
    56: 'bsc',
    137: 'polygon',
    250: 'fantom',
    43114: 'avalanche',
    42161: 'arbitrum',
    10: 'optimism',
    25: 'cronos',
    100: 'xdai',
  };
  
  if (chainNumericId && chainIdMapping[chainNumericId]) {
    chainKey = chainIdMapping[chainNumericId];
  }

  // Get chain icon
  const chainIconUrl = getChainIcon 
    ? getChainIcon(chainKey) 
    : getChainIconFromContext();

  return (
    <div
      className={`token-display ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: showText ? `${gap}px` : 0,
        ...style,
      }}
    >
      {/* Logo container */}
      <div
        className="token-logos"
        style={{
          position: 'relative',
          height: `${size}px`,
          width: isPair ? `${pairSize + overlap}px` : `${size}px`,
          flexShrink: 0,
        }}
      >
        {logos.map((logo: any, index: number) => (
          <img
            key={index}
            src={logo.src || logo}
            alt={logo.alt || `Token ${index + 1}`}
            style={{
              position: isPair ? 'absolute' : 'static',
              left: isPair && index === 1 ? `${overlap}px` : '0px',
              top: '0px',
              width: isPair ? `${pairSize}px` : `${size}px`,
              height: isPair ? `${pairSize}px` : `${size}px`,
              borderRadius: '50%',
              border: isPair ? '2px solid white' : 'none',
              backgroundColor: '#f0f0f0',
              zIndex: isPair ? (index === 0 ? 2 : 1) : 'auto',
            }}
            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ))}
        
        {/* Chain badge overlay */}
        {showChain && chainIconUrl && (
          <img
            src={chainIconUrl}
            alt="Chain"
            style={{
              position: 'absolute',
              bottom: '-2px',
              right: isPair ? `${Math.max(0, overlap - 8)}px` : '-2px',
              width: `${Math.round(size * 0.4)}px`,
              height: `${Math.round(size * 0.4)}px`,
              borderRadius: '50%',
              border: '2px solid white',
              backgroundColor: 'white',
              zIndex: 10,
            }}
            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        )}
      </div>

      {/* Text */}
      {showText && (
        <span
          className="token-text"
          style={{
            fontSize: `${Math.round(size * 0.6)}px`,
            fontWeight: 500,
            color: '#000000', // TODO: Implement proper theme typing
          }}
        >
          {text}
        </span>
      )}
    </div>
  );
};

export default TokenDisplay;