import React from 'react';

import { useChainIcons } from '../context/ChainIconsProvider';
import { useTheme } from '../context/ThemeProvider';
import type { Token } from '../types/wallet';
import { formatTokenDisplay } from '../utils/tokenDisplay.js';
import { getChainKeyFromId, getChainKey } from '../constants/chains';

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
  const overlap = Math.round(size * 0.5);
  const containerWidth = size + overlap; // Container sempre do mesmo tamanho

  // Determine chain (prefer first token's chain-like fields)
  const baseToken = normalizedTokens[0] || {};

  // Get chain identifier from various fields
  const chainRaw =
    baseToken.chain ||
    baseToken.chainId ||
    baseToken.chainID ||
    baseToken.network ||
    baseToken.networkId ||
    baseToken.networkID;

  // Use centralized chain mapping
  let chainKey = '';
  if (typeof chainRaw === 'number') {
    chainKey = getChainKeyFromId(chainRaw);
  } else if (chainRaw) {
    chainKey = getChainKey(chainRaw);
  }

  // Get chain icon
  const chainIconUrl = getChainIcon ? getChainIcon(chainKey) : getChainIconFromContext(chainKey);

  return (
    <div
      className={`token-display flex items-center ${className}`}
      style={{
        gap: showText ? `${gap}px` : 0,
        ...style,
      }}
    >
      {/* Logo container */}
      <div
        className="token-logos relative flex-shrink-0"
        style={{
          height: `${size}px`,
          width: `${containerWidth}px`,
        }}
      >
        {logos.map((logo: any, index: number) => (
          <img
            key={index}
            src={logo.src || logo}
            alt={logo.alt || `Token ${index + 1}`}
            className="token-logo rounded-full"
            style={{
              position: isPair ? 'absolute' : 'static',
              left: isPair && index === 1 ? `${overlap}px` : '0px',
              top: '0px',
              width: `${size}px`,
              height: `${size}px`,
              border: 'none',
              backgroundColor: theme.bgPanel,
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
              top: '-2px',
              right: isPair ? '-2px' : `${overlap - 2}px`,
              width: `${Math.round(size * 0.4)}px`,
              height: `${Math.round(size * 0.4)}px`,
              borderRadius: '50%',
              border: `1px solid ${theme.bgApp}`,
              backgroundColor: theme.bgPanel,
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
          className="token-text text-primary"
          style={{
            fontSize: `${Math.round(size * 0.6)}px`,
            fontWeight: 500,
            color: theme?.textPrimary || '#f4f4f4',
          }}
        >
          {text}
        </span>
      )}
    </div>
  );
};

export default TokenDisplay;
