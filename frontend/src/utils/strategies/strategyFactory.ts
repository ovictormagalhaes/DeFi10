/**
 * Strategy Factory
 * Registry and factory functions for strategy types
 */

import type { WalletItem } from '../../types/wallet';
import type { Strategy, AllocationStrategy, SaveStrategyRequest, StrategyType } from '../../types/strategy';
import type { AllocationByWeightConfig, AllocationByWeightResult } from '../../types/strategies/allocationByWeight';
import {
  validateAllocationConfig,
  buildAllocationRequest,
  calculateAllocationResult
} from './allocationByWeight';

/**
 * Strategy Type Configuration
 */
export interface StrategyTypeConfig<TConfig = unknown, TResult = unknown> {
  type: StrategyType;
  label: string;
  description: string;
  icon?: string;
  available: boolean;
  
  // Validation
  validate: (config: TConfig, portfolio: WalletItem[]) => {
    valid: boolean;
    errors: string[];
    warnings?: string[];
  };
  
  // Calculation
  calculate: (strategy: Strategy, portfolio: WalletItem[]) => TResult;
  
  // Builder
  buildRequest: (
    walletGroupId: string,
    config: TConfig,
    portfolio: WalletItem[],
    strategyId?: string
  ) => SaveStrategyRequest;
}

/**
 * Strategy Type 1: Allocation by Weight Configuration
 */
const allocationByWeightConfig: StrategyTypeConfig<AllocationByWeightConfig, AllocationByWeightResult> = {
  type: 1,
  label: 'Allocation by Weight',
  description: 'Set target allocation percentages for your assets and get rebalancing recommendations.',
  icon: '💰',
  available: true,
  validate: validateAllocationConfig,
  calculate: (strategy, portfolio) => calculateAllocationResult(strategy as AllocationStrategy, portfolio),
  buildRequest: (walletGroupId, config, portfolio, strategyId) =>
    buildAllocationRequest(walletGroupId, config, portfolio, strategyId) as unknown as SaveStrategyRequest
};

/**
 * Strategy Registry
 */
const strategyRegistry = new Map<StrategyType, StrategyTypeConfig<any, any>>();

// Register strategies
strategyRegistry.set(1, allocationByWeightConfig);

/**
 * Get strategy configuration by type
 */
export function getStrategyConfig<TConfig, TResult>(
  type: StrategyType
): StrategyTypeConfig<TConfig, TResult> | undefined {
  return strategyRegistry.get(type);
}

/**
 * Get all available strategy types
 */
export function getAvailableStrategies(): Array<{
  type: StrategyType;
  label: string;
  description: string;
  icon?: string;
  available: boolean;
}> {
  return Array.from(strategyRegistry.values()).map(config => ({
    type: config.type,
    label: config.label,
    description: config.description,
    icon: config.icon,
    available: config.available
  }));
}

/**
 * Validate strategy configuration
 */
export function validateStrategy<TConfig>(
  type: StrategyType,
  config: TConfig,
  portfolio: WalletItem[]
): { valid: boolean; errors: string[]; warnings?: string[] } {
  const strategyConfig = getStrategyConfig(type);
  
  if (!strategyConfig) {
    return {
      valid: false,
      errors: [`Strategy type ${type} not found or not implemented`]
    };
  }

  if (!strategyConfig.available) {
    return {
      valid: false,
      errors: [`Strategy type ${type} is not available yet`]
    };
  }
  
  return strategyConfig.validate(config, portfolio);
}

/**
 * Build save request for strategy
 */
export function buildStrategyRequest<TConfig>(
  type: StrategyType,
  walletGroupId: string,
  config: TConfig,
  portfolio: WalletItem[],
  strategyId?: string
): SaveStrategyRequest {
  const strategyConfig = getStrategyConfig(type);
  
  if (!strategyConfig) {
    throw new Error(`Strategy type ${type} not found or not implemented`);
  }

  if (!strategyConfig.available) {
    throw new Error(`Strategy type ${type} is not available yet`);
  }
  
  return strategyConfig.buildRequest(walletGroupId, config, portfolio, strategyId);
}

/**
 * Calculate strategy results
 */
export function calculateStrategyResult<TResult>(
  strategy: Strategy,
  portfolio: WalletItem[]
): TResult {
  const strategyConfig = getStrategyConfig(strategy.strategyType);
  
  if (!strategyConfig) {
    throw new Error(`Strategy type ${strategy.strategyType} not found or not implemented`);
  }
  
  return strategyConfig.calculate(strategy, portfolio) as TResult;
}
