/**
 * Utility functions to filter WalletItems by type
 * CORRECT ARCHITECTURE: All components use WalletItem[], only filter
 */

import type { WalletItem } from './wallet';
import { WalletItemType } from '../constants/walletItemTypes';

/**
 * Filter WalletItems to get only liquidity positions
 */
export function getLiquidityPoolItems(items: WalletItem[]): WalletItem[] {
  return items.filter((item) => item.type === WalletItemType.LIQUIDITY_POOL);
}

/**
 * Filter WalletItems to get only lending/borrowing positions
 */
export function getLendingItems(items: WalletItem[]): WalletItem[] {
  return items.filter((item) => item.type === WalletItemType.LENDING_AND_BORROWING);
}

/**
 * Filter WalletItems to get only staking positions
 */
export function getStakingItems(items: WalletItem[]): WalletItem[] {
  return items.filter((item) => item.type === WalletItemType.STAKING);
}

/**
 * Filter WalletItems to get only locking positions (vePENDLE, etc.)
 */
export function getLockingItems(items: WalletItem[]): WalletItem[] {
  console.log('[getLockingItems] Filtering items:', items.length);
  const lockingItems = items.filter((item) => {
    const isLocking = item.type === WalletItemType.LOCKING;
    if (isLocking) {
      console.log('[getLockingItems] Found locking item:', item);
    }
    return isLocking;
  });
  console.log('[getLockingItems] Filtered locking items:', lockingItems.length);
  return lockingItems;
}

export function getDepositingItems(items: WalletItem[]): WalletItem[] {
  return items.filter((item) => item.type === WalletItemType.DEPOSITING);
}

/**
 * Filtra WalletItems para obter apenas tokens de carteira
 */
export function getWalletTokenItems(items: WalletItem[]): WalletItem[] {
  return items.filter((item) => item.type === WalletItemType.WALLET);
}

/**
 * Filtra WalletItems por protocolo
 */
export function getItemsByProtocol(items: WalletItem[], protocolId: string): WalletItem[] {
  return items.filter((item) => item.protocol.id === protocolId);
}

/**
 * Filtra WalletItems por chain
 */
export function getItemsByChain(items: WalletItem[], chain: string): WalletItem[] {
  return items.filter((item) => item.protocol.chain === chain);
}

/**
 * Agrupa WalletItems por protocolo
 */
export function groupItemsByProtocol(items: WalletItem[]): Record<string, WalletItem[]> {
  return items.reduce(
    (acc, item) => {
      const protocolId = item.protocol.id;
      if (!acc[protocolId]) {
        acc[protocolId] = [];
      }
      acc[protocolId].push(item);
      return acc;
    },
    {} as Record<string, WalletItem[]>
  );
}

/**
 * Agrupa WalletItems por chain
 */
export function groupItemsByChain(items: WalletItem[]): Record<string, WalletItem[]> {
  return items.reduce(
    (acc, item) => {
      const chain = item.protocol.chain;
      if (!acc[chain]) {
        acc[chain] = [];
      }
      acc[chain].push(item);
      return acc;
    },
    {} as Record<string, WalletItem[]>
  );
}

/**
 * Agrupa WalletItems por tipo
 */
export function groupItemsByType(items: WalletItem[]): {
  liquidityPools: WalletItem[];
  lending: WalletItem[];
  staking: WalletItem[];
  walletTokens: WalletItem[];
} {
  return {
    liquidityPools: getLiquidityPoolItems(items),
    lending: getLendingItems(items),
    staking: getStakingItems(items),
    walletTokens: getWalletTokenItems(items),
  };
}
