/**
 * PoolTables TypeScript Component - Migração completa para TypeScript
 * Tabelas para exibir pools de liquidez com suporte completo a TypeScript
 */

import React, { useState, useMemo, useEffect } from 'react';
import StandardHeader from '../table/StandardHeader';
import TokenDisplay from '../TokenDisplay';
import MiniMetric from '../MiniMetric';
import RangeChip from '../RangeChip';
import { useMaskValues } from '../../context/MaskValuesContext';
import { useTheme } from '../../context/ThemeProvider';
import { 
  formatPrice, 
  formatTokenAmount, 
  calculatePercentage, 
  getTotalPortfolioValue, 
  sum 
} from '../../utils/walletUtils';
import { 
  extractAllRewards, 
  normalizeTokenPrice, 
  calculateTokensValue,
  filterUncollectedFeeTokens
} from '../../utils/tokenFilters';
import type { WalletItem, Token } from '../../types/wallet';
import { extractPoolRange, extractPoolFees24h } from '../../types/wallet';
import { getLiquidityPoolItems } from '../../types/filters';

// Interface CORRETA - APENAS WalletItem[]
interface PoolTablesProps {
  items: WalletItem[]; // SEMPRE usar esta estrutura
  showMetrics?: boolean;
  
  // DEPRECATED - apenas para compatibilidade temporária
  pools?: any[] | Record<string, any> | null;
}

// TODO: Migrar completamente para usar items: WalletItem[] e remover props legacy

interface Pool {
  address?: string;
  poolAddress?: string;
  name?: string;
  tokens?: PoolToken[];
  assets?: PoolToken[];
  position?: {
    tokens?: PoolToken[];
    range?: any;
  };
  totalValueUsd?: number;
  totalValueUSD?: number;
  totalValue?: number;
  tvlUsd?: number;
  tvlUSD?: number;
  tvl?: number;
  liquidityUsd?: number;
  liquidityUSD?: number;
  liquidity?: number;
  rewards?: RewardToken[];
  rewardTokens?: RewardToken[];
  uncollectedFees?: RewardToken[];
  fees?: RewardToken[];
  // Possíveis localizações de range
  range?: any;
  rangeData?: any;
  priceRange?: any;
  additionalData?: {
    range?: any;
    [key: string]: any;
  };
  type?: string;
  [key: string]: any; // Para propriedades dinâmicas
}

interface PoolToken {
  symbol: string;
  totalValueUsd?: number;
  totalValueUSD?: number;
  totalValue?: number;
  totalPrice?: number;
  balance?: number;
  amount?: number;
  address?: string;
  decimals?: number;
  logo?: string;
  chainKey?: string;
  [key: string]: any;
}

interface RewardToken {
  symbol?: string;
  totalValueUsd?: number;
  totalValueUSD?: number;
  totalValue?: number;
  valueUsd?: number;
  totalPrice?: number;
  financials?: {
    totalPrice?: number;
    totalValue?: number;
    price?: number;
  };
  [key: string]: any;
}

interface AggregatedPool extends Pool {
  value: number;
  rewards: RewardToken[];
}

interface PoolRange {
  min?: number;
  max?: number;
  current?: number;
  inRange?: boolean;
  [key: string]: any;
}

// Função para derivar chave única do pool
function derivePoolKey(pool: Pool | null, index: number): string {
  if (!pool) return `pool-${index}`;
  const addr = (pool.address || pool.poolAddress || '').toLowerCase();
  if (addr) return addr;
  const name = (pool.name || '').toLowerCase();
  if (name) return `${name}-${index}`;
  return `pool-${index}`;
}

// Função para extrair range de diferentes estruturas de pool
function extractRangeFromPool(pool: Pool): PoolRange | null {
  if (!pool) return null;

  // Tenta várias localizações possíveis para range data
  const rangeData = 
    pool.additionalData?.range ||
    pool.range ||
    pool.position?.range ||
    pool.rangeData ||
    pool.priceRange ||
    null;

  if (!rangeData) return null;

  // Valida e converte os dados de range
  const lower = parseFloat(String(rangeData.lower || rangeData.min || rangeData.tickLower || ''));
  const upper = parseFloat(String(rangeData.upper || rangeData.max || rangeData.tickUpper || ''));
  const current = parseFloat(String(rangeData.current || rangeData.currentPrice || rangeData.price || ''));

  if (isFinite(lower) && isFinite(upper) && isFinite(current)) {
    return {
      min: lower,
      max: upper,
      current,
      inRange: rangeData.inRange ?? (current >= lower && current <= upper),
      lower,
      upper
    };
  }

  return null;
}

// Função para agregar pools com rewards
function aggregatePools(pools: Pool[] = []): AggregatedPool[] {
  return pools.map((p) => {
    const tokens = p.tokens || p.assets || p.position?.tokens || [];
    
    const rawValue =
      p.totalValueUsd ?? p.totalValueUSD ?? p.totalValue ?? 
      p.tvlUsd ?? p.tvlUSD ?? p.tvl ?? 
      p.liquidityUsd ?? p.liquidityUSD ?? p.liquidity ?? 0;
    const valueNum = parseFloat(String(rawValue)) || 0;
    
    // Extract all rewards using the unified utility
    const allRewards = extractAllRewards(p);
    
    // Normalize all reward tokens to have consistent totalPrice field
    const normalizedRewards = allRewards.map(normalizeTokenPrice);
    
    // Deduplicate by symbol+rounded totalPrice to avoid double counting
    const seen = new Set<string>();
    const deduplicatedRewards = normalizedRewards.filter((item: any) => {
      const keySig = `${(item.symbol || '').toLowerCase()}|${Math.round((item.totalPrice || 0) * 1e6)}`;
      if (seen.has(keySig)) return false;
      seen.add(keySig);
      return true;
    });

    return { ...p, tokens, value: valueNum, rewards: deduplicatedRewards } as AggregatedPool;
  });
}

const PoolTables: React.FC<PoolTablesProps> = ({ pools = [], showMetrics = true }) => {
  const { maskValue } = useMaskValues();
  const { theme } = useTheme();
  const [openPools, setOpenPools] = useState<Record<string, boolean>>({});

  // Viewport width for responsive column hiding (restored legacy behavior)
  const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const [vw, setVw] = useState(initialWidth);

  useEffect(() => {
    function onResize() { 
      setVw(typeof window !== 'undefined' ? window.innerWidth : initialWidth); 
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onResize);
    }
    return () => { 
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', onResize);
      }
    };
  }, [initialWidth]);

  // Breakpoints aligned to original (legacy) variant you preferred (950 / 800 / 600)
  const hideRange = vw < 600;
  const hideRewards = vw < 800;
  const hideAmount = vw < 950;

  // Normalize input: accept array, object map, or falsy
  const poolsArray = useMemo(() => {
    if (Array.isArray(pools)) return pools;
    if (pools && typeof pools === 'object') return Object.values(pools);
    return [];
  }, [pools]);

  if (!poolsArray || poolsArray.length === 0) return null;

  const aggregated = useMemo(() => aggregatePools(poolsArray), [poolsArray]);
  const totalValue = sum(aggregated.map((p) => p.value));
  const rewardsValue = sum(
    aggregated.flatMap((p) => 
      p.rewards.map((r: any) => 
        r.totalValueUsd || r.totalValueUSD || r.totalValue || r.valueUsd || r.totalPrice || 0
      )
    )
  );
  const positionsCount = aggregated.length;
  const portfolioTotal = getTotalPortfolioValue ? getTotalPortfolioValue() : 0;
  const portfolioPercent = portfolioTotal > 0 ? calculatePercentage(totalValue, portfolioTotal) : '0%';

  function togglePool(key: string) { 
    setOpenPools((prev) => ({ ...prev, [key]: !prev[key] })); 
  }

  const keyList = aggregated.map((p, i) => derivePoolKey(p, i));
  const allOpen = keyList.every((k) => openPools[k]);
  const anyOpen = keyList.some((k) => openPools[k]);
  
  function expandAll() { 
    setOpenPools(keyList.reduce((acc: Record<string, boolean>, k) => { 
      acc[k] = true; 
      return acc; 
    }, {})); 
  }
  
  function collapseAll() { 
    setOpenPools({}); 
  }

  return (
    <div className="pool-tables-wrapper flex-col gap-12">
      {showMetrics && (
        <div className="mini-metrics">
          <MiniMetric 
            label="Positions" 
            value={positionsCount} 
          />
          <MiniMetric 
            label="Portfolio %" 
            value={portfolioPercent}
          />
        </div>
      )}
      
      {aggregated.length > 3 && (
        <div className="expand-controls flex gap-8">
          <button 
            type="button" 
            className="btn btn-sm" 
            disabled={allOpen} 
            onClick={expandAll}
          >
            Expand All
          </button>
          <button 
            type="button" 
            className="btn btn-sm" 
            disabled={!anyOpen} 
            onClick={collapseAll}
          >
            Collapse All
          </button>
        </div>
      )}

      <table className="table-unified text-primary">
        <StandardHeader
          columns={[
            'token',
            !hideRange && 'range',
            !hideAmount && 'amount', 
            !hideRewards && 'uncollected',
            'value'
          ].filter(Boolean) as string[]}
          columnDefs={[
            !hideRange && { key: 'range', label: 'Range', align: 'center' },
            !hideAmount && { key: 'amount', label: 'Amount', align: 'right' },
            !hideRewards && { key: 'uncollected', label: 'Uncollected', align: 'right' },
            { key: 'value', label: 'Value', align: 'right' },
          ].filter(Boolean)}
          labels={{ token: 'Pools' }}
        />
        <tbody>
          {aggregated.map((pool, idx) => {
            const key = derivePoolKey(pool, idx);
            const isOpen = !!openPools[key];
            
            // Extract range from pool structure (não é WalletItem, então usar função customizada)
            const poolRange = extractRangeFromPool(pool);
                        
            const totalRewardsValue = pool.rewards?.reduce((s, r: any) => 
              s + (parseFloat(String(
                r.totalValueUsd || 
                r.totalValueUSD || 
                r.totalValue || 
                r.valueUsd || 
                r.totalPrice || 
                (r.financials && (r.financials.totalPrice || r.financials.totalValue || r.financials.price))
              )) || 0), 0) || 0;

            return (
              <React.Fragment key={key}>
                <tr
                  className="table-row table-row-hover tbody-divider cursor-pointer"
                  onClick={() => togglePool(key)}
                >
                  <td className="td text-primary col-name">
                    <span className="flex align-center gap-8">
                      <span 
                        className="collapse-toggle" 
                        aria-label={isOpen ? 'Collapse pool' : 'Expand pool'}
                      >
                        {isOpen ? '−' : '+'}
                      </span>
                      {Array.isArray(pool.tokens) && pool.tokens.length > 0 && (
                        <TokenDisplay 
                          tokens={pool.tokens.slice(0, 2) as never[]} 
                          size={24} 
                          showChain={false}
                          getChainIcon={(chainKey: string) => undefined}
                        />
                      )}
                    </span>
                  </td>
                  
                  {!hideRange && (
                    <td className="td td-center col-range">
                      {poolRange ? (
                        <RangeChip range={poolRange} />
                      ) : (
                        // Try to show "Full Range" for standard pools without specific range
                        <span 
                          className="td-placeholder" 
                          style={{ fontSize: '11px', color: '#888' }}
                        >
                          Full Range
                        </span>
                      )}
                    </td>
                  )}
                  
                  {!hideAmount && (
                    <td className="td td-right td-mono text-primary col-amount">-</td>
                  )}
                  
                  {!hideRewards && (
                    <td className="td td-right td-mono text-primary col-uncollected">
                      {maskValue(formatPrice(totalRewardsValue))}
                    </td>
                  )}
                  
                  <td className="td td-right td-mono td-mono-strong text-primary col-value">
                    {maskValue(formatPrice(pool.value))}
                  </td>
                </tr>

                {isOpen && pool.tokens && (
                  <>
                    {pool.tokens.map((t: any, tIdx: number) => {
                      const tokenValue = parseFloat(String(
                        t.totalValueUsd || t.totalValueUSD || t.totalValue || t.totalPrice || 0
                      )) || 0;
                      
                      const tokenRewardsRaw = (pool.rewards || []).filter((r: any) => 
                        (r.symbol || '').toLowerCase() === (t.symbol || '').toLowerCase()
                      );
                      
                      const tokenRewardsValue = tokenRewardsRaw.reduce((s, r: any) => 
                        s + (parseFloat(String(
                          r.totalValueUsd || 
                          r.totalValueUSD || 
                          r.totalValue || 
                          r.valueUsd || 
                          r.totalPrice || 
                          (r.financials && (r.financials.totalPrice || r.financials.totalValue || r.financials.price))
                        )) || 0), 0);

                      return (
                        <tr key={`${key}-tok-${tIdx}`} className="table-row tbody-divider pool-token-rows-enter">
                          <td className="td-small text-secondary col-name" style={{ paddingLeft: 34 }}>
                            <span className="flex align-center">
                              <TokenDisplay 
                                tokens={[t] as never[]} 
                                size={18} 
                                showChain={false}
                                getChainIcon={(chainKey: string) => undefined}
                              />
                            </span>
                          </td>
                          
                          {!hideRange && <td className="td-small td-center col-range" />}
                          
                          {!hideAmount && (
                            <td className="td-small td-right td-mono text-primary col-amount">
                              {maskValue(formatTokenAmount(t, 4))}
                            </td>
                          )}
                          
                          {!hideRewards && (
                            <td className="td-small td-right td-mono text-primary col-uncollected">
                              {tokenRewardsValue ? maskValue(formatPrice(tokenRewardsValue)) : '-'}
                            </td>
                          )}
                          
                          <td className="td-small td-right td-mono td-mono-strong text-primary col-value">
                            {maskValue(formatPrice(tokenValue))}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PoolTables;