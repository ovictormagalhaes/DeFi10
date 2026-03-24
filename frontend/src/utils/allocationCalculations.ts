/**
 * Allocation Calculations
 * Calculate deltas between target and current allocations for Strategy Type 1
 */

import type { WalletItem } from '../types/wallet';
import type { Strategy, AllocationDelta } from '../types/strategy';
import { getTotalValueUsd, matchesAsset, mapGroupToType } from './strategyMetadata';

/**
 * Group portfolio items by their type
 */
function groupByType(items: WalletItem[]): Record<string, WalletItem[]> {
  const groups: Record<string, WalletItem[]> = {};
  
  items.forEach(item => {
    let groupName: string;
    
    switch (item.type) {
      case 'LendingAndBorrowing':
        groupName = 'Lending';
        break;
      case 'LiquidityPool':
        groupName = 'Liquidity';
        break;
      case 'Staking':
        groupName = 'Staking';
        break;
      case 'Wallet':
        groupName = 'Wallet';
        break;
      default:
        groupName = 'Other';
    }
    
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(item);
  });
  
  return groups;
}

/**
 * Normalize group name from labels to internal names
 * Maps "Lending Position" -> "Lending", "Staking Position" -> "Staking", etc.
 */
function normalizeGroupName(group: string): string {
  const normalized = group
    .replace(' Position', '')
    .replace(' Pools', '')
    .trim();
  
  // Map variations
  if (normalized === 'Liquidity') return 'Liquidity';
  if (normalized === 'Lending' || normalized === 'LendingAndBorrowing') return 'Lending';
  if (normalized === 'Staking') return 'Staking';
  if (normalized === 'Wallet') return 'Wallet';
  
  return normalized;
}

/**
 * Sum values of items
 */
function sumBy(items: WalletItem[], fn: (item: WalletItem) => number): number {
  return items.reduce((sum, item) => sum + fn(item), 0);
}

/**
 * Match asset with protocol and chain
 */
function matchesAssetWithProtocolChain(
  item: WalletItem,
  assetKey: string,
  protocol?: string | null,
  chain?: string | null
): boolean {
  // First check if symbol matches
  if (!matchesAsset(item, assetKey)) {
    return false;
  }
  
  // If protocol and chain provided, match those too
  if (protocol && chain) {
    return item.protocol?.id === protocol && item.protocol?.chain === chain;
  }
  
  // Legacy: just match by symbol
  return true;
}

/**
 * Calculate allocation deltas between target and current portfolio
 * Supports both new (allocations) and legacy (targetAllocations) structure
 * @param strategy Strategy with target allocations
 * @param currentPortfolio Current wallet portfolio
 * @param rebalanceThreshold Percentage threshold to trigger rebalance flag (default: 5%)
 * @returns Array of allocation deltas
 */
export function calculateAllocationDeltas(
  strategy: Strategy,
  currentPortfolio: WalletItem[],
  rebalanceThreshold: number = 5
): AllocationDelta[] {
  // Support both new (allocations) and legacy (targetAllocations) structure
  const targets = (strategy as any).allocations || (strategy as any).targetAllocations || [];
  
  if (targets.length === 0) {
    return [];
  }

  // Group portfolio by type (Lending, Liquidity, Staking, Wallet)
  const groupedByType = groupByType(currentPortfolio);

  // Group target allocations by normalized group name
  const targetsByGroup = new Map<string, any[]>();
  targets.forEach((target: any) => {
    const normalizedGroup = normalizeGroupName(target.group);
    if (!targetsByGroup.has(normalizedGroup)) {
      targetsByGroup.set(normalizedGroup, []);
    }
    targetsByGroup.get(normalizedGroup)!.push(target);
  });

  const deltas: AllocationDelta[] = [];

  targets.forEach((target: any) => {
    // Normalize group name (e.g., "Lending Position" -> "Lending")
    const normalizedGroup = normalizeGroupName(target.group);
    
    // Get items in this group
    const groupItems = groupedByType[normalizedGroup] || [];
    
    // Get all targets in this group
    const groupTargets = targetsByGroup.get(normalizedGroup) || [];
    
    // Get protocol and chain from new structure or legacy
    const protocol = target.protocol?.id || target.protocol;
    const chain = target.chain?.id || target.chain;
    
    // Calculate total value of only the assets in the strategy for this group
    let totalStrategyGroupValue = 0;
    groupTargets.forEach((gt: any) => {
      const gtProtocol = gt.protocol?.id || gt.protocol;
      const gtChain = gt.chain?.id || gt.chain;
      
      const asset = groupItems.find(item => 
        matchesAssetWithProtocolChain(item, gt.assetKey, gtProtocol, gtChain)
      );
      if (asset) {
        totalStrategyGroupValue += getTotalValueUsd(asset);
      }
    });

    // Find current asset in group with protocol/chain matching
    const currentAsset = groupItems.find(item => 
      matchesAssetWithProtocolChain(item, target.assetKey, protocol, chain)
    );

    // Calculate current value
    const currentValueUsd = currentAsset 
      ? getTotalValueUsd(currentAsset) 
      : 0;

    // Calculate current weight (percentage) - relative to strategy assets only
    const currentWeight = totalStrategyGroupValue > 0 
      ? (currentValueUsd / totalStrategyGroupValue) * 100 
      : 0;

    // Calculate deltas
    const deltaWeight = currentWeight - target.targetWeight;
    const targetValueUsd = (totalStrategyGroupValue * target.targetWeight) / 100;
    const deltaValueUsd = currentValueUsd - targetValueUsd;

    // Determine if rebalance is needed
    const needsRebalance = Math.abs(deltaWeight) > rebalanceThreshold;

    deltas.push({
      assetKey: target.assetKey,
      group: target.group,
      targetWeight: target.targetWeight,
      currentWeight: Math.round(currentWeight * 100) / 100,
      deltaWeight: Math.round(deltaWeight * 100) / 100,
      targetValueUsd: Math.round(targetValueUsd * 100) / 100,
      currentValueUsd: Math.round(currentValueUsd * 100) / 100,
      deltaValueUsd: Math.round(deltaValueUsd * 100) / 100,
      needsRebalance
    });
  });

  return deltas;
}

/**
 * Get summary statistics for allocation deltas
 */
export function getAllocationSummary(deltas: AllocationDelta[]): {
  totalAssets: number;
  assetsNeedingRebalance: number;
  maxDeltaWeight: number;
  totalDeltaValueUsd: number;
} {
  return {
    totalAssets: deltas.length,
    assetsNeedingRebalance: deltas.filter(d => d.needsRebalance).length,
    maxDeltaWeight: Math.max(...deltas.map(d => Math.abs(d.deltaWeight)), 0),
    totalDeltaValueUsd: deltas.reduce((sum, d) => sum + Math.abs(d.deltaValueUsd), 0)
  };
}

/**
 * Get deltas for a specific group
 */
export function getDeltasForGroup(
  deltas: AllocationDelta[], 
  group: string
): AllocationDelta[] {
  return deltas.filter(d => d.group === group);
}

/**
 * Get assets that need rebalancing
 */
export function getAssetsNeedingRebalance(deltas: AllocationDelta[]): AllocationDelta[] {
  return deltas.filter(d => d.needsRebalance);
}

/**
 * Sort deltas by absolute delta weight (highest deviation first)
 */
export function sortByDeviation(deltas: AllocationDelta[]): AllocationDelta[] {
  return [...deltas].sort((a, b) => 
    Math.abs(b.deltaWeight) - Math.abs(a.deltaWeight)
  );
}

/**
 * Calculate suggested rebalance actions
 */
export interface RebalanceAction {
  assetKey: string;
  group: string;
  action: 'buy' | 'sell' | 'hold';
  amountUsd: number;
  percentageChange: number;
}

export function suggestRebalanceActions(
  deltas: AllocationDelta[]
): RebalanceAction[] {
  return deltas.map(delta => {
    let action: 'buy' | 'sell' | 'hold';
    
    if (!delta.needsRebalance) {
      action = 'hold';
    } else if (delta.deltaWeight < 0) {
      // Current weight is less than target -> need to buy
      action = 'buy';
    } else {
      // Current weight is more than target -> need to sell
      action = 'sell';
    }

    return {
      assetKey: delta.assetKey,
      group: delta.group,
      action,
      amountUsd: Math.abs(delta.deltaValueUsd),
      percentageChange: Math.abs(delta.deltaWeight)
    };
  });
}
