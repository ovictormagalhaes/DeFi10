/**
 * Allocation by Weight Strategy - Calculations and Builders
 * Version: 4.0 - Clean structure with allocations[]
 */

import type { WalletItem } from '../../types/wallet';
import type { 
  AllocationStrategy,
  SaveAllocationStrategyRequest,
  AllocationDelta
} from '../../types/strategy';
import type { 
  AllocationByWeightConfig,
  AllocationByWeightResult,
  RebalanceAction
} from '../../types/strategies/allocationByWeight';
import { 
  calculateAllocationDeltas,
  getAllocationSummary,
  suggestRebalanceActions
} from '../allocationCalculations';

/**
 * Validate allocation configuration
 */
export function validateAllocationConfig(
  config: AllocationByWeightConfig,
  portfolio: WalletItem[]
): { valid: boolean; errors: string[]; warnings?: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate allocations sum to 100%
  const totalWeight = config.allocations.reduce((sum, a) => sum + a.weight, 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    errors.push(`Total allocation must equal 100% (current: ${totalWeight.toFixed(2)}%)`);
  }

  // Validate each allocation
  config.allocations.forEach(alloc => {
    if (!alloc.assetKey) {
      errors.push('Asset key is required');
    }
    if (!alloc.protocol) {
      errors.push(`Protocol is required for ${alloc.assetKey}`);
    }
    if (!alloc.chain) {
      errors.push(`Chain is required for ${alloc.assetKey}`);
    }
    if (!alloc.group) {
      errors.push(`Group is required for ${alloc.assetKey}`);
    }
    if (alloc.weight <= 0 || alloc.weight > 100) {
      errors.push(`Invalid weight for ${alloc.assetKey}: ${alloc.weight}%`);
    }
  });

  // Warning if no name provided
  if (!config.name || config.name.trim() === '') {
    warnings.push('Strategy name is recommended for better organization');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Build SaveAllocationStrategyRequest (NEW structure)
 * Extracts protocol/chain metadata from portfolio
 */
export function buildAllocationRequest(
  walletGroupId: string,
  config: AllocationByWeightConfig,
  portfolio: WalletItem[],
  strategyId?: string
): SaveAllocationStrategyRequest {
  // Build allocations array with protocol/chain nested objects
  const allocations = config.allocations.map(allocation => {
    // Find matching portfolio item to extract metadata
    const matchingItem = portfolio.find(item => {
      const hasMatchingToken = item.position.tokens.some(
        t => t.symbol === allocation.assetKey
      );
      const matchingProtocol = item.protocol.id === allocation.protocol;
      const matchingChain = item.protocol.chain === allocation.chain;
      return hasMatchingToken && matchingProtocol && matchingChain;
    });

    // Extract token info from matching item
    const matchingToken = matchingItem?.position.tokens.find(
      t => t.symbol === allocation.assetKey
    );

    // Determine groupType based on WalletItemType
    let groupType = 0;
    if (matchingItem) {
      switch (matchingItem.type) {
        case 'LendingAndBorrowing':
          groupType = 10; // Lending Supply
          break;
        case 'LiquidityPool':
          groupType = 20; // Liquidity Pool
          break;
        case 'Staking':
          groupType = 30; // Staking
          break;
        case 'Wallet':
          groupType = 40; // Wallet
          break;
      }
    }

    // Determine positionType (Supplied, Borrowed, etc.)
    let positionType = 0;
    if (matchingItem?.position.label === 'Supplied') {
      positionType = 1; // Supplied
    } else if (matchingItem?.position.label === 'Borrowed') {
      positionType = 2; // Borrowed
    }

    return {
      assetKey: allocation.assetKey,
      protocol: matchingItem ? {
        id: matchingItem.protocol.id,
        name: matchingItem.protocol.name,
        logo: matchingItem.protocol.logo
      } : {
        id: allocation.protocol || '',
        name: allocation.protocol || '',
        logo: ''
      },
      chain: matchingItem ? {
        id: matchingItem.protocol.chain,
        name: matchingItem.protocol.chain,
        logo: ''
      } : {
        id: allocation.chain || '',
        name: allocation.chain || '',
        logo: ''
      },
      token: matchingToken ? {
        symbol: matchingToken.symbol,
        name: matchingToken.name,
        address: matchingToken.contractAddress,
        logo: matchingToken.logo || ''
      } : {
        symbol: allocation.assetKey,
        name: allocation.assetKey,
        address: '',
        logo: ''
      },
      group: allocation.group,
      groupType,
      targetWeight: allocation.weight,
      positionType
    };
  });

  const request: SaveAllocationStrategyRequest = {
    strategyType: 1,
    name: config.name || 'Allocation Strategy',
    description: config.description || null,
    allocations
  };

  if (strategyId) {
    request.id = strategyId;
  }

  return request;
}

/**
 * Calculate AllocationByWeight results
 * Combines STATIC strategy config with DYNAMIC portfolio data
 */
export function calculateAllocationResult(
  strategy: AllocationStrategy,
  portfolio: WalletItem[]
): AllocationByWeightResult {
  // Calculate deltas (combines static targets with dynamic current values)
  const deltas = calculateAllocationDeltas(strategy, portfolio);
  
  // Get summary
  const rawSummary = getAllocationSummary(deltas);
  const summary = {
    totalAssets: rawSummary.totalAssets,
    assetsNeedingRebalance: rawSummary.assetsNeedingRebalance,
    maxDeviation: rawSummary.maxDeltaWeight,
    totalDeltaUsd: rawSummary.totalDeltaValueUsd,
  };

  // Get recommendations
  const rawRecommendations = suggestRebalanceActions(deltas);
  const recommendations: RebalanceAction[] = rawRecommendations.map(r => ({
    action: r.action === 'hold' ? 'buy' as const : r.action,
    assetKey: r.assetKey,
    group: r.group,
    amountUsd: r.amountUsd,
    currentValueUsd: 0,
    targetValueUsd: 0,
    priority: r.percentageChange > 10 ? 'high' as const : r.percentageChange > 5 ? 'medium' as const : 'low' as const,
    reason: r.action === 'hold' ? 'Within threshold' : `${r.action === 'buy' ? 'Under' : 'Over'}-allocated by ${r.percentageChange.toFixed(1)}%`,
  }));

  return {
    deltas,
    summary,
    recommendations
  };
}
