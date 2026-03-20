/**
 * useAllocationStrategy Hook
 * Specialized hook for Allocation by Weight strategies (Type 1)
 * Provides simplified API for Type 1 strategies
 */

import { useMemo } from 'react';
import { useStrategy } from '../useStrategy';
import type { WalletItem } from '../../types/wallet';
import type { AllocationDelta, SaveStrategyResponse, Strategy } from '../../types/strategy';
import type { 
  AllocationByWeightConfig, 
  AllocationByWeightResult 
} from '../../types/strategies/allocationByWeight';

export interface UseAllocationStrategyResult {
  // State
  strategy: Strategy | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  
  // Actions
  loadStrategy: (walletGroupId: string) => Promise<void>;
  saveAllocationStrategy: (
    walletGroupId: string,
    config: AllocationByWeightConfig,
    portfolio: WalletItem[],
    strategyId?: string
  ) => Promise<SaveStrategyResponse>;
  clearStrategy: () => void;
  
  // Calculations
  calculateResult: (portfolio: WalletItem[]) => AllocationByWeightResult | null;
  calculateDeltas: (portfolio: WalletItem[]) => AllocationDelta[];
}

/**
 * Hook specialized for Allocation by Weight strategies
 */
export function useAllocationStrategy(): UseAllocationStrategyResult {
  const {
    strategy,
    loading,
    error,
    saving,
    loadStrategy,
    saveStrategy,
    clearStrategy,
    calculate
  } = useStrategy<AllocationByWeightConfig, AllocationByWeightResult>();

  /**
   * Save allocation strategy (simplified API)
   */
  const saveAllocationStrategy = async (
    walletGroupId: string,
    config: AllocationByWeightConfig,
    portfolio: WalletItem[],
    strategyId?: string
  ): Promise<SaveStrategyResponse> => {
    return saveStrategy(1, walletGroupId, config, portfolio, strategyId);
  };

  /**
   * Calculate full result
   */
  const calculateResult = (portfolio: WalletItem[]): AllocationByWeightResult | null => {
    return calculate(portfolio);
  };

  /**
   * Calculate only deltas (for backward compatibility)
   */
  const calculateDeltas = (portfolio: WalletItem[]): AllocationDelta[] => {
    const result = calculate(portfolio);
    return result?.deltas || [];
  };

  return {
    strategy,
    loading,
    error,
    saving,
    loadStrategy,
    saveAllocationStrategy,
    clearStrategy,
    calculateResult,
    calculateDeltas
  };
}

export default useAllocationStrategy;
