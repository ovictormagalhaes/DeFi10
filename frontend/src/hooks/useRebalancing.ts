/**
 * Hook para funcionalidades de Rebalancing TypeScript
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { RebalanceAssetType, CHAIN_MAPPINGS } from '../types/rebalancing';
import type { 
  RebalanceItem, 
  RebalanceRequestItem, 
  RebalanceCalculation, 
  RebalanceValidation, 
  PortfolioStats,
  RebalanceToken,
  UseRebalancingResult,
  ChainKey
} from '../types/rebalancing';
import type { WalletItem } from '../types/wallet';

// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const useRebalancing = (
  walletTokens: WalletItem[] = [],
  liquidityPools: WalletItem[] = [],
  lendingPositions: WalletItem[] = [],
  stakingPositions: WalletItem[] = [],
  account?: string
): UseRebalancingResult => {
  
  // State
  const [items, setItems] = useState<RebalanceItem[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Normalize chain identifier
  const getChainKey = useCallback((token: any): ChainKey => {
    if (!token || typeof token !== 'object') return 'unknown';
    
    const raw = token.chain || token.chainId || token.chainID || token.network || token.chainName || token.chain_name;
    if (raw == null) return 'unknown';
    
    const lower = String(raw).trim().toLowerCase();
    return CHAIN_MAPPINGS[lower] || 'unknown';
  }, []);

  // Convert WalletItem to RebalanceToken
  const convertToRebalanceToken = useCallback((item: WalletItem): RebalanceToken[] => {
    const tokens: RebalanceToken[] = [];
    
    // Extract tokens from position
    const positionTokens = item.position?.tokens || [];
    
    positionTokens.forEach(token => {
      if (!token) return;
      
      const balance = token.financials?.amount || 0;
      const price = token.financials?.price || 0;
      const value = token.financials?.totalPrice || balance * price;
      
      tokens.push({
        symbol: token.symbol || 'Unknown',
        name: token.name || token.symbol || 'Unknown Token',
        contractAddress: token.contractAddress || '',
        chain: getChainKey(token),
        logo: token.logo || token.thumbnail || undefined,
        balance,
        balanceFormatted: balance.toFixed(4),
        price,
        value,
        percentage: 0, // Will be calculated later
        decimals: token.financials?.decimalPlaces || 18
      });
    });
    
    return tokens;
  }, [getChainKey]);

  // Calculate portfolio statistics
  const portfolioStats: PortfolioStats = useMemo(() => {
    const allItems = [...walletTokens, ...liquidityPools, ...lendingPositions, ...stakingPositions];
    
    const totalValue = allItems.reduce((sum, item) => {
      const value = item.totalPrice || item.totalValueUsd || 0;
      return sum + Number(value);
    }, 0);

    const itemCounts = {
      [RebalanceAssetType.Wallet]: walletTokens.length,
      [RebalanceAssetType.LiquidityPool]: liquidityPools.length,
      [RebalanceAssetType.LendingAndBorrowing]: lendingPositions.length,
      [RebalanceAssetType.Staking]: stakingPositions.length,
      [RebalanceAssetType.Group]: 0
    };

    const protocolDistribution: Record<string, number> = {};
    const chainDistribution: Record<string, number> = {};
    const tokenValues: Record<string, number> = {};

    allItems.forEach(item => {
      const value = Number(item.totalPrice || item.totalValueUsd || 0);
      
      // Protocol distribution
      const protocol = item.protocol?.name || 'Unknown';
      protocolDistribution[protocol] = (protocolDistribution[protocol] || 0) + value;
      
      // Chain distribution
      const tokens = convertToRebalanceToken(item);
      tokens.forEach(token => {
        chainDistribution[token.chain] = (chainDistribution[token.chain] || 0) + token.value;
        tokenValues[token.symbol] = (tokenValues[token.symbol] || 0) + token.value;
      });
    });

    // Top tokens by value
    const topTokens = Object.entries(tokenValues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([symbol, value]) => ({
        symbol,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
      }));

    return {
      totalValue,
      itemCounts,
      protocolDistribution,
      chainDistribution,
      topTokens
    };
  }, [walletTokens, liquidityPools, lendingPositions, stakingPositions, convertToRebalanceToken]);

  // Validation
  const validation: RebalanceValidation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const names = new Set<string>();
    const duplicateNames: string[] = [];
    let totalPercentage = 0;
    let emptyItems = 0;

    items.forEach((item, index) => {
      // Check for empty name
      if (!item.name.trim()) {
        errors.push(`Item ${index + 1}: Name is required`);
        emptyItems++;
        return;
      }

      // Check for duplicate names
      if (names.has(item.name)) {
        duplicateNames.push(item.name);
        errors.push(`Duplicate name: ${item.name}`);
      } else {
        names.add(item.name);
      }

      // Check target percentage
      if (item.targetPercentage <= 0) {
        errors.push(`${item.name}: Target percentage must be greater than 0`);
      }

      if (item.targetPercentage > 100) {
        warnings.push(`${item.name}: Target percentage exceeds 100%`);
      }

      totalPercentage += item.targetPercentage;
    });

    // Check total percentage
    if (totalPercentage > 100) {
      warnings.push(`Total percentage (${totalPercentage.toFixed(2)}%) exceeds 100%`);
    }

    if (Math.abs(totalPercentage - 100) > 0.01 && items.length > 0) {
      warnings.push(`Total percentage (${totalPercentage.toFixed(2)}%) should equal 100%`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      totalPercentage,
      duplicateNames: Array.from(new Set(duplicateNames)),
      emptyItems
    };
  }, [items]);

  // Add item
  const addItem = useCallback((requestItem: RebalanceRequestItem) => {
    const newItem: RebalanceItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      name: requestItem.name,
      assetType: requestItem.assetType,
      referenceType: requestItem.referenceType,
      targetPercentage: requestItem.targetPercentage,
      currentPercentage: 0,
      currentValue: 0,
      targetValue: 0,
      difference: 0,
      differencePercentage: 0,
      tokens: []
    };

    setItems(prev => [...prev, newItem]);
  }, []);

  // Update item
  const updateItem = useCallback((index: number, requestItem: RebalanceRequestItem) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      
      return {
        ...item,
        name: requestItem.name,
        assetType: requestItem.assetType,
        referenceType: requestItem.referenceType,
        targetPercentage: requestItem.targetPercentage
      };
    }));
  }, []);

  // Remove item
  const removeItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Calculate rebalancing
  const calculate = useCallback(async (): Promise<RebalanceCalculation | null> => {
    if (!account) {
      setError('Account is required for calculation');
      return null;
    }

    if (items.length === 0) {
      setError('No items to calculate');
      return null;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const requestItems: RebalanceRequestItem[] = items.map(item => ({
        name: item.name,
        assetType: item.assetType,
        referenceType: item.referenceType,
        targetPercentage: item.targetPercentage,
        tokens: item.tokens.map(t => t.contractAddress).filter(Boolean),
        protocolIds: [], // TODO: Extract from data
        groupType: item.isGroup ? item.assetType : undefined
      }));

      const response = await fetch(`${API_BASE_URL}/api/rebalance/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account,
          items: requestItems,
          totalValue: portfolioStats.totalValue
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Calculation failed');
      }

      // Update items with calculated values
      if (result.data?.items) {
        setItems(prev => prev.map((item, index) => {
          const calculated = result.data.items[index];
          if (!calculated) return item;

          return {
            ...item,
            currentValue: calculated.currentValue,
            currentPercentage: calculated.currentPercentage,
            targetValue: calculated.targetValue,
            difference: calculated.difference,
            differencePercentage: calculated.differencePercentage,
            tokens: calculated.tokens || item.tokens
          };
        }));
      }

      return result.data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Calculation error:', err);
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [account, items, portfolioStats.totalValue]);

  // Save configuration
  const save = useCallback(async (key: string, name: string): Promise<boolean> => {
    if (!account) {
      setError('Account is required for saving');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const requestItems: RebalanceRequestItem[] = items.map(item => ({
        name: item.name,
        assetType: item.assetType,
        referenceType: item.referenceType,
        targetPercentage: item.targetPercentage
      }));

      const response = await fetch(`${API_BASE_URL}/api/rebalance/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          name,
          account,
          items: requestItems,
          totalPercentage: validation.totalPercentage
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Save failed');
      }

      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Save error:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [account, items, validation.totalPercentage]);

  // Load configuration
  const load = useCallback(async (key: string): Promise<boolean> => {
    if (!account) {
      setError('Account is required for loading');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/rebalance/load/${key}?account=${encodeURIComponent(account)}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Load failed');
      }

      if (result.data?.items) {
        const loadedItems: RebalanceItem[] = result.data.items.map((requestItem: RebalanceRequestItem, index: number) => ({
          id: `loaded-${Date.now()}-${index}`,
          name: requestItem.name,
          assetType: requestItem.assetType,
          referenceType: requestItem.referenceType,
          targetPercentage: requestItem.targetPercentage,
          currentPercentage: 0,
          currentValue: 0,
          targetValue: 0,
          difference: 0,
          differencePercentage: 0,
          tokens: []
        }));

        setItems(loadedItems);
      }

      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Load error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  return {
    items,
    addItem,
    updateItem,
    removeItem,
    calculate,
    save,
    load,
    validation,
    isCalculating,
    isSaving,
    isLoading,
    error
  };
};

export default useRebalancing;