// src/components/charts/hooks/useChartData.ts
import { useMemo } from 'react';
import { WalletItemType, WalletItemTypeLabels, WalletItemTypeColors } from '../../../constants/walletItemTypes';

interface UseChartDataParams {
  walletTokens: unknown[];
  liquidityData: unknown[];
  lendingData: unknown[];
  stakingData: unknown[];
  lockingData: unknown[];
  groupDefiByProtocol: (data: unknown[]) => unknown[];
  filterLendingDefiTokens: (tokens: unknown[], show: boolean) => unknown[];
  showLendingDefiTokens: boolean;
}

export const useChartData = ({
  walletTokens,
  liquidityData,
  lendingData,
  stakingData,
  lockingData,
  groupDefiByProtocol,
  filterLendingDefiTokens,
  showLendingDefiTokens,
}: UseChartDataParams) => {
  // Helper function to calculate signed token value (negative for debt)
  const signedTokenValue = (t: unknown, pos?: unknown): number => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = t as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const position = pos as any;
    
    const ty = (token.type || '').toLowerCase();
    const val = Math.abs(parseFloat(token.totalPrice) || 0);
    if (ty === 'borrowed' || ty === 'borrow' || ty === 'debt') return -val;
    if (!ty && position) {
      const lbl = (position?.position?.label || position?.label || '').toLowerCase();
      if (lbl.includes('borrow') || lbl.includes('debt')) return -val;
    }
    return val;
  };

  // Calculate portfolio values
  const portfolioData = useMemo(() => {
    const walletValue = walletTokens.reduce((sum, tokenData) => {
      const token = tokenData.token || tokenData;
      return sum + (parseFloat(token.totalPrice) || 0);
    }, 0);

    const liquidityValue = groupDefiByProtocol(liquidityData).reduce(
      (total, group) => {
        return total +
        group.positions.reduce(
          (sum: number, pos: any) =>
            sum +
            (pos.tokens?.reduce(
              (tokenSum: number, token: any) => {
                // Liquidity tokens have totalPrice inside financials object
                const price = parseFloat(token.financials?.totalPrice || token.totalPrice) || 0;
                return tokenSum + price;
              },
              0
            ) || 0),
          0
        );
      },
      0
    );

    const lendingValue = groupDefiByProtocol(lendingData).reduce((grand, group) => {
      const groupSum = group.positions.reduce((sum: number, pos: any) => {
        const tokens = Array.isArray(pos.tokens)
          ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens)
          : [];
        const net = tokens.reduce((s: number, t: any) => s + signedTokenValue(t, pos), 0);
        return sum + net;
      }, 0);
      return grand + groupSum;
    }, 0);

    const stakingValue = stakingData.reduce((total, position) => {
      const balance = parseFloat(position.balance) || 0;
      return total + (isNaN(balance) ? 0 : balance);
    }, 0);

    const lockingGroups = groupDefiByProtocol(lockingData);
    console.log('[useChartData] Locking groups:', lockingGroups);
    console.log('[useChartData] Locking groups length:', lockingGroups.length);
    
    const lockingValue = lockingGroups.reduce((total, group) => {
      console.log('[useChartData] Processing locking group:', group);
      const groupValue = group.positions.reduce(
        (sum: number, pos: any) => {
          console.log('[useChartData] Processing locking position:', pos);
          const tokensValue = pos.tokens?.reduce(
            (tokenSum: number, token: any) => {
              // Locking tokens have totalPrice inside financials (like liquidity tokens)
              const price = parseFloat(token.financials?.totalPrice || token.totalPrice) || 0;
              console.log('[useChartData] Token price:', token.symbol, price);
              return tokenSum + price;
            },
            0
          ) || 0;
          console.log('[useChartData] Position tokens value:', tokensValue);
          return sum + tokensValue;
        },
        0
      );
      console.log('[useChartData] Group value:', groupValue);
      return total + groupValue;
    }, 0);
    
    console.log('[useChartData] Locking value:', lockingValue);

    const totalValue = walletValue + liquidityValue + lendingValue + stakingValue + lockingValue;

    console.log('[useChartData] Portfolio composition values:', {
      wallet: walletValue,
      liquidity: liquidityValue,
      lending: lendingValue,
      staking: stakingValue,
      locking: lockingValue,
      total: totalValue
    });

    return {
      walletValue,
      liquidityValue,
      lendingValue,
      stakingValue,
      lockingValue,
      totalValue,
      composition: [
        { name: WalletItemTypeLabels[WalletItemType.WALLET], value: walletValue, color: WalletItemTypeColors[WalletItemType.WALLET], category: 'wallet' },
        { name: WalletItemTypeLabels[WalletItemType.LIQUIDITY_POOL], value: liquidityValue, color: WalletItemTypeColors[WalletItemType.LIQUIDITY_POOL], category: 'liquidity' },
        { name: WalletItemTypeLabels[WalletItemType.LENDING_AND_BORROWING], value: lendingValue, color: WalletItemTypeColors[WalletItemType.LENDING_AND_BORROWING], category: 'lending' },
        { name: WalletItemTypeLabels[WalletItemType.LOCKING], value: lockingValue, color: WalletItemTypeColors[WalletItemType.LOCKING], category: 'locking' },
        { name: WalletItemTypeLabels[WalletItemType.STAKING], value: stakingValue, color: WalletItemTypeColors[WalletItemType.STAKING], category: 'staking' },
      ].filter(item => item.value > 0)
    };
  }, [walletTokens, liquidityData, lendingData, stakingData, lockingData, groupDefiByProtocol, filterLendingDefiTokens, showLendingDefiTokens]);

  // Get top tokens aggregated
  const topTokens = useMemo(() => {
    const tokenMap = new Map<string, { symbol: string; name: string; value: number; logo?: string }>();

    // Add wallet tokens
    walletTokens.forEach((tokenData) => {
      const token = tokenData.token || tokenData;
      const symbol = token.symbol;
      const value = parseFloat(token.totalPrice) || 0;

      if (tokenMap.has(symbol)) {
        tokenMap.get(symbol)!.value += value;
      } else {
        tokenMap.set(symbol, {
          symbol: token.symbol,
          name: token.name,
          value: value,
          logo: token.logo,
        });
      }
    });

    // Add liquidity tokens
    groupDefiByProtocol(liquidityData).forEach((group) => {
      group.positions.forEach((pos: any) => {
        if (pos.tokens && Array.isArray(pos.tokens)) {
          pos.tokens.forEach((token: any) => {
            const symbol = token.symbol;
            // Liquidity tokens have totalPrice inside financials
            const value = parseFloat(token.financials?.totalPrice || token.totalPrice) || 0;
            
            if (tokenMap.has(symbol)) {
              tokenMap.get(symbol)!.value += value;
            } else {
              tokenMap.set(symbol, {
                symbol: token.symbol,
                name: token.name,
                value: value,
                logo: token.logo,
              });
            }
          });
        }
      });
    });

    // Add lending tokens
    groupDefiByProtocol(lendingData).forEach((group) => {
      group.positions.forEach((pos: any) => {
        const tokens = Array.isArray(pos.tokens)
          ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens)
          : [];
        tokens.forEach((token: any) => {
          const symbol = token.symbol;
          const signedValue = signedTokenValue(token, pos);

          if (tokenMap.has(symbol)) {
            tokenMap.get(symbol)!.value += signedValue;
          } else {
            tokenMap.set(symbol, {
              symbol: token.symbol,
              name: token.name,
              value: signedValue,
              logo: token.logo,
            });
          }
        });
      });
    });

    // Add locking tokens
    groupDefiByProtocol(lockingData).forEach((group) => {
      group.positions.forEach((pos: any) => {
        if (pos.tokens && Array.isArray(pos.tokens)) {
          pos.tokens.forEach((token: any) => {
            const symbol = token.symbol;
            // Locking tokens have totalPrice inside financials
            const value = parseFloat(token.financials?.totalPrice || token.totalPrice) || 0;
            
            if (tokenMap.has(symbol)) {
              tokenMap.get(symbol)!.value += value;
            } else {
              tokenMap.set(symbol, {
                symbol: token.symbol,
                name: token.name,
                value: value,
                logo: token.logo,
              });
            }
          });
        }
      });
    });

    return Array.from(tokenMap.values())
      .filter((token) => token.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [walletTokens, liquidityData, lendingData, lockingData, groupDefiByProtocol, filterLendingDefiTokens, showLendingDefiTokens]);

  // Get protocol distribution
  const protocolDistribution = useMemo(() => {
    const protocolMap = new Map();
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'];

    // Helper to normalize protocol name (remove chain suffix)
    const normalizeProtocolName = (name: string): string => {
      // Remove chain suffix like " (Base)", " (Ethereum)", etc.
      return name.replace(/\s*\([^)]+\)\s*$/i, '').trim();
    };

    // Process liquidity data
    groupDefiByProtocol(liquidityData).forEach((group) => {
      let protocolValue = 0;

      group.positions.forEach((pos: any) => {
        if (pos.tokens && Array.isArray(pos.tokens)) {
          pos.tokens.forEach((token: any) => {
            // Liquidity tokens have totalPrice inside financials
            protocolValue += parseFloat(token.financials?.totalPrice || token.totalPrice) || 0;
          });
        } else if (pos.balance) {
          protocolValue += parseFloat(pos.balance) || 0;
        }
      });

      const normalizedName = normalizeProtocolName(group.protocol.name);
      
      if (protocolValue > 0) {
        if (protocolMap.has(normalizedName)) {
          protocolMap.get(normalizedName).value += protocolValue;
          protocolMap.get(normalizedName).positionsCount += group.positions.length;
        } else {
          protocolMap.set(normalizedName, {
            name: normalizedName,
            value: protocolValue,
            logo: group.protocol.logoURI || group.protocol.logo,
            color: colors[protocolMap.size % colors.length],
            positionsCount: group.positions.length
          });
        }
      }
    });

    // Process lending data
    groupDefiByProtocol(lendingData).forEach((group) => {
      let protocolValue = 0;

      group.positions.forEach((pos: any) => {
        if (pos.tokens && Array.isArray(pos.tokens)) {
          const tokens = filterLendingDefiTokens
            ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens)
            : pos.tokens;
          tokens.forEach((token: any) => {
            // Use signed value - borrows will be negative and reduce total
            protocolValue += signedTokenValue(token, pos);
          });
        }
      });

      const normalizedName = normalizeProtocolName(group.protocol.name);

      if (protocolMap.has(normalizedName)) {
        protocolMap.get(normalizedName).value += protocolValue;
        protocolMap.get(normalizedName).positionsCount += group.positions.length;
      } else if (protocolValue > 0) {
        protocolMap.set(normalizedName, {
          name: normalizedName,
          value: protocolValue,
          logo: group.protocol.logoURI || group.protocol.logo,
          color: colors[protocolMap.size % colors.length],
          positionsCount: group.positions.length
        });
      }
    });

    // Process staking data
    stakingData.forEach((position) => {
      const protocolName = normalizeProtocolName(position.protocol?.name || 'Staking');
      const value = parseFloat(position.balance) || 0;

      if (protocolMap.has(protocolName)) {
        protocolMap.get(protocolName).value += value;
        protocolMap.get(protocolName).positionsCount += 1;
      } else if (value > 0) {
        protocolMap.set(protocolName, {
          name: protocolName,
          value: value,
          logo: position.protocol?.logoURI || position.protocol?.logo,
          color: colors[protocolMap.size % colors.length],
          positionsCount: 1
        });
      }
    });

    // Process locking data
    groupDefiByProtocol(lockingData).forEach((group) => {
      let protocolValue = 0;

      group.positions.forEach((pos: any) => {
        if (pos.tokens && Array.isArray(pos.tokens)) {
          pos.tokens.forEach((token: any) => {
            // Locking tokens have totalPrice inside financials
            protocolValue += parseFloat(token.financials?.totalPrice || token.totalPrice) || 0;
          });
        }
      });

      const normalizedName = normalizeProtocolName(group.protocol.name);
      
      if (protocolValue > 0) {
        if (protocolMap.has(normalizedName)) {
          protocolMap.get(normalizedName).value += protocolValue;
          protocolMap.get(normalizedName).positionsCount += group.positions.length;
        } else {
          protocolMap.set(normalizedName, {
            name: normalizedName,
            value: protocolValue,
            logo: group.protocol.logoURI || group.protocol.logo,
            color: colors[protocolMap.size % colors.length],
            positionsCount: group.positions.length
          });
        }
      }
    });

    return Array.from(protocolMap.values())
      .filter((protocol: any) => protocol.value > 0)
      .sort((a: any, b: any) => b.value - a.value);
  }, [liquidityData, lendingData, stakingData, lockingData, groupDefiByProtocol, filterLendingDefiTokens, showLendingDefiTokens]);

  // Get chain distribution
  const chainDistribution = useMemo(() => {
    const chainMap = new Map();
    const colors = ['#627eea', '#8247e5', '#28a0f0', '#ff0420', '#0052ff', '#f3ba2f'];

    const allItems = [
      ...walletTokens.map(t => ({ chain: t.token?.chain || t.chain, value: parseFloat(t.token?.totalPrice || t.totalPrice) || 0 })),
      ...liquidityData.map(l => ({ chain: l.protocol?.chain, value: 0 })),
      ...lendingData.map(l => ({ chain: l.protocol?.chain, value: 0 })),
      ...stakingData.map(s => ({ chain: s.protocol?.chain, value: parseFloat(s.balance) || 0 })),
      ...lockingData.map(l => ({ chain: l.protocol?.chain, value: 0 }))
    ];

    // Calculate values per chain
    liquidityData.forEach(item => {
      const chain = item.protocol?.chain || item.position?.protocol?.chain || 'Unknown';
      const pos = item.position || item;
      const tokens = pos.tokens || [];
      // Liquidity tokens have totalPrice inside financials
      const value = tokens.reduce((sum: number, t: any) => sum + (parseFloat(t.financials?.totalPrice || t.totalPrice) || 0), 0);
      
      if (chainMap.has(chain)) {
        chainMap.get(chain).value += value;
      } else {
        chainMap.set(chain, { chain, value, color: colors[chainMap.size % colors.length] });
      }
    });

    lendingData.forEach(item => {
      const chain = item.protocol?.chain || item.position?.protocol?.chain || 'Unknown';
      const pos = item.position || item;
      const tokens = Array.isArray(pos.tokens) 
        ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens)
        : [];
      // Use signed value - borrow will be negative
      const value = tokens.reduce((sum: number, t: any) => sum + signedTokenValue(t, item), 0);
      
      if (chainMap.has(chain)) {
        chainMap.get(chain).value += value;
      } else {
        chainMap.set(chain, { chain, value, color: colors[chainMap.size % colors.length] });
      }
    });

    walletTokens.forEach(tokenData => {
      const token = tokenData.token || tokenData;
      const chain = token.chain || 'Unknown';
      const value = parseFloat(token.totalPrice) || 0;
      
      if (chainMap.has(chain)) {
        chainMap.get(chain).value += value;
      } else {
        chainMap.set(chain, { chain, value, color: colors[chainMap.size % colors.length] });
      }
    });

    lockingData.forEach(item => {
      const chain = item.protocol?.chain || item.position?.protocol?.chain || 'Unknown';
      const pos = item.position || item;
      const tokens = pos.tokens || [];
      // Locking tokens have totalPrice inside financials
      const value = tokens.reduce((sum: number, t: any) => sum + (parseFloat(t.financials?.totalPrice || t.totalPrice) || 0), 0);
      
      if (chainMap.has(chain)) {
        chainMap.get(chain).value += value;
      } else {
        chainMap.set(chain, { chain, value, color: colors[chainMap.size % colors.length] });
      }
    });

    return Array.from(chainMap.values())
      .filter((c: any) => c.value > 0)
      .sort((a: any, b: any) => b.value - a.value);
  }, [walletTokens, liquidityData, lendingData, stakingData, lockingData, filterLendingDefiTokens, showLendingDefiTokens]);

  // Get lending positions breakdown
  const lendingPositions = useMemo(() => {
    const positions: any[] = [];

    groupDefiByProtocol(lendingData).forEach(group => {
      let totalSupplied = 0;
      let totalBorrowed = 0;

      group.positions.forEach((pos: any) => {
        const tokens = Array.isArray(pos.tokens)
          ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens)
          : [];
        
        tokens.forEach((token: any) => {
          const value = signedTokenValue(token, pos);
          if (value > 0) {
            totalSupplied += value;
          } else {
            totalBorrowed += Math.abs(value);
          }
        });
      });

      if (totalSupplied > 0 || totalBorrowed > 0) {
        positions.push({
          protocol: group.protocol.name,
          supplied: totalSupplied,
          borrowed: totalBorrowed,
          net: totalSupplied - totalBorrowed,
          logo: group.protocol.logoURI || group.protocol.logo
        });
      }
    });

    return positions.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [lendingData, groupDefiByProtocol, filterLendingDefiTokens, showLendingDefiTokens]);

  // Get projection data separated by category (lending and liquidity)
  const projectionData = useMemo(() => {
    // Process lending projections by type
    const lendingByType = new Map();
    lendingData.forEach(item => {
      const position = item.position || item;
      const additionalData = item.additionalData || position?.additionalData || {};
      const additionalInfo = item.additionalInfo || position?.additionalInfo || {};
      const projections = additionalData.projections || additionalInfo.projections || position?.projections || [];
      
      // Get the principal value for this position (use signed value)
      const tokens = Array.isArray(position.tokens) 
        ? filterLendingDefiTokens(position.tokens, showLendingDefiTokens)
        : [];
      const principalValue = tokens.reduce((sum: number, t: any) => sum + signedTokenValue(t, item), 0);
      
      projections.forEach((proj: any) => {
        const type = proj.type?.toLowerCase() || 'apy';
        const projection = proj.projection || {};
        
        // Get rate from backend (APY/APR percentage)
        const rate = proj.metadata?.rate || position.apy || position.supplyRate || additionalData.apy || 0;
        
        if (!lendingByType.has(type)) {
          lendingByType.set(type, {
            type,
            oneDay: 0,
            oneWeek: 0,
            oneMonth: 0,
            oneYear: 0,
            totalRateWeighted: 0,
            totalWeight: 0
          });
        }
        
        const existing = lendingByType.get(type);
        existing.oneDay += parseFloat(projection.oneDay) || 0;
        existing.oneWeek += parseFloat(projection.oneWeek) || 0;
        existing.oneMonth += parseFloat(projection.oneMonth) || 0;
        existing.oneYear += parseFloat(projection.oneYear) || 0;
        
        // Weighted average by principal value
        if (rate != null && !isNaN(rate) && principalValue !== 0) {
          existing.totalRateWeighted += rate * Math.abs(principalValue);
          existing.totalWeight += Math.abs(principalValue);
        }
      });
    });

    // Calculate weighted average rate for lending
    lendingByType.forEach((value) => {
      if (value.totalWeight > 0) {
        value.rate = value.totalRateWeighted / value.totalWeight;
      } else {
        value.rate = 0;
      }
      delete value.totalRateWeighted;
      delete value.totalWeight;
    });

    // Process liquidity projections by type
    const liquidityByType = new Map();
    liquidityData.forEach(item => {
      const pos = item.position || item;
      const additionalData = pos.additionalData || item.additionalData || {};
      const additionalInfo = pos.additionalInfo || item.additionalInfo || {};
      const projections = additionalData.projections || additionalInfo.projections || pos.projections || [];
      
      // Get the principal value for this position
      let principalValue = 0;
      const tokens = Array.isArray(pos.tokens) ? pos.tokens : [];
      tokens.forEach((token: any) => {
        const tokenValue = parseFloat(
          token.totalPrice || 
          token.financials?.totalPrice || 
          token.balanceUSD ||
          0
        );
        const tokenType = (token.type || '').toLowerCase();
        
        // Only liquidity tokens, not fees
        if (tokenType.includes('supplied') || 
            tokenType.includes('supply') || 
            tokenType.includes('liquidity') ||
            tokenType.includes('deposit') ||
            !tokenType ||
            tokenType === '') {
          principalValue += tokenValue;
        }
      });
      
      projections.forEach((proj: any) => {
        const rawType = proj.type?.toLowerCase() || 'apr';
        const type = rawType === 'aprhistorical' ? 'aprHistorical' : rawType;
        const projection = proj.projection || {};
        
        // Get rate from backend (APR/APR Historical percentage)
        let rate = 0;
        if (type === 'apr') {
          rate = proj.metadata?.rate || additionalData.apr || pos.apr || additionalInfo.apr || 0;
        } else if (type === 'aprHistorical') {
          rate = proj.metadata?.rate || additionalData.aprHistorical || pos.aprHistorical || additionalInfo.aprHistorical || 0;
        } else {
          rate = proj.metadata?.rate || 0;
        }
        
        if (!liquidityByType.has(type)) {
          liquidityByType.set(type, {
            type: rawType, // Keep original type name
            oneDay: 0,
            oneWeek: 0,
            oneMonth: 0,
            oneYear: 0,
            totalRateWeighted: 0,
            totalWeight: 0
          });
        }
        
        const existing = liquidityByType.get(type);
        existing.oneDay += parseFloat(projection.oneDay) || 0;
        existing.oneWeek += parseFloat(projection.oneWeek) || 0;
        existing.oneMonth += parseFloat(projection.oneMonth) || 0;
        existing.oneYear += parseFloat(projection.oneYear) || 0;
        
        // Weighted average by principal value
        if (rate != null && !isNaN(rate) && principalValue > 0) {
          existing.totalRateWeighted += rate * principalValue;
          existing.totalWeight += principalValue;
        }
      });
    });

    // Calculate weighted average rate for liquidity
    liquidityByType.forEach((value) => {
      if (value.totalWeight > 0) {
        value.rate = value.totalRateWeighted / value.totalWeight;
      } else {
        value.rate = 0;
      }
      delete value.totalRateWeighted;
      delete value.totalWeight;
    });

    return {
      lending: Array.from(lendingByType.values()),
      liquidity: Array.from(liquidityByType.values())
    };
  }, [lendingData, liquidityData]);

  return {
    portfolioData,
    topTokens,
    protocolDistribution,
    chainDistribution,
    lendingPositions,
    projectionData
  };
};
