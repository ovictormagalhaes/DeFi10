/**
 * Shared cache for strategy data to prevent duplicate API calls
 * Both useAllocationStrategy and useHealthFactorStrategy will use this cache
 */

import { getStrategyByGroup } from '../services/apiClient';
import type { Strategy, SaveStrategiesResponse, StrategyData } from '../types/strategy';

interface CacheEntry {
  data: SaveStrategiesResponse | null;
  timestamp: number;
}

// Global cache shared across all hook instances
const strategyCache = new Map<string, CacheEntry>();
const loadingPromises = new Map<string, Promise<SaveStrategiesResponse | null>>();
const CACHE_TTL = 5000; // 5 seconds

/**
 * Load strategy with caching - returns new format with array of strategies
 */
export async function loadStrategyWithCache(walletGroupId: string): Promise<SaveStrategiesResponse | null> {
  const now = Date.now();
  const cached = strategyCache.get(walletGroupId);

  // Return cached data if still valid
  if (cached && (now - cached.timestamp) < CACHE_TTL && cached.data !== null) {
    return cached.data;
  }

  // CRITICAL: Check if already loading (this prevents duplicate calls)
  const existingPromise = loadingPromises.get(walletGroupId);
  if (existingPromise) {
    return existingPromise;
  }

  // Create new API call
  const promise = getStrategyByGroup(walletGroupId)
    .then(data => {
      strategyCache.set(walletGroupId, {
        data,
        timestamp: Date.now()
      });
      loadingPromises.delete(walletGroupId);
      return data;
    })
    .catch(err => {
      // Remove on error so next call will retry
      strategyCache.delete(walletGroupId);
      loadingPromises.delete(walletGroupId);
      throw err;
    });

  // Store promise IMMEDIATELY before any await
  loadingPromises.set(walletGroupId, promise);

  return promise;
}

/**
 * Helper to get a specific strategy by type from the response
 * Returns only the FIRST strategy of that type (legacy behavior)
 */
export function getStrategyByType(data: SaveStrategiesResponse | null, strategyType: number): Strategy | null {
  if (!data || !data.strategies) return null;
  
  const strategy = data.strategies.find(s => s.strategyType === strategyType);
  if (!strategy) return null;
  
  // Convert to legacy Strategy format for backwards compatibility
  return {
    id: strategy.id, // CRITICAL: Preserve ID for update operations
    walletGroupId: data.walletGroupId,
    accounts: data.accounts,
    strategyType: strategy.strategyType,
    name: strategy.name,
    description: strategy.description || null,
    // NEW structure (backend sends these)
    allocations: (strategy as any).allocations || undefined,
    targets: (strategy as any).targets || undefined,
    // Legacy structure (for backwards compatibility)
    items: (strategy as any).items || undefined,
    targetAllocations: (strategy as any).targetAllocations || undefined,
    count: data.count,
    key: data.walletGroupId,
    createdAt: (strategy as any).createdAt,
    updatedAt: (strategy as any).updatedAt
  } as Strategy;
}

/**
 * Helper to get ALL strategies of a specific type from the response
 */
export function getAllStrategiesByType(data: SaveStrategiesResponse | null, strategyType: number): Strategy[] {
  if (!data || !data.strategies) return [];
  
  return data.strategies
    .filter(s => s.strategyType === strategyType)
    .map(strategy => ({
      id: strategy.id,
      walletGroupId: data.walletGroupId,
      accounts: data.accounts,
      strategyType: strategy.strategyType,
      name: strategy.name,
      description: strategy.description || null,
      // NEW structure (backend sends these)
      allocations: (strategy as any).allocations || undefined,
      targets: (strategy as any).targets || undefined,
      // Legacy structure (for backwards compatibility)
      items: (strategy as any).items || undefined,
      targetAllocations: (strategy as any).targetAllocations || undefined,
      count: data.count,
      key: data.walletGroupId,
      createdAt: (strategy as any).createdAt,
      updatedAt: (strategy as any).updatedAt
    } as Strategy));
}

/**
 * Clear cache for a specific wallet group or all
 */
export function clearStrategyCache(walletGroupId?: string) {
  if (walletGroupId) {
    strategyCache.delete(walletGroupId);
    loadingPromises.delete(walletGroupId);
  } else {
    strategyCache.clear();
    loadingPromises.clear();
  }
}
