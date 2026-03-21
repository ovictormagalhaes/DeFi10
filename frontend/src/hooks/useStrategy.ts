/**
 * useStrategy Hook
 * Generic hook for managing strategies with support for multiple types
 * Version: 2.0 - Refactored with factory pattern
 */

import { useState, useCallback } from 'react';
import type { WalletItem } from '../types/wallet';
import type { 
  Strategy, 
  StrategyType,
  SaveStrategyResponse
} from '../types/strategy';
import { saveStrategy as saveStrategyApi, saveStrategies } from '../services/apiClient';
import { loadStrategyWithCache, clearStrategyCache, getStrategyByType } from './useSharedStrategyCache';
import { 
  validateStrategy, 
  buildStrategyRequest, 
  calculateStrategyResult 
} from '../utils/strategies/strategyFactory';

export interface UseStrategyResult<TConfig = unknown, TResult = unknown> {
  // State
  strategy: Strategy | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  
  // Actions
  loadStrategy: (walletGroupId: string) => Promise<void>;
  saveStrategy: (
    strategyType: StrategyType,
    walletGroupId: string,
    config: TConfig,
    portfolio: WalletItem[],
    strategyId?: string
  ) => Promise<SaveStrategyResponse>;
  clearStrategy: () => void;
  
  // Calculations
  calculate: (portfolio: WalletItem[]) => TResult | null;
}

export function useStrategy<TConfig = unknown, TResult = unknown>(): UseStrategyResult<TConfig, TResult> {
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load strategy for a wallet group
   */
  const loadStrategy = useCallback(async (walletGroupId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await loadStrategyWithCache(walletGroupId);
      const type1Strategy = getStrategyByType(data, 1);
      setStrategy(type1Strategy);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load strategy';
      setError(message);
      console.error('Error loading strategy:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Save strategy using factory pattern
   * Works with any strategy type
   * 
   * 🚨 CRITICAL: Backend overwrites ALL strategies, so we must merge manually
   */
  const saveStrategy = useCallback(async (
    strategyType: StrategyType,
    walletGroupId: string,
    config: TConfig,
    portfolio: WalletItem[],
    strategyId?: string
  ): Promise<SaveStrategyResponse> => {
    setSaving(true);
    setError(null);

    try {
      // Validate using factory
      const validation = validateStrategy(strategyType, config, portfolio);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Log warnings if any
      if (validation.warnings && validation.warnings.length > 0) {
        console.warn('Strategy warnings:', validation.warnings);
      }

      // Build request for current strategy type
      const request = buildStrategyRequest(strategyType, walletGroupId, config, portfolio, strategyId);

      // Get all existing strategies to preserve them
      const existingData = await loadStrategyWithCache(walletGroupId);
      const strategies: any[] = [];
      
      // Preserve ALL existing strategies EXCEPT the one being updated
      const existingStrategies = existingData?.strategies || [];
      
      existingStrategies.forEach((s: any, index: number) => {
        // Replace the strategy being updated at the same position
        if (strategyId && s.id === strategyId) {
          strategies.push(request);
          return;
        }
        strategies.push(s); // Keep as-is
      });
      
      // If it's a new strategy (not updating), add at the end
      if (!strategyId) {
        strategies.push(request);
      }

      // Save all strategies in single request
      const response = await saveStrategies({
        walletGroupId,
        strategies
      });

      // Clear cache and reload strategy to get updated data
      clearStrategyCache(walletGroupId);
      await loadStrategy(walletGroupId);

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save strategy';
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [loadStrategy]);

  /**
   * Clear current strategy
   */
  const clearStrategy = useCallback(() => {
    setStrategy(null);
    setError(null);
  }, []);

  /**
   * Calculate strategy results using factory pattern
   */
  const calculate = useCallback((portfolio: WalletItem[]): TResult | null => {
    if (!strategy) {
      return null;
    }
    
    try {
      return calculateStrategyResult<TResult>(strategy, portfolio);
    } catch (err) {
      console.error('Error calculating strategy:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate strategy');
      return null;
    }
  }, [strategy]);

  return {
    strategy,
    loading,
    error,
    saving,
    loadStrategy,
    saveStrategy,
    clearStrategy,
    calculate
  };
}

export default useStrategy;
