/**
 * Strategy Utilities - Helper Functions
 * Quick access to commonly used strategy operations
 */

// Re-export types
export type {
  Strategy,
  StrategyType,
  TargetAllocation,
  StrategyItem,
  StrategyAssetMetadata,
  TokenMetadata,
  ProtocolMetadata,
  AllocationDelta,
  SaveStrategyRequest,
  SaveStrategyResponse,
} from '../types/strategy';

// Re-export metadata utilities
export {
  extractMetadata,
  findAssetInPortfolio,
  getAssetType,
  getPositionTypeNumber,
  getTokenTypeNumber,
  mapGroupToType,
  getChainId,
  matchesAsset,
  getSymbolFromPortfolio,
  getNameFromPortfolio,
  getFirstTokenLogo,
  getSecondTokenLogo,
  getTierPercent,
  getTotalValueUsd,
  validateGroupAllocation,
  validateAssetsExist,
} from './strategyMetadata';

// Re-export calculation utilities
export {
  calculateAllocationDeltas,
  getAllocationSummary,
  getDeltasForGroup,
  getAssetsNeedingRebalance,
  sortByDeviation,
  suggestRebalanceActions,
  type RebalanceAction,
} from './allocationCalculations';

/**
 * Quick example of how to create an allocation strategy
 */
export const createAllocationStrategyExample = () => {
  const example = {
    walletGroupId: 'your-wallet-group-id',
    allocations: [
      // Lending allocations (must sum to 100%)
      { assetKey: 'cbBTC', group: 'Lending', weight: 50 },
      { assetKey: 'WETH', group: 'Lending', weight: 30 },
      { assetKey: 'USDC', group: 'Lending', weight: 20 },

      // Liquidity allocations (must sum to 100%)
      { assetKey: 'WETH/USDC', group: 'Liquidity', weight: 60 },
      { assetKey: 'cbBTC/WETH', group: 'Liquidity', weight: 40 },
    ],
    name: 'Balanced DeFi Strategy',
    description: 'Conservative allocation focused on stablecoins and blue chips',
  };

  return example;
};

/**
 * Helper to format allocation deltas for display
 */
export function formatAllocationDelta(delta: {
  deltaWeight: number;
  deltaValueUsd: number;
}): {
  weightFormatted: string;
  valueFormatted: string;
  status: 'over' | 'under' | 'balanced';
} {
  const status =
    Math.abs(delta.deltaWeight) < 1
      ? 'balanced'
      : delta.deltaWeight > 0
        ? 'over'
        : 'under';

  const weightSign = delta.deltaWeight > 0 ? '+' : '';
  const valueSign = delta.deltaValueUsd > 0 ? '+' : '';

  return {
    weightFormatted: `${weightSign}${delta.deltaWeight.toFixed(2)}%`,
    valueFormatted: `${valueSign}$${Math.abs(delta.deltaValueUsd).toFixed(2)}`,
    status,
  };
}

/**
 * Helper to get action label for rebalancing
 */
export function getRebalanceActionLabel(deltaWeight: number): string {
  if (Math.abs(deltaWeight) < 1) return 'Hold';
  return deltaWeight > 0 ? 'Sell (Over-allocated)' : 'Buy (Under-allocated)';
}

/**
 * Helper to calculate required action amount
 */
export function calculateRequiredAction(delta: {
  deltaValueUsd: number;
  deltaWeight: number;
  targetValueUsd: number;
}): {
  action: 'buy' | 'sell' | 'hold';
  amountUsd: number;
  percentage: number;
} {
  if (Math.abs(delta.deltaWeight) < 1) {
    return {
      action: 'hold',
      amountUsd: 0,
      percentage: 0,
    };
  }

  return {
    action: delta.deltaWeight > 0 ? 'sell' : 'buy',
    amountUsd: Math.abs(delta.deltaValueUsd),
    percentage: Math.abs(delta.deltaWeight),
  };
}

/**
 * Helper to check if strategy needs attention
 */
export function needsAttention(
  deltas: Array<{ needsRebalance: boolean }>,
  threshold = 0.1,
): boolean {
  const needsRebalanceCount = deltas.filter((d) => d.needsRebalance).length;
  const totalAssets = deltas.length;

  if (totalAssets === 0) return false;

  return needsRebalanceCount / totalAssets >= threshold;
}
