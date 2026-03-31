/**
 * Type 1: Allocation by Weight Strategy
 * Configuration types and interfaces
 */

import type { TargetAllocation, AllocationDelta, StrategyType } from '../strategy';

/**
 * Configuration for creating Type 1 strategy
 */
export interface AllocationByWeightConfig {
  allocations: Array<{
    assetKey: string;
    group: string;
    weight: number;
    logo?: string | null; // Token logo URL
    protocol?: string; // Protocol ID (e.g., 'aave-v3', 'kamino') to uniquely identify the asset
    protocolName?: string; // Protocol display name (e.g., 'Aave V3', 'Kamino')
    protocolLogo?: string | null; // Protocol logo URL
    chain?: string; // Chain name (e.g., 'base', 'solana') to uniquely identify the asset
    chainLogo?: string | null; // Chain logo URL
  }>;
  name?: string;
  description?: string;
}

/**
 * Result of Type 1 calculations
 */
export interface AllocationByWeightResult {
  deltas: AllocationDelta[];
  summary: {
    totalAssets: number;
    assetsNeedingRebalance: number;
    maxDeviation: number;
    totalDeltaUsd: number;
  };
  recommendations: RebalanceAction[];
}

/**
 * Rebalance action recommendation
 */
export interface RebalanceAction {
  action: 'buy' | 'sell';
  assetKey: string;
  group: string;
  symbol?: string;
  amountUsd: number;
  currentValueUsd: number;
  targetValueUsd: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Type guard to check if strategy is AllocationByWeight
 */
export function isAllocationByWeightStrategy(
  strategyType: number
): strategyType is StrategyType.AllocationByWeight {
  return strategyType === 1;
}
