/**
 * Funções utilitárias para filtrar WalletItems por tipo
 * ARQUITETURA CORRETA: Todos os componentes usam WalletItem[], apenas filtram
 */

import type { WalletItem } from './wallet';

/**
 * Filtra WalletItems para obter apenas posições de liquidez
 */
export function getLiquidityPoolItems(items: WalletItem[]): WalletItem[] {
  return items.filter(item => item.type === "LiquidityPool");
}

/**
 * Filtra WalletItems para obter apenas posições de lending/borrowing
 */
export function getLendingItems(items: WalletItem[]): WalletItem[] {
  return items.filter(item => item.type === "LendingAndBorrowing");
}

/**
 * Filtra WalletItems para obter apenas posições de staking
 */
export function getStakingItems(items: WalletItem[]): WalletItem[] {
  return items.filter(item => item.type === "Staking");
}

/**
 * Filtra WalletItems para obter apenas posições de locking (vePENDLE, etc.)
 */
export function getLockingItems(items: WalletItem[]): WalletItem[] {
  console.log('getLockingItems called with items:', items);
  const lockingItems = items.filter(item => {
    console.log('Checking item type:', item.type, 'for item:', item);
    return item.type === "Locking";
  });
  console.log('getLockingItems returning:', lockingItems);
  return lockingItems;
}

export function getDepositingItems(items: WalletItem[]): WalletItem[] {
  console.log('getDepositingItems called with items:', items);
  const depositingItems = items.filter(item => {
    console.log('Checking item type:', item.type, 'for item:', item);
    return item.type === "Depositing";
  });
  console.log('getDepositingItems returning:', depositingItems);
  return depositingItems;
}

/**
 * Filtra WalletItems para obter apenas tokens de carteira
 */
export function getWalletTokenItems(items: WalletItem[]): WalletItem[] {
  return items.filter(item => item.type === "Wallet");
}

/**
 * Filtra WalletItems por protocolo
 */
export function getItemsByProtocol(items: WalletItem[], protocolId: string): WalletItem[] {
  return items.filter(item => item.protocol.id === protocolId);
}

/**
 * Filtra WalletItems por chain
 */
export function getItemsByChain(items: WalletItem[], chain: string): WalletItem[] {
  return items.filter(item => item.protocol.chain === chain);
}

/**
 * Agrupa WalletItems por protocolo
 */
export function groupItemsByProtocol(items: WalletItem[]): Record<string, WalletItem[]> {
  return items.reduce((acc, item) => {
    const protocolId = item.protocol.id;
    if (!acc[protocolId]) {
      acc[protocolId] = [];
    }
    acc[protocolId].push(item);
    return acc;
  }, {} as Record<string, WalletItem[]>);
}

/**
 * Agrupa WalletItems por chain
 */
export function groupItemsByChain(items: WalletItem[]): Record<string, WalletItem[]> {
  return items.reduce((acc, item) => {
    const chain = item.protocol.chain;
    if (!acc[chain]) {
      acc[chain] = [];
    }
    acc[chain].push(item);
    return acc;
  }, {} as Record<string, WalletItem[]>);
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
    walletTokens: getWalletTokenItems(items)
  };
}