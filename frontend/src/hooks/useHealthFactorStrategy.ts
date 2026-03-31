/**
 * Hook for Health Factor Target Strategy (Type 2)
 * Monitors health factor and generates action suggestions
 */

import { useState, useCallback } from 'react';

import { SUPPORTED_CHAINS } from '../constants/chains';
import { saveStrategies } from '../services/apiClient';
import type {
  HealthFactorAction,
  HealthFactorStatus,
  HealthFactorStrategy,
  HealthFactorTargetConfig,
  Strategy,
} from '../types/strategy';
import type { WalletItem } from '../types/wallet';
import { capitalize } from '../utils/format';

import {
  clearStrategyCache,
  getStrategyByType,
  loadStrategyWithCache,
} from './useSharedStrategyCache';

export function useHealthFactorStrategy() {
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load existing health factor strategy
   */
  const loadStrategy = useCallback(async (walletGroupId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadStrategyWithCache(walletGroupId);
      const type2Strategy = getStrategyByType(data, 2);
      setStrategy(type2Strategy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load strategy');
      setStrategy(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Save health factor target strategy
   */
  const saveHealthFactorStrategy = useCallback(
    async (
      walletGroupId: string,
      config: HealthFactorTargetConfig,
      name?: string,
      description?: string,
      positionTargetHFs?: Record<string, number>, // Map of positionId -> targetHF
      positionCriticalThresholds?: Record<string, number>, // Map of positionId -> criticalThreshold
      portfolio?: WalletItem[], // Portfolio to extract protocol metadata
      strategyId?: string // Optional: when editing, pass the ID to update
    ) => {
      setSaving(true);
      setError(null);
      try {
        // Validate config
        if (config.targetHealthFactor < 1.5) {
          throw new Error('Target health factor must be at least 1.5');
        }
        if (config.warningThreshold >= config.targetHealthFactor) {
          throw new Error('Warning threshold must be less than target');
        }
        if (config.criticalThreshold >= config.warningThreshold) {
          throw new Error('Critical threshold must be less than warning threshold');
        }
        if (config.protocols.length === 0) {
          throw new Error('Select at least one protocol to monitor');
        }

        // Build targets: one target per position with target HF and critical threshold
        const targets: any[] = [];

        config.protocols.forEach((positionId, index) => {
          // positionId format: "protocol-chain" like "aave-v3-base" or "kamino-solana"
          // We need to find the matching portfolio item to get correct protocol/chain data

          // Try to find portfolio item by matching the positionId pattern
          // Portfolio items have protocol.id and protocol.chain properties
          const portfolioItem = portfolio?.find((item) => {
            if (!item.protocol?.id || !item.protocol?.chain) return false;
            const itemPositionId = `${item.protocol.id}-${item.protocol.chain}`;
            return itemPositionId === positionId;
          });

          // If found in portfolio, use that data; otherwise parse from positionId
          let protocolData, chainData;

          if (portfolioItem?.protocol) {
            protocolData = {
              id: portfolioItem.protocol.id,
              name: portfolioItem.protocol.name || portfolioItem.protocol.id,
              logo: portfolioItem.protocol.logo || '',
            };
            chainData = {
              id: portfolioItem.protocol.chain,
              name: capitalize(portfolioItem.protocol.chain),
              logo: '',
            };
          } else {
            // Fallback: try to parse from positionId (may not be accurate for multi-hyphen protocols)
            const parts = positionId.split('-');
            const chainId = parts[parts.length - 1]; // Last part is chain
            const protocolId = parts.slice(0, -1).join('-'); // Everything else is protocol

            protocolData = {
              id: protocolId,
              name: protocolId,
              logo: '',
            };
            chainData = {
              id: chainId,
              name: capitalize(chainId),
              logo: '',
            };
          }

          const targetHF = positionTargetHFs?.[positionId] || config.targetHealthFactor;
          const criticalThreshold =
            positionCriticalThresholds?.[positionId] || config.criticalThreshold;

          // Build target with new structure including displayOrder
          targets.push({
            assetKey: positionId,
            protocol: protocolData,
            chain: chainData,
            targetHealthFactor: targetHF,
            criticalThreshold: criticalThreshold,
            displayOrder: index, // Preserve order from form
          });
        });

        // Build strategy request in NEW format
        const newStrategy: any = {
          strategyType: 2,
          name: name || 'Health Factor Monitor',
          description: description || null,
          targets,
        };

        // If updating, preserve the ID
        if (strategyId) {
          newStrategy.id = strategyId;
        }

        // Get all existing strategies to preserve other types
        const existingData = await loadStrategyWithCache(walletGroupId);
        const strategies: any[] = [];

        // Preserve ALL existing strategies EXCEPT the one being updated
        const existingStrategies = existingData?.strategies || [];

        existingStrategies.forEach((s: any, index: number) => {
          // Replace the strategy being updated at the same position
          if (strategyId && s.id === strategyId) {
            strategies.push(newStrategy);
            return;
          }

          // Build proper format for each type
          const strategyPayload: any = {
            id: s.id,
            strategyType: s.strategyType,
            name: s.name,
            description: s.description,
          };

          // Include type-specific data
          if (s.strategyType === 1) {
            strategyPayload.allocations = s.allocations || [];
          } else if (s.strategyType === 2) {
            strategyPayload.targets = s.targets || [];
          }

          strategies.push(strategyPayload);
        });

        // If it's a new strategy (not updating), add at the end
        if (!strategyId) {
          strategies.push(newStrategy);
        }

        // Save all strategies in single request
        const response = await saveStrategies({
          walletGroupId,
          strategies,
        });

        // Clear cache and reload
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
    },
    [loadStrategy]
  );

  /**
   * Monitor health factor status from portfolio
   */
  const monitorHealthFactor = useCallback(
    (
      portfolio: WalletItem[],
      config: HealthFactorTargetConfig,
      positionTargetHFs?: Record<string, number>, // Map of positionId -> targetHF
      positionCriticalThresholds?: Record<string, number> // Map of positionId -> criticalThreshold
    ): HealthFactorStatus[] => {
      const statuses: HealthFactorStatus[] = [];

      const chainLogos: Record<string, string> = Object.fromEntries(
        SUPPORTED_CHAINS.map((c) => [c.id.toLowerCase(), c.iconUrl])
      );

      // Filter lending positions with health factor
      const lendingPositions = portfolio.filter(
        (item) => item.type === 'LendingAndBorrowing' && item.additionalData?.healthFactor != null
      );

      // Group positions by protocol + chain and aggregate tokens
      const positionGroups = new Map<string, WalletItem[]>();

      for (const item of lendingPositions) {
        const protocolId = `${item.protocol?.id || ''}-${item.protocol?.chain || ''}`;

        if (!positionGroups.has(protocolId)) {
          positionGroups.set(protocolId, []);
        }
        positionGroups.get(protocolId)!.push(item);
      }

      // Process each protocol+chain group IN THE ORDER specified by config.protocols
      // This preserves the user's preferred order
      const protocolsToProcess =
        config.protocols.length > 0 ? config.protocols : Array.from(positionGroups.keys());

      for (const protocolId of protocolsToProcess) {
        const items = positionGroups.get(protocolId);

        // Skip if no items found for this protocol (shouldn't happen in normal flow)
        if (!items || items.length === 0) {
          continue;
        }

        const firstItem = items[0];
        const protocolName = firstItem.protocol?.name || 'Unknown';
        const chainName = firstItem.protocol?.chain || '';
        const chainDisplayName = capitalize(chainName);

        const currentHF = firstItem.additionalData?.healthFactor || 0;

        // Get position-specific target HF or use global default
        const targetHF = positionTargetHFs?.[protocolId] || config.targetHealthFactor;

        // Get position-specific critical threshold or use global default
        const criticalThreshold =
          positionCriticalThresholds?.[protocolId] || config.criticalThreshold;

        // Aggregate all tokens from all positions in this protocol+chain group
        let collateralValue = 0;
        let debtValue = 0;

        items.forEach((item) => {
          const allTokens = item.position?.tokens || [];

          allTokens.forEach((token) => {
            const tokenType = token.type?.toLowerCase() || '';
            const tokenPrice = Math.abs(token.financials?.totalPrice || 0);

            // Check if it's a borrow token
            if (tokenType === 'borrowed' || tokenType === 'borrow') {
              debtValue += tokenPrice;
            } else if (tokenType === 'supplied' || tokenType === 'supply') {
              collateralValue += tokenPrice;
            }
          });
        });

        // Determine status based on position-specific target and critical threshold
        let status: HealthFactorStatus['status'];

        // Calculate warning threshold (10% above critical)
        const warningBuffer = criticalThreshold * 1.1;

        if (currentHF <= criticalThreshold) {
          status = 'critical'; // At or below critical threshold - immediate action needed
        } else if (currentHF < warningBuffer) {
          status = 'warning'; // Within 10% above critical - close to danger zone
        } else {
          status = 'safe'; // 10% or more above critical threshold
        }

        const needsAction = currentHF < targetHF;

        // Generate suggestions if needed
        const suggestions =
          needsAction && config.autoSuggest
            ? generateSuggestions(firstItem, currentHF, targetHF)
            : [];

        statuses.push({
          current: currentHF,
          target: targetHF, // Use position-specific target
          criticalThreshold, // Include position-specific critical threshold
          status,
          needsAction,
          collateralValue,
          debtValue,
          totalValue: collateralValue + debtValue,
          suggestions,
          protocol: protocolId,
          protocolName,
          protocolLogo: firstItem.protocol?.logo,
          chain: chainDisplayName,
          chainLogo: chainLogos[chainName.toLowerCase()] || undefined,
        });
      }

      return statuses;
    },
    []
  );

  /**
   * Generate action suggestions to reach target HF
   */
  const generateSuggestions = (
    item: WalletItem,
    currentHF: number,
    targetHF: number
  ): HealthFactorAction[] => {
    const suggestions: HealthFactorAction[] = [];

    // Calculate collateral and debt from tokens
    const supplyTokens =
      item.position?.tokens?.filter(
        (t) =>
          !t.symbol?.toLowerCase().includes('debt') && !t.type?.toLowerCase().includes('borrow')
      ) || [];

    const borrowTokens =
      item.position?.tokens?.filter(
        (t) => t.symbol?.toLowerCase().includes('debt') || t.type?.toLowerCase().includes('borrow')
      ) || [];

    const collateralValue = supplyTokens.reduce(
      (sum, t) => sum + (t.financials?.totalPrice || 0),
      0
    );
    const debtValue = borrowTokens.reduce((sum, t) => sum + (t.financials?.totalPrice || 0), 0);

    if (debtValue === 0 || collateralValue === 0) {
      return suggestions;
    }

    // Priority based on how far from target
    const delta = targetHF - currentHF;
    let priority: HealthFactorAction['priority'];
    if (currentHF < 1.2) {
      priority = 'critical';
    } else if (currentHF < 1.5) {
      priority = 'high';
    } else if (currentHF < 1.8) {
      priority = 'medium';
    } else {
      priority = 'low';
    }

    // Get supply tokens (collateral) - already filtered above
    // Get borrow tokens (debt) - already filtered above

    // Suggestion 1: Add collateral
    // HF = (collateral * liquidationThreshold) / debt
    // Assuming liquidationThreshold ≈ 0.85 (typical for most assets)
    const liquidationThreshold = 0.85;
    const requiredCollateral = (targetHF * debtValue) / liquidationThreshold;
    const additionalCollateralNeeded = requiredCollateral - collateralValue;

    if (additionalCollateralNeeded > 0 && supplyTokens.length > 0) {
      const token = supplyTokens[0];
      const tokenPrice = token.financials?.price || 0;
      const amount = tokenPrice > 0 ? additionalCollateralNeeded / tokenPrice : 0;
      const protocolId = item.protocol?.id || 'unknown';

      if (amount > 0) {
        suggestions.push({
          action: 'add_collateral',
          protocol: protocolId,
          assetKey: `${protocolId}_${token.contractAddress || token.symbol}`,
          amountUsd: additionalCollateralNeeded,
          priority,
        });
      }
    }

    const maxDebt = (collateralValue * liquidationThreshold) / targetHF;
    const debtToRepay = debtValue - maxDebt;

    if (debtToRepay > 0 && borrowTokens.length > 0) {
      const token = borrowTokens[0];
      const protocolId = item.protocol?.id || 'unknown';
      const assetKey = `${protocolId}_${token.contractAddress || token.symbol}`;

      suggestions.push({
        action: 'reduce_debt',
        protocol: protocolId,
        assetKey,
        amountUsd: debtToRepay,
        priority,
      });
    }

    return suggestions;
  };

  /**
   * Extract config from saved strategy
   */
  const getConfig = useCallback((): HealthFactorTargetConfig | null => {
    if (!strategy || strategy.strategyType !== 2) {
      return null;
    }

    const healthFactorStrategy = strategy as HealthFactorStrategy;
    const firstTarget = healthFactorStrategy.targets[0];
    if (!firstTarget) {
      return null;
    }

    return {
      targetHealthFactor: firstTarget.targetHealthFactor,
      warningThreshold: firstTarget.targetHealthFactor * 0.9,
      criticalThreshold: firstTarget.criticalThreshold,
      autoSuggest: true,
      protocols: [firstTarget.protocol.id],
    };
  }, [strategy]);

  return {
    strategy,
    loading,
    saving,
    error,
    loadStrategy,
    saveHealthFactorStrategy,
    monitorHealthFactor,
    getConfig,
  };
}
