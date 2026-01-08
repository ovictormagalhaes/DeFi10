/**
 * Centralized mapper for WalletItem types
 * Single source of truth to avoid magic strings throughout the codebase
 */

export enum WalletItemType {
  WALLET = 'Wallet',
  LIQUIDITY_POOL = 'LiquidityPool',
  LENDING_AND_BORROWING = 'LendingAndBorrowing',
  STAKING = 'Staking',
  LOCKING = 'Locking',
  DEPOSITING = 'Depositing',
}

/**
 * Type guard to check if a string is a valid WalletItemType
 */
export function isValidWalletItemType(type: string): type is WalletItemType {
  return Object.values(WalletItemType).includes(type as WalletItemType);
}

/**
 * Human-readable labels for each type
 */
export const WalletItemTypeLabels: Record<WalletItemType, string> = {
  [WalletItemType.WALLET]: 'Wallet Assets',
  [WalletItemType.LIQUIDITY_POOL]: 'Liquidity Pools',
  [WalletItemType.LENDING_AND_BORROWING]: 'Lending/Borrowing',
  [WalletItemType.STAKING]: 'Staking',
  [WalletItemType.LOCKING]: 'Locking',
  [WalletItemType.DEPOSITING]: 'Depositing',
};

/**
 * Chart colors for each type
 */
export const WalletItemTypeColors: Record<WalletItemType, string> = {
  [WalletItemType.WALLET]: '#3b82f6', // Blue
  [WalletItemType.LIQUIDITY_POOL]: '#10b981', // Green
  [WalletItemType.LENDING_AND_BORROWING]: '#8b5cf6', // Purple
  [WalletItemType.LOCKING]: '#ec4899', // Pink
  [WalletItemType.STAKING]: '#f59e0b', // Orange
  [WalletItemType.DEPOSITING]: '#14b8a6', // Teal
};

/**
 * Get chart category name for Portfolio Composition
 */
export function getChartCategoryName(type: WalletItemType): string {
  const categoryMap: Record<WalletItemType, string> = {
    [WalletItemType.WALLET]: 'wallet',
    [WalletItemType.LIQUIDITY_POOL]: 'liquidity',
    [WalletItemType.LENDING_AND_BORROWING]: 'lending',
    [WalletItemType.STAKING]: 'staking',
    [WalletItemType.LOCKING]: 'locking',
    [WalletItemType.DEPOSITING]: 'depositing',
  };
  return categoryMap[type];
}
