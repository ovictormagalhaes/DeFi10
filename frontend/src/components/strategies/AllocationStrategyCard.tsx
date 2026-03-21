/**
 * Allocation Strategy Card
 * Display card for existing allocation strategy
 */

import React, { useMemo, useState } from 'react';
import type { Strategy } from '../../types/strategy';
import type { WalletItem } from '../../types/wallet';
import { useAllocationStrategy } from '../../hooks/strategies/useAllocationStrategy';
import { useMaskValues } from '../../context/MaskValuesContext';
import './strategies.css';

interface AllocationStrategyCardProps {
  strategy: Strategy;
  portfolio: WalletItem[];
  onEdit?: () => void;
  onDelete: () => void;
}

export const AllocationStrategyCard: React.FC<AllocationStrategyCardProps> = ({
  strategy,
  portfolio,
  onEdit,
  onDelete
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const { maskValue } = useMaskValues();

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Chain logo mapping (same as HealthFactorCard)
  const chainLogos: Record<string, string> = {
    'ethereum': 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    'base': 'https://avatars.githubusercontent.com/u/108554348?s=200&v=4',
    'polygon': 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    'arbitrum': 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    'optimism': 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png',
    'avalanche': 'https://cryptologos.cc/logos/avalanche-avax-logo.png',
    'solana': 'https://cryptologos.cc/logos/solana-sol-logo.png',
    'bsc': 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
    'bnb': 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
  };

  // Calculate current status and deltas
  const { status, deltas } = useMemo(() => {
    // Check if strategy has allocations (new structure) or targetAllocations (old structure)
    const rawAllocations = (strategy as any).allocations || strategy.targetAllocations || [];
    
    // Sort by displayOrder if available
    const allocations = [...rawAllocations].sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      return orderA - orderB;
    });
    
    const assetsCount = allocations.length;
    
    // Calculate deltas manually without needing hook
    let maxDeviation = 0;
    let needsRebalance = false;
    let totalDelta = 0;
    const calculatedDeltas: any[] = [];
    
    let totalValue = 0;
    
    if (allocations.length > 0) {
      // Normalize group name helper
      const normalizeGroupName = (group: string): string => {
        const normalized = group
          .replace(' Position', '')
          .replace(' Pools', '')
          .trim();
        
        // Map Lending Supply/Borrow back to Lending for portfolio matching
        if (normalized === 'Lending Supply' || normalized === 'Lending Borrow') {
          return 'Lending';
        }
        
        return normalized;
      };

      // Group allocations by normalized group name
      const allocationsByGroup = new Map<string, typeof allocations>();
      allocations.forEach((alloc: any) => {
        const normalizedGroup = normalizeGroupName(alloc.group);
        if (!allocationsByGroup.has(normalizedGroup)) {
          allocationsByGroup.set(normalizedGroup, []);
        }
        allocationsByGroup.get(normalizedGroup)!.push(alloc);
      });

      // Pre-calculate totalStrategyGroupValue for each group
      const groupTotalValues = new Map<string, number>();
      allocationsByGroup.forEach((groupAllocs, normalizedGroup) => {
        let groupTotal = 0;
        groupAllocs.forEach((alloc: any) => {
          // Extract protocol/chain info from new structure
          const protocol = alloc.protocol?.id || alloc.protocol;
          const chain = alloc.chain?.id || alloc.chain;
          
          // Filter portfolio by the correct type based on group
          const filteredPortfolio = portfolio.filter(item => {
            // Map group names to portfolio types
            if (normalizedGroup === 'Lending') {
              return item.type === 'LendingAndBorrowing';
            } else if (normalizedGroup === 'Liquidity') {
              return item.type === 'LiquidityPool';
            } else if (normalizedGroup === 'Staking') {
              return item.type === 'Staking';
            } else if (normalizedGroup === 'Wallet') {
              return item.type === 'Wallet';
            }
            // If unknown group, search all
            return true;
          });
          
          // Find asset matching symbol AND protocol/chain
          const asset = filteredPortfolio.find(item => {
            const symbol = item.position?.tokens?.[0]?.symbol;
            const name = item.position?.tokens?.[0]?.name;
            
            // Match by symbol
            const symbolMatch = symbol === alloc.assetKey || 
                               symbol === (alloc.symbol || alloc.token?.symbol);
            
            if (!symbolMatch) return false;
            
            // Also match by protocol/chain
            if (protocol && chain) {
              return item.protocol?.id === protocol && 
                     item.protocol?.chain === chain;
            }
            
            return true;
          });
          
          if (asset) {
            // Determine if we should filter by token type (supply or borrow)
            const isLendingSupply = alloc.group === 'Lending Supply' || alloc.positionType === 1;
            const isLendingBorrow = alloc.group === 'Lending Borrow' || alloc.positionType === 2;
            
            // Filter tokens by type if needed
            let tokensToSum = asset.position?.tokens || [];
            
            if (isLendingSupply) {
              tokensToSum = tokensToSum.filter(t => {
                const tokenType = t.type?.toLowerCase() || '';
                return tokenType === 'supplied' || tokenType === 'supply';
              });
            } else if (isLendingBorrow) {
              tokensToSum = tokensToSum.filter(t => {
                const tokenType = t.type?.toLowerCase() || '';
                return tokenType === 'borrowed' || tokenType === 'borrow';
              });
            }
            
            // Sum all tokens in the position
            const assetValue = tokensToSum.reduce((sum, t) => 
              sum + Math.abs(t.financials?.totalPrice || 0), 0);
            groupTotal += assetValue;
          }
        });
        groupTotalValues.set(normalizedGroup, groupTotal);
        totalValue += groupTotal;
      });
      
      // Calculate deviations
      allocations.forEach((alloc: any) => {
        const normalizedGroup = normalizeGroupName(alloc.group);
        const totalStrategyGroupValue = groupTotalValues.get(normalizedGroup) || 0;
        
        // Extract data from new or old structure
        const protocol = alloc.protocol?.id || alloc.protocol;
        const protocolName = alloc.protocol?.name || 'Unknown';
        const protocolLogo = alloc.protocol?.logo || null;
        const chain = alloc.chain?.id || alloc.chain;
        const tokenSymbol = alloc.token?.symbol || alloc.symbol || alloc.assetKey;
        const tokenLogo = alloc.token?.logo || alloc.logo;
        
        // Filter portfolio by the correct type based on group
        const filteredPortfolio = portfolio.filter(item => {
          // Map group names to portfolio types
          if (normalizedGroup === 'Lending') {
            return item.type === 'LendingAndBorrowing';
          } else if (normalizedGroup === 'Liquidity') {
            return item.type === 'LiquidityPool';
          } else if (normalizedGroup === 'Staking') {
            return item.type === 'Staking';
          } else if (normalizedGroup === 'Wallet') {
            return item.type === 'Wallet';
          }
          // If unknown group, search all
          return true;
        });
        
        // Find matching assets filtered by symbol AND protocol/chain
        const matchingAssets = filteredPortfolio.filter(portfolioItem => {
          const symbol = portfolioItem.position?.tokens?.[0]?.symbol;
          
          // Match by symbol
          const symbolMatch = symbol === alloc.assetKey || 
                             symbol === tokenSymbol;
          
          if (!symbolMatch) return false;
          
          // Also match by protocol/chain
          if (protocol && chain) {
            return portfolioItem.protocol?.id === protocol && 
                   portfolioItem.protocol?.chain === chain;
          }
          
          return true;
        });
        
        // Determine if we should filter by token type (supply or borrow)
        const isLendingSupply = alloc.group === 'Lending Supply' || alloc.positionType === 1;
        const isLendingBorrow = alloc.group === 'Lending Borrow' || alloc.positionType === 2;
        
        // Sum values from all matching assets
        const currentValue = matchingAssets.reduce((total, asset) => {
          // Filter tokens by type if needed
          let tokensToSum = asset.position?.tokens || [];
          
          if (isLendingSupply) {
            tokensToSum = tokensToSum.filter(t => {
              const tokenType = t.type?.toLowerCase() || '';
              return tokenType === 'supplied' || tokenType === 'supply';
            });
          } else if (isLendingBorrow) {
            tokensToSum = tokensToSum.filter(t => {
              const tokenType = t.type?.toLowerCase() || '';
              return tokenType === 'borrowed' || tokenType === 'borrow';
            });
          }
          
          const assetValue = tokensToSum.reduce((sum, t) => 
            sum + Math.abs(t.financials?.totalPrice || 0), 0);
          return total + assetValue;
        }, 0);
        
        const currentWeight = totalStrategyGroupValue > 0 ? (currentValue / totalStrategyGroupValue) * 100 : 0;
        const targetValue = totalStrategyGroupValue * (alloc.targetWeight / 100);
        const deltaValue = targetValue - currentValue;
        const deltaWeight = alloc.targetWeight - currentWeight;
        const deviation = Math.abs(deltaWeight);
        
        // Capitalize chain name and get logo
        const chainName = chain || 'Unknown';
        const chainDisplayName = chainName === 'Unknown' ? 'Unknown' : chainName.charAt(0).toUpperCase() + chainName.slice(1);
        const chainLogo = chainLogos[chainName.toLowerCase()] || undefined;
        
        calculatedDeltas.push({
          assetKey: alloc.assetKey,
          symbol: tokenSymbol,
          logo: tokenLogo,
          group: alloc.group,
          protocolName: protocolName,
          protocolLogo: protocolLogo,
          chain: chainDisplayName,
          chainLogo: chainLogo,
          targetWeight: alloc.targetWeight,
          currentWeight,
          deltaWeight,
          targetValue,
          currentValue,
          deltaValue,
          needsRebalance: deviation > 5
        });
        
        totalDelta += Math.abs(deltaValue);
        
        if (deviation > maxDeviation) {
          maxDeviation = deviation;
        }
        
        if (deviation > 5) {
          needsRebalance = true;
        }
      });
    }
    
    return {
      status: {
        needsRebalance,
        maxDeviation,
        totalDelta,
        assetsCount,
        totalValue
      },
      deltas: calculatedDeltas
    };
  }, [strategy, portfolio]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="strategy-card">
      <div className="strategy-card__header" onClick={() => setCollapsed(!collapsed)} style={{ cursor: 'pointer' }}>
        <div className="strategy-card__title-section">
          <div className="strategy-card__title-row">
            <h3 className="strategy-card__title">
              {strategy.name || 'Allocation Strategy'}
            </h3>
          </div>
          {strategy.description && (
            <p className="strategy-card__description">{strategy.description}</p>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="strategy-card__actions" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="btn-base btn-primary"
                title="Edit Strategy"
              >
                Edit
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="btn-base btn-danger"
              title="Delete Strategy"
            >
              Delete
            </button>
          </div>
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{ 
              transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
              color: 'var(--app-text-secondary)',
              cursor: 'pointer'
            }}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="strategy-card__stats">
            <div className="strategy-card__stat">
              <div className="strategy-card__stat-label">Assets</div>
              <div className="strategy-card__stat-value">
                {status.assetsCount}
              </div>
            </div>
            <div className="strategy-card__stat">
              <div className="strategy-card__stat-label">Max Deviation</div>
              <div className="strategy-card__stat-value strategy-card__stat-value--warning">
                {isFinite(status.maxDeviation) ? status.maxDeviation.toFixed(1) : '0.0'}%
              </div>
            </div>
            <div className="strategy-card__stat">
              <div className="strategy-card__stat-label">Total Asset</div>
              <div className="strategy-card__stat-value">
                ${status.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {!collapsed && deltas.length > 0 && (
        <div className="strategy-table-container">
          <table className="strategy-table">
            <thead>
              <tr>
                <th className="text-left">Asset</th>
                <th className="text-left">Protocol</th>
                <th className="text-left">Chain</th>
                <th className="text-center">Target</th>
                <th className="text-center">Current</th>
                <th className="text-center">Delta</th>
                <th className="text-center">Target Value</th>
                <th className="text-center">Current Value</th>
                <th className="text-center">Delta Value</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {deltas.map((delta, idx) => (
                <tr key={idx}>
                  <td>
                    <div className="strategy-cell-with-logo strategy-cell-with-logo--left">
                      {delta.logo && (
                        <img src={delta.logo} alt={delta.symbol} />
                      )}
                      <span className="strategy-cell__text">{delta.symbol}</span>
                    </div>
                  </td>
                  <td>
                    <div className="strategy-cell-with-logo strategy-cell-with-logo--left">
                      {delta.protocolLogo && (
                        <img src={delta.protocolLogo} alt={delta.protocolName} />
                      )}
                      <span className="strategy-cell__text">{delta.protocolName}</span>
                    </div>
                  </td>
                  <td>
                    <div className="strategy-cell-with-logo strategy-cell-with-logo--left">
                      {delta.chainLogo && (
                        <img src={delta.chainLogo} alt={delta.chain} />
                      )}
                      <span className="strategy-cell__text">{delta.chain}</span>
                    </div>
                  </td>
                  <td className="text-center">{delta.targetWeight.toFixed(2)}%</td>
                  <td className="text-center">{delta.currentWeight.toFixed(2)}%</td>
                  <td className={`text-center ${delta.deltaWeight < 0 ? 'strategy-delta--negative' : delta.deltaWeight > 0 ? 'strategy-delta--positive' : 'strategy-delta--neutral'}`}>
                    {delta.deltaWeight > 0 ? '+' : ''}{delta.deltaWeight.toFixed(2)}%
                  </td>
                  <td className="text-center">
                    {maskValue(formatCurrency(delta.targetValue))}
                  </td>
                  <td className="text-center">
                    {maskValue(formatCurrency(delta.currentValue))}
                  </td>
                  <td className={`text-center ${delta.deltaValue < 0 ? 'strategy-delta--negative' : delta.deltaValue > 0 ? 'strategy-delta--positive' : 'strategy-delta--neutral'}`}>
                    {delta.deltaValue > 0 ? '+' : ''}{maskValue(formatCurrency(Math.abs(delta.deltaValue)))}
                  </td>
                  <td className="text-center">
                    {Math.abs(delta.deltaWeight) > 0.5 ? (
                      <button 
                        className={`strategy-action-btn ${delta.deltaValue > 0 ? 'strategy-action-btn--buy' : 'strategy-action-btn--sell'}`}
                        title={`${delta.group === 'Lending Borrow' 
                          ? (delta.deltaValue > 0 ? 'BORROW' : 'REPAY') 
                          : (delta.deltaValue > 0 ? 'BUY' : 'SELL')} $${Math.abs(delta.deltaValue).toFixed(2)}`}
                      >
                        {delta.group === 'Lending Borrow' 
                          ? (delta.deltaValue > 0 ? '↑ Borrow' : '↓ Repay')
                          : (delta.deltaValue > 0 ? '↑ Buy' : '↓ Sell')}
                      </button>
                    ) : (
                      <span className="strategy-action-btn strategy-action-btn--hold">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default AllocationStrategyCard;
