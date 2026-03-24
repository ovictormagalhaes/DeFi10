// src/components/charts/hooks/useChartData.ts
import { useMemo } from 'react';
import { WalletItemType, WalletItemTypeLabels, WalletItemTypeColors } from '../../../constants/walletItemTypes';
import type { WalletItemLike, ProtocolGroup, TokenLike } from '../../../utils/walletUtils';

interface UseChartDataParams {
  walletTokens: WalletItemLike[];
  liquidityData: WalletItemLike[];
  lendingData: WalletItemLike[];
  stakingData: WalletItemLike[];
  lockingData: WalletItemLike[];
  groupDefiByProtocol: (data: WalletItemLike[]) => ProtocolGroup[];
  filterLendingDefiTokens: (tokens: TokenLike[], show: boolean) => TokenLike[];
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
  const signedTokenValue = (t: TokenLike, pos?: Record<string, unknown>): number => {
    const ty = (String(t.type || '')).toLowerCase();
    const price = t.financials?.totalPrice ?? t.totalPrice;
    const val = Math.abs(parseFloat(String(price)) || 0);
    if (ty === 'borrowed' || ty === 'borrow' || ty === 'debt') return -val;
    if (!ty && pos) {
      const posObj = pos as Record<string, unknown>;
      const innerPos = posObj.position as Record<string, unknown> | undefined;
      const lbl = (String(innerPos?.label || posObj.label || '')).toLowerCase();
      if (lbl.includes('borrow') || lbl.includes('debt')) return -val;
    }
    return val;
  };

  // Calculate portfolio values
  const portfolioData = useMemo(() => {
    const walletValue = walletTokens.reduce((sum: number, tokenData) => {
      const token = tokenData.token || tokenData;
      const price = (token as Record<string, unknown>).totalPrice ?? (token as Record<string, unknown>).financials;
      return sum + (parseFloat(String((token as TokenLike).financials?.totalPrice ?? (token as TokenLike).totalPrice)) || 0);
    }, 0);

    const liquidityValue = groupDefiByProtocol(liquidityData).reduce(
      (total: number, group) => {
        return total +
        group.positions.reduce(
          (sum: number, pos) =>
            sum +
            (pos.tokens?.reduce(
              (tokenSum: number, token) => {
                const price = parseFloat(String(token.financials?.totalPrice ?? token.totalPrice)) || 0;
                return tokenSum + price;
              },
              0
            ) || 0),
          0
        );
      },
      0
    );

    const lendingValue = groupDefiByProtocol(lendingData).reduce((grand: number, group) => {
      const groupSum = group.positions.reduce((sum: number, pos) => {
        const tokens = Array.isArray(pos.tokens)
          ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens)
          : [];
        const net = tokens.reduce((s: number, t) => s + signedTokenValue(t, pos as Record<string, unknown>), 0);
        return sum + net;
      }, 0);
      return grand + groupSum;
    }, 0);

    const stakingValue = stakingData.reduce((total: number, position) => {
      const balance = parseFloat(String(position.additionalData?.balance ?? (position as Record<string, unknown>).balance)) || 0;
      return total + (isNaN(balance) ? 0 : balance);
    }, 0);

    const lockingGroups = groupDefiByProtocol(lockingData);

    const lockingValue = lockingGroups.reduce((total: number, group) => {
      const groupValue = group.positions.reduce(
        (sum: number, pos) => {
          const tokensValue = pos.tokens?.reduce(
            (tokenSum: number, token) => {
              const price = parseFloat(String(token.financials?.totalPrice ?? token.totalPrice)) || 0;
              return tokenSum + price;
            },
            0
          ) || 0;
          return sum + tokensValue;
        },
        0
      );
      return total + groupValue;
    }, 0);

    const totalValue = walletValue + liquidityValue + lendingValue + stakingValue + lockingValue;

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

    const addToken = (symbol: string, name: string, value: number, logo?: string) => {
      if (tokenMap.has(symbol)) {
        tokenMap.get(symbol)!.value += value;
      } else {
        tokenMap.set(symbol, { symbol, name, value, logo });
      }
    };

    // Add wallet tokens
    walletTokens.forEach((tokenData) => {
      const token = (tokenData.token || tokenData) as TokenLike;
      const symbol = token.symbol || '';
      const value = parseFloat(String(token.financials?.totalPrice ?? token.totalPrice)) || 0;
      addToken(symbol, token.name || '', value, token[('logo' as string)] as string | undefined);
    });

    // Add liquidity tokens
    groupDefiByProtocol(liquidityData).forEach((group) => {
      group.positions.forEach((pos) => {
        if (pos.tokens && Array.isArray(pos.tokens)) {
          pos.tokens.forEach((token) => {
            const symbol = token.symbol || '';
            const value = parseFloat(String(token.financials?.totalPrice ?? token.totalPrice)) || 0;
            addToken(symbol, token.name || '', value, token[('logo' as string)] as string | undefined);
          });
        }
      });
    });

    // Add lending tokens
    groupDefiByProtocol(lendingData).forEach((group) => {
      group.positions.forEach((pos) => {
        const tokens = Array.isArray(pos.tokens)
          ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens)
          : [];
        tokens.forEach((token) => {
          const symbol = token.symbol || '';
          const signedValue = signedTokenValue(token, pos as Record<string, unknown>);
          addToken(symbol, token.name || '', signedValue, token[('logo' as string)] as string | undefined);
        });
      });
    });

    // Add locking tokens
    groupDefiByProtocol(lockingData).forEach((group) => {
      group.positions.forEach((pos) => {
        if (pos.tokens && Array.isArray(pos.tokens)) {
          pos.tokens.forEach((token) => {
            const symbol = token.symbol || '';
            const value = parseFloat(String(token.financials?.totalPrice ?? token.totalPrice)) || 0;
            addToken(symbol, token.name || '', value, token[('logo' as string)] as string | undefined);
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
    const protocolMap = new Map<string, { name: string; value: number; logo?: string; color: string; positionsCount: number }>();
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'];

    const normalizeProtocolName = (name: string): string => {
      return name.replace(/\s*\([^)]+\)\s*$/i, '').trim();
    };

    // Process liquidity data
    groupDefiByProtocol(liquidityData).forEach((group) => {
      let protocolValue = 0;

      group.positions.forEach((pos) => {
        if (pos.tokens && Array.isArray(pos.tokens)) {
          pos.tokens.forEach((token) => {
            protocolValue += parseFloat(String(token.financials?.totalPrice ?? token.totalPrice)) || 0;
          });
        } else if ((pos as Record<string, unknown>).balance) {
          protocolValue += parseFloat(String((pos as Record<string, unknown>).balance)) || 0;
        }
      });

      const normalizedName = normalizeProtocolName(group.protocol.name || '');

      if (protocolValue > 0) {
        if (protocolMap.has(normalizedName)) {
          const existing = protocolMap.get(normalizedName)!;
          existing.value += protocolValue;
          existing.positionsCount += group.positions.length;
        } else {
          protocolMap.set(normalizedName, {
            name: normalizedName,
            value: protocolValue,
            logo: (group.protocol as Record<string, unknown>).logoURI as string || (group.protocol as Record<string, unknown>).logo as string,
            color: colors[protocolMap.size % colors.length],
            positionsCount: group.positions.length
          });
        }
      }
    });

    // Process lending data
    groupDefiByProtocol(lendingData).forEach((group) => {
      let protocolValue = 0;

      group.positions.forEach((pos) => {
        if (pos.tokens && Array.isArray(pos.tokens)) {
          const tokens = filterLendingDefiTokens
            ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens)
            : pos.tokens;
          tokens.forEach((token) => {
            protocolValue += signedTokenValue(token, pos as Record<string, unknown>);
          });
        }
      });

      const normalizedName = normalizeProtocolName(group.protocol.name || '');

      if (protocolMap.has(normalizedName)) {
        const existing = protocolMap.get(normalizedName)!;
        existing.value += protocolValue;
        existing.positionsCount += group.positions.length;
      } else if (protocolValue > 0) {
        protocolMap.set(normalizedName, {
          name: normalizedName,
          value: protocolValue,
          logo: (group.protocol as Record<string, unknown>).logoURI as string || (group.protocol as Record<string, unknown>).logo as string,
          color: colors[protocolMap.size % colors.length],
          positionsCount: group.positions.length
        });
      }
    });

    // Process staking data
    stakingData.forEach((position) => {
      const protocolName = normalizeProtocolName(position.protocol?.name || 'Staking');
      const value = parseFloat(String((position as Record<string, unknown>).balance)) || 0;

      if (protocolMap.has(protocolName)) {
        const existing = protocolMap.get(protocolName)!;
        existing.value += value;
        existing.positionsCount += 1;
      } else if (value > 0) {
        protocolMap.set(protocolName, {
          name: protocolName,
          value: value,
          logo: (position.protocol as Record<string, unknown>)?.logoURI as string || (position.protocol as Record<string, unknown>)?.logo as string,
          color: colors[protocolMap.size % colors.length],
          positionsCount: 1
        });
      }
    });

    // Process locking data
    groupDefiByProtocol(lockingData).forEach((group) => {
      let protocolValue = 0;

      group.positions.forEach((pos) => {
        if (pos.tokens && Array.isArray(pos.tokens)) {
          pos.tokens.forEach((token) => {
            protocolValue += parseFloat(String(token.financials?.totalPrice ?? token.totalPrice)) || 0;
          });
        }
      });

      const normalizedName = normalizeProtocolName(group.protocol.name || '');

      if (protocolValue > 0) {
        if (protocolMap.has(normalizedName)) {
          const existing = protocolMap.get(normalizedName)!;
          existing.value += protocolValue;
          existing.positionsCount += group.positions.length;
        } else {
          protocolMap.set(normalizedName, {
            name: normalizedName,
            value: protocolValue,
            logo: (group.protocol as Record<string, unknown>).logoURI as string || (group.protocol as Record<string, unknown>).logo as string,
            color: colors[protocolMap.size % colors.length],
            positionsCount: group.positions.length
          });
        }
      }
    });

    return Array.from(protocolMap.values())
      .filter((protocol) => protocol.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [liquidityData, lendingData, stakingData, lockingData, groupDefiByProtocol, filterLendingDefiTokens, showLendingDefiTokens]);

  // Get chain distribution
  const chainDistribution = useMemo(() => {
    const chainMap = new Map<string, { chain: string; value: number; color: string }>();
    const colors = ['#627eea', '#8247e5', '#28a0f0', '#ff0420', '#0052ff', '#f3ba2f'];

    const addToChain = (chain: string, value: number) => {
      if (chainMap.has(chain)) {
        chainMap.get(chain)!.value += value;
      } else {
        chainMap.set(chain, { chain, value, color: colors[chainMap.size % colors.length] });
      }
    };

    // Calculate values per chain
    liquidityData.forEach(item => {
      const chain = item.protocol?.chain || item.position?.position?.chain as string || 'Unknown';
      const pos = item.position || item;
      const tokens = (pos as Record<string, unknown>).tokens as TokenLike[] || [];
      const value = (Array.isArray(tokens) ? tokens : []).reduce((sum: number, t: TokenLike) => sum + (parseFloat(String(t.financials?.totalPrice ?? t.totalPrice)) || 0), 0);
      addToChain(chain as string, value);
    });

    lendingData.forEach(item => {
      const chain = item.protocol?.chain || item.position?.position?.chain as string || 'Unknown';
      const pos = item.position || item;
      const tokens = Array.isArray((pos as Record<string, unknown>).tokens)
        ? filterLendingDefiTokens((pos as Record<string, unknown>).tokens as TokenLike[], showLendingDefiTokens)
        : [];
      const value = tokens.reduce((sum: number, t) => sum + signedTokenValue(t, item as Record<string, unknown>), 0);
      addToChain(chain as string, value);
    });

    walletTokens.forEach(tokenData => {
      const token = (tokenData.token || tokenData) as TokenLike;
      const chain = (token as Record<string, unknown>).chain as string || 'Unknown';
      const value = parseFloat(String(token.financials?.totalPrice ?? token.totalPrice)) || 0;
      addToChain(chain, value);
    });

    lockingData.forEach(item => {
      const chain = item.protocol?.chain || item.position?.position?.chain as string || 'Unknown';
      const pos = item.position || item;
      const tokens = (pos as Record<string, unknown>).tokens as TokenLike[] || [];
      const value = (Array.isArray(tokens) ? tokens : []).reduce((sum: number, t: TokenLike) => sum + (parseFloat(String(t.financials?.totalPrice ?? t.totalPrice)) || 0), 0);
      addToChain(chain as string, value);
    });

    return Array.from(chainMap.values())
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [walletTokens, liquidityData, lendingData, stakingData, lockingData, filterLendingDefiTokens, showLendingDefiTokens]);

  // Get lending positions breakdown
  const lendingPositions = useMemo(() => {
    const positions: { protocol: string; supplied: number; borrowed: number; net: number; logo?: string }[] = [];

    groupDefiByProtocol(lendingData).forEach(group => {
      let totalSupplied = 0;
      let totalBorrowed = 0;

      group.positions.forEach((pos) => {
        const tokens = Array.isArray(pos.tokens)
          ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens)
          : [];

        tokens.forEach((token) => {
          const value = signedTokenValue(token, pos as Record<string, unknown>);
          if (value > 0) {
            totalSupplied += value;
          } else {
            totalBorrowed += Math.abs(value);
          }
        });
      });

      if (totalSupplied > 0 || totalBorrowed > 0) {
        positions.push({
          protocol: group.protocol.name || '',
          supplied: totalSupplied,
          borrowed: totalBorrowed,
          net: totalSupplied - totalBorrowed,
          logo: (group.protocol as Record<string, unknown>).logoURI as string || (group.protocol as Record<string, unknown>).logo as string
        });
      }
    });

    return positions.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [lendingData, groupDefiByProtocol, filterLendingDefiTokens, showLendingDefiTokens]);

  // Get projection data separated by category (lending and liquidity)
  const projectionData = useMemo(() => {
    // Process lending projections by type
    const lendingByType = new Map<string, Record<string, unknown>>();
    lendingData.forEach(item => {
      const position = item.position || item;
      const posRecord = position as Record<string, unknown>;
      const additionalData = (item.additionalData || posRecord.additionalData || {}) as Record<string, unknown>;
      const additionalInfo = ((item as Record<string, unknown>).additionalInfo || posRecord.additionalInfo || {}) as Record<string, unknown>;
      const projections = (additionalData.projections || additionalInfo.projections || posRecord.projections || []) as Array<Record<string, unknown>>;

      const tokens = Array.isArray(posRecord.tokens)
        ? filterLendingDefiTokens(posRecord.tokens as TokenLike[], showLendingDefiTokens)
        : [];
      const principalValue = tokens.reduce((sum: number, t) => sum + signedTokenValue(t, item as Record<string, unknown>), 0);

      projections.forEach((proj) => {
        const type = (String(proj.type || 'apy')).toLowerCase();
        const projection = (proj.projection || {}) as Record<string, unknown>;

        const rate = (proj.metadata as Record<string, unknown>)?.value as number || posRecord.apy as number || posRecord.supplyRate as number || 0;

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

        const existing = lendingByType.get(type)!;
        existing.oneDay = (existing.oneDay as number) + (parseFloat(String(projection.oneDay)) || 0);
        existing.oneWeek = (existing.oneWeek as number) + (parseFloat(String(projection.oneWeek)) || 0);
        existing.oneMonth = (existing.oneMonth as number) + (parseFloat(String(projection.oneMonth)) || 0);
        existing.oneYear = (existing.oneYear as number) + (parseFloat(String(projection.oneYear)) || 0);

        if (rate != null && !isNaN(rate) && principalValue !== 0) {
          existing.totalRateWeighted = (existing.totalRateWeighted as number) + rate * Math.abs(principalValue);
          existing.totalWeight = (existing.totalWeight as number) + Math.abs(principalValue);
        }
      });
    });

    lendingByType.forEach((value) => {
      if ((value.totalWeight as number) > 0) {
        value.rate = (value.totalRateWeighted as number) / (value.totalWeight as number);
      } else {
        value.rate = 0;
      }
      delete value.totalRateWeighted;
      delete value.totalWeight;
    });

    // Process liquidity projections by type
    const liquidityByType = new Map<string, Record<string, unknown>>();
    liquidityData.forEach(item => {
      const pos = item.position || item;
      const posRecord = pos as Record<string, unknown>;
      const additionalData = (posRecord.additionalData || item.additionalData || {}) as Record<string, unknown>;
      const additionalInfo = (posRecord.additionalInfo || (item as Record<string, unknown>).additionalInfo || {}) as Record<string, unknown>;
      const projections = (additionalData.projections || additionalInfo.projections || posRecord.projections || []) as Array<Record<string, unknown>>;

      let principalValue = 0;
      const tokens = Array.isArray(posRecord.tokens) ? posRecord.tokens as TokenLike[] : [];
      tokens.forEach((token) => {
        const tokenValue = parseFloat(
          String(token.totalPrice ||
          token.financials?.totalPrice ||
          token.balanceFormatted ||
          0)
        );
        const tokenType = (String(token.type || '')).toLowerCase();

        if (tokenType.includes('supplied') ||
            tokenType.includes('supply') ||
            tokenType.includes('liquidity') ||
            tokenType.includes('deposit') ||
            !tokenType ||
            tokenType === '') {
          principalValue += tokenValue;
        }
      });

      projections.forEach((proj) => {
        const rawType = (String(proj.type || 'apr')).toLowerCase();
        const type = rawType === 'aprhistorical' ? 'aprHistorical' : rawType;
        const projection = (proj.projection || {}) as Record<string, unknown>;

        let rate = 0;
        rate = (proj.metadata as Record<string, unknown>)?.value as number || 0;

        if (!liquidityByType.has(type)) {
          liquidityByType.set(type, {
            type: rawType,
            oneDay: 0,
            oneWeek: 0,
            oneMonth: 0,
            oneYear: 0,
            totalRateWeighted: 0,
            totalWeight: 0
          });
        }

        const existing = liquidityByType.get(type)!;
        existing.oneDay = (existing.oneDay as number) + (parseFloat(String(projection.oneDay)) || 0);
        existing.oneWeek = (existing.oneWeek as number) + (parseFloat(String(projection.oneWeek)) || 0);
        existing.oneMonth = (existing.oneMonth as number) + (parseFloat(String(projection.oneMonth)) || 0);
        existing.oneYear = (existing.oneYear as number) + (parseFloat(String(projection.oneYear)) || 0);

        if (rate != null && !isNaN(rate) && principalValue > 0) {
          existing.totalRateWeighted = (existing.totalRateWeighted as number) + rate * principalValue;
          existing.totalWeight = (existing.totalWeight as number) + principalValue;
        }
      });
    });

    liquidityByType.forEach((value) => {
      if ((value.totalWeight as number) > 0) {
        value.rate = (value.totalRateWeighted as number) / (value.totalWeight as number);
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
