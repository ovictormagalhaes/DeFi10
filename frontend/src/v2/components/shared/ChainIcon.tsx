import React from 'react';
import { SUPPORTED_CHAINS, CHAIN_MAPPINGS } from '../../../constants/chains';

const CHAIN_ICON_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  SUPPORTED_CHAINS.forEach((c) => {
    map[c.id.toLowerCase()] = c.iconUrl;
    map[c.name.toLowerCase()] = c.iconUrl;
    map[c.displayName.toLowerCase()] = c.iconUrl;
  });
  return map;
})();

function resolveChainIcon(name: string): string | undefined {
  const norm = name.trim().toLowerCase();
  if (CHAIN_ICON_MAP[norm]) return CHAIN_ICON_MAP[norm];
  const mapped = CHAIN_MAPPINGS[norm];
  if (mapped) return CHAIN_ICON_MAP[mapped.toLowerCase()];
  return undefined;
}

interface ChainIconProps {
  name: string | undefined | null;
  size?: number;
}

export const ChainIcon: React.FC<ChainIconProps> = ({ name, size = 12 }) => {
  if (!name) return null;
  const src = resolveChainIcon(name);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
};

export default ChainIcon;
