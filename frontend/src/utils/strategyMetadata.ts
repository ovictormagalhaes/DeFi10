/**
 * Strategy Metadata Utilities
 * Functions to extract and process metadata from WalletItems for Strategy API
 */

import { WalletItemType } from '../constants/walletItemTypes';
import type { StrategyAssetMetadata, TokenMetadata, ProtocolMetadata } from '../types/strategy';
import type { WalletItem, Token, Protocol } from '../types/wallet';

/**
 * Map WalletItemType to numeric position type
 */
export function getPositionTypeNumber(type: string): number {
  switch (type) {
    case WalletItemType.WALLET:
      return 1;
    case WalletItemType.LIQUIDITY_POOL:
      return 2;
    case WalletItemType.LENDING_AND_BORROWING:
      return 3;
    case WalletItemType.STAKING:
      return 4;
    default:
      return 0;
  }
}

/**
 * Map WalletItemType to asset type number
 */
export function getAssetType(type: string): number {
  return getPositionTypeNumber(type);
}

/**
 * Map token type string to numeric type
 */
export function getTokenTypeNumber(type: string | null): number | null {
  if (!type) return null;

  // Map known token types to numbers
  // This may need to be expanded based on backend requirements
  switch (type) {
    case 'LiquiditySupplied':
      return 1;
    case 'LiquidityUncollectedFee':
      return 2;
    case 'Supplied':
      return 3;
    case 'Borrowed':
      return 4;
    case 'Staked':
      return 5;
    default:
      return 0;
  }
}

/**
 * Map group name to WalletItemType
 */
export function mapGroupToType(group: string): string | null {
  const mapping: Record<string, string> = {
    Lending: WalletItemType.LENDING_AND_BORROWING,
    Liquidity: WalletItemType.LIQUIDITY_POOL,
    Staking: WalletItemType.STAKING,
    Wallet: WalletItemType.WALLET,
    All: '',
  };

  return mapping[group] || null;
}

/**
 * Get chain ID from chain name
 * This is a simplified mapping - expand as needed
 */
export function getChainId(chain: string): string | null {
  const chainIds: Record<string, string> = {
    Ethereum: '1',
    Base: '8453',
    Arbitrum: '42161',
    Optimism: '10',
    Polygon: '137',
    Avalanche: '43114',
    BSC: '56',
    Solana: 'solana',
  };

  return chainIds[chain] || null;
}

/**
 * Extract protocol metadata from WalletItem
 */
function extractProtocolMetadata(protocol: Protocol | null): ProtocolMetadata | null {
  if (!protocol) return null;

  return {
    id: protocol.id,
    name: protocol.name,
    chain: protocol.chain,
    url: protocol.url || null,
    logo: protocol.logo || null,
  };
}

/**
 * Extract token metadata from Token array
 */
function extractTokensMetadata(tokens: Token[], chain: string): TokenMetadata[] {
  return tokens.map((token) => ({
    type: getTokenTypeNumber(token.type),
    symbol: token.symbol || '',
    name: token.name || '',
    address: token.contractAddress || null,
    logo: token.logo || null,
    chain: chain,
  }));
}

/**
 * Extract complete metadata from a WalletItem
 * This is the core function that preserves all data needed for future rendering
 */
export function extractMetadata(item: WalletItem): StrategyAssetMetadata {
  const tokens = item.position?.tokens || [];
  const firstToken = tokens[0];
  const chain = item.protocol?.chain || '';

  return {
    // Identification
    symbol: firstToken?.symbol || null,
    name: firstToken?.name || item.position?.label || null,
    address: firstToken?.contractAddress || null,
    chainId: chain ? getChainId(chain) : null,
    chain: chain || null,

    // Protocol
    protocol: extractProtocolMetadata(item.protocol),

    // Position
    positionLabel: item.position?.label || null,
    positionType: getPositionTypeNumber(item.type),

    // Tokens involved
    tokens: extractTokensMetadata(tokens, chain),
  };
}

/**
 * Check if an asset matches the given key
 * Can match by symbol, address, or position key
 */
export function matchesAsset(item: WalletItem, assetKey: string): boolean {
  const tokens = item.position?.tokens || [];
  const lowerKey = assetKey.toLowerCase();

  return tokens.some(
    (token) =>
      token.symbol?.toLowerCase() === lowerKey || token.contractAddress?.toLowerCase() === lowerKey
  );
}

/**
 * Find an asset in the portfolio by key and group
 */
export function findAssetInPortfolio(
  items: WalletItem[],
  assetKey: string,
  group: string
): WalletItem | undefined {
  const groupType = mapGroupToType(group);

  return items.find((item) => {
    // Filter by type if specified
    if (groupType && item.type !== groupType) {
      return false;
    }

    // Match by asset key
    return matchesAsset(item, assetKey);
  });
}

/**
 * Get symbol from portfolio for a given asset key
 */
export function getSymbolFromPortfolio(items: WalletItem[], assetKey: string): string | null {
  const item = items.find((i) => matchesAsset(i, assetKey));
  const firstToken = item?.position?.tokens?.[0];
  return firstToken?.symbol || null;
}

/**
 * Get name from portfolio for a given asset key
 */
export function getNameFromPortfolio(items: WalletItem[], assetKey: string): string | null {
  const item = items.find((i) => matchesAsset(i, assetKey));
  const firstToken = item?.position?.tokens?.[0];
  return firstToken?.name || item?.position?.label || null;
}

/**
 * Get first token logo from WalletItem
 */
export function getFirstTokenLogo(item: WalletItem): string | null {
  const tokens = item.position?.tokens || [];
  return tokens[0]?.logo || tokens[0]?.thumbnail || null;
}

/**
 * Get second token logo from WalletItem (for pairs)
 */
export function getSecondTokenLogo(item: WalletItem): string | null {
  const tokens = item.position?.tokens || [];
  return tokens[1]?.logo || tokens[1]?.thumbnail || null;
}

/**
 * Get tier percentage if applicable
 * (This may need adjustment based on actual data structure)
 */
export function getTierPercent(item: WalletItem): number | null {
  // This is a placeholder - adjust based on where tier data lives
  return null;
}

/**
 * Get total value in USD for a WalletItem
 */
export function getTotalValueUsd(item: WalletItem): number {
  return (
    item.position?.tokens?.reduce((sum, token) => sum + (token.financials?.totalPrice || 0), 0) || 0
  );
}

/**
 * Validate that all allocations in a group sum to 100%
 */
export function validateGroupAllocation(allocations: Array<{ group: string; weight: number }>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Group by group type
  const byGroup = allocations.reduce(
    (acc, alloc) => {
      if (!acc[alloc.group]) {
        acc[alloc.group] = 0;
      }
      acc[alloc.group] += alloc.weight;
      return acc;
    },
    {} as Record<string, number>
  );

  // Check each group sums to 100
  Object.entries(byGroup).forEach(([group, total]) => {
    if (Math.abs(total - 100) > 0.01) {
      // Allow small floating point errors
      errors.push(`Group "${group}" allocations sum to ${total}%, expected 100%`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that all assets exist in the current portfolio
 */
export function validateAssetsExist(
  allocations: Array<{ assetKey: string; group: string }>,
  portfolio: WalletItem[]
): { valid: boolean; missingAssets: string[] } {
  const missingAssets: string[] = [];

  allocations.forEach((alloc) => {
    const found = findAssetInPortfolio(portfolio, alloc.assetKey, alloc.group);
    if (!found) {
      missingAssets.push(`${alloc.assetKey} in ${alloc.group}`);
    }
  });

  return {
    valid: missingAssets.length === 0,
    missingAssets,
  };
}
