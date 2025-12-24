import React, { useState, useMemo, useEffect } from 'react';

import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import { useTheme } from '../../context/ThemeProvider';
import type { WalletItem } from '../../types/wallet';
import { extractAllRewards, normalizeTokenPrice } from '../../utils/tokenFilters';
import {
  formatPrice,
  formatTokenAmount,
  calculatePercentage,
  getTotalPortfolioValue,
  sum,
} from '../../utils/walletUtils';
import MiniMetric from '../MiniMetric';
import RangeChip from '../RangeChip';
import StandardHeader from '../table/StandardHeader';
import TableFooter from '../table/TableFooter';
import TokenDisplay from '../TokenDisplay.tsx';

// Interface simplificada - APENAS WalletItem[]
interface PoolTablesProps {
  items: WalletItem[];
  showMetrics?: boolean;
}

// Interface para range de pools
interface PoolRange {
  min?: number;
  max?: number;
  current?: number;
  inRange?: boolean;
  lower?: number;
  upper?: number;
  [key: string]: any;
}

// Função para derivar chave única do pool
function derivePoolKey(item: WalletItem, index: number): string {
  // Verificar se tem address/contractAddress tanto em item quanto em position
  const addr = (
    (item as any).address ||
    (item as any).contractAddress ||
    item.position?.address ||
    item.position?.contractAddress ||
    ''
  ).toLowerCase();
  if (addr) return addr;

  // Verificar se tem name/label tanto em item quanto em position
  const name = (
    (item as any).name ||
    (item as any).label ||
    item.position?.name ||
    item.position?.label ||
    ''
  ).toLowerCase();
  if (name) return `${name}-${index}`;
  return `pool-${index}`;
}

// Função para extrair range de WalletItem
function extractRangeFromItem(item: WalletItem): PoolRange | null {
  // Tenta extrair range dos dados da posição ou additionalData
  const rangeData =
    (item as any).additionalData?.range ||
    (item as any).range ||
    (item as any).rangeData ||
    (item.position as any)?.range ||
    (item.position as any)?.rangeData ||
    null;
  if (!rangeData) return null;

  // Valida e converte os dados de range
  const lower = parseFloat(String(rangeData.lower || rangeData.min || rangeData.tickLower || ''));
  const upper = parseFloat(String(rangeData.upper || rangeData.max || rangeData.tickUpper || ''));
  const current = parseFloat(
    String(rangeData.current || rangeData.currentPrice || rangeData.price || '')
  );

  if (isFinite(lower) && isFinite(upper) && isFinite(current)) {
    return {
      min: lower,
      max: upper,
      current,
      inRange: rangeData.inRange ?? (current >= lower && current <= upper),
      lower,
      upper,
    };
  }

  return null;
}

// Função para extrair informações do protocolo de WalletItem
function getProtocolInfo(item: WalletItem): { name: string | null; logo: string | null } {
  if (!item.protocol) return { name: null, logo: null };

  return {
    name: item.protocol.name || null,
    logo: item.protocol.logo || null,
  };
}

// Interface para item processado
interface ProcessedPoolItem {
  item: WalletItem;
  tokens: any[];
  value: number;
  rewards: any[];
}

// Função para processar WalletItems de pool
function processPoolItems(items: WalletItem[]): ProcessedPoolItem[] {
  return items.map((item) => {
    // Tokens podem estar em item.tokens (dados diretos) ou item.position?.tokens (nested)
    const tokens = (item as any).tokens || item.position?.tokens || [];

    // Extract all tokens from position including uncollected fees
    const allTokens = (item as any).tokens || item.position?.tokens || [];
    const uncollectedFeeTokens = allTokens.filter((t: any) => t.type === 'LiquidityUncollectedFee');
    const normalizedRewards = uncollectedFeeTokens.map(normalizeTokenPrice);

    // Calculate value from tokens - apenas tokens "Supplied", excluir rewards
    const suppliedTokens = tokens.filter(
      (t: any) => t.type === 'Supplied' || !t.type || t.type === 'LP'
    );
    const valueNum = suppliedTokens.reduce((sum: number, token: any) => {
      const price =
        parseFloat(
          String(
            token.financials?.totalPrice ||
              token.totalPrice ||
              token.totalValueUsd ||
              token.totalValueUSD ||
              token.totalValue ||
              token.valueUsd ||
              token.valueUSD ||
              token.value ||
              0
          )
        ) || 0;
      return sum + price;
    }, 0);

    return {
      item,
      tokens,
      value: valueNum,
      rewards: normalizedRewards,
    };
  });
}

const PoolTables: React.FC<PoolTablesProps> = ({ items = [], showMetrics = true }) => {
  const { maskValue } = useMaskValues();
  const { theme } = useTheme();
  const [openPools, setOpenPools] = useState<Record<string, boolean>>({});

  // Viewport width for responsive column hiding
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

  // Breakpoints para responsividade
  const hideRange = vw < 600;
  const hideRewards = vw < 800;
  const hideAmount = vw < 950;

  if (!items || items.length === 0) return null;

  const processedItems = useMemo(() => processPoolItems(items), [items]);
  const totalValue = sum(processedItems.map((p) => p.value));
  const rewardsValue = sum(
    processedItems.flatMap((p) =>
      (p.rewards || [])
        .filter((r: any) => r.type === 'LiquidityUncollectedFee')
        .map(
          (r: any) =>
            parseFloat(
              r.totalPrice ||
                r.totalValueUsd ||
                r.totalValueUSD ||
                r.totalValue ||
                r.valueUsd ||
                r.valueUSD ||
                r.value ||
                r.financials?.totalPrice ||
                0
            ) || 0
        )
    )
  );
  const positionsCount = processedItems.length;
  const portfolioTotal = getTotalPortfolioValue ? getTotalPortfolioValue() : 0;
  const portfolioPercent =
    portfolioTotal > 0 ? calculatePercentage(totalValue, portfolioTotal) : '0%';

  function togglePool(key: string) {
    setOpenPools((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const keyList = processedItems.map((p, i) => derivePoolKey(p.item, i));
  const allOpen = keyList.every((k) => openPools[k]);
  const anyOpen = keyList.some((k) => openPools[k]);

  function expandAll() {
    setOpenPools(
      keyList.reduce((acc: Record<string, boolean>, k) => {
        acc[k] = true;
        return acc;
      }, {})
    );
  }

  function collapseAll() {
    setOpenPools({});
  }

  // Extrair protocolo predominante dos itens
  const protocolInfo = React.useMemo(() => {
    if (!processedItems.length) return { name: null, logo: null };

    // Coletar todos os protocolos e contar ocorrências
    const protocolCounts = new Map<
      string,
      { count: number; info: { name: string | null; logo: string | null } }
    >();

    processedItems.forEach(({ item }) => {
      const info = getProtocolInfo(item);
      if (info.name) {
        const existing = protocolCounts.get(info.name);
        if (existing) {
          existing.count++;
          // Update logo if current item has logo and existing doesn't
          if (info.logo && !existing.info.logo) {
            existing.info.logo = info.logo;
          }
        } else {
          protocolCounts.set(info.name, { count: 1, info });
        }
      }
    });

    // Encontrar protocolo mais comum
    let maxCount = 0;
    let predominantProtocol: { name: string | null; logo: string | null } = {
      name: null,
      logo: null,
    };

    for (const [, { count, info }] of protocolCounts) {
      if (count > maxCount) {
        maxCount = count;
        predominantProtocol = info;
      }
    }

    return predominantProtocol;
  }, [processedItems]);

  return (
    <div className="pool-tables-wrapper flex-col gap-12">
      {showMetrics && (
        <div className="mini-metrics">
          <MiniMetric label="Positions" value={positionsCount} />
          <MiniMetric label="Portfolio %" value={portfolioPercent} />
          {protocolInfo.name && (
            <div className="mini-metric">
              <span className="mini-metric-label">Protocol</span>
              <div className="mini-metric-row">
                {protocolInfo.logo && (
                  <img
                    src={protocolInfo.logo}
                    alt={protocolInfo.name}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1px solid var(--app-border)',
                    }}
                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                  />
                )}
                <span className="mini-metric-value">{protocolInfo.name}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {processedItems.length > 3 && (
        <div className="expand-controls flex gap-8">
          <button type="button" className="btn btn-sm" disabled={allOpen} onClick={expandAll}>
            Expand All
          </button>
          <button type="button" className="btn btn-sm" disabled={!anyOpen} onClick={collapseAll}>
            Collapse All
          </button>
        </div>
      )}

      <table className="table-unified text-primary">
        <StandardHeader
          columns={
            [
              'token',
              !hideRange && 'range',
              !hideAmount && 'amount',
              !hideRewards && 'uncollected',
              'value',
            ].filter(Boolean) as string[]
          }
          columnDefs={[
            !hideRange && { key: 'range', label: 'Range', align: 'center' },
            !hideAmount && { key: 'amount', label: 'Amount', align: 'right' },
            !hideRewards && { key: 'uncollected', label: 'Uncollected', align: 'right' },
            { key: 'value', label: 'Value', align: 'right' },
          ].filter(Boolean)}
          labels={{ token: 'Pools' }}
        />
        <tbody>
          {processedItems.map((processedItem, idx) => {
            const { item, tokens, value, rewards } = processedItem;
            const key = derivePoolKey(item, idx);
            const isOpen = !!openPools[key];

            // Extract range from WalletItem structure
            const poolRange = extractRangeFromItem(item);

            // Filtrar APENAS LiquidityUncollectedFee tokens para uncollected fees
            const uncollectedFeeTokens = (rewards || []).filter(
              (r: any) => r.type === 'LiquidityUncollectedFee'
            );

            // Calcular valor total dos uncollected fees
            const totalRewardsValue = uncollectedFeeTokens.reduce(
              (s: number, t: any) =>
                s +
                (parseFloat(
                  t.totalPrice ||
                    t.totalValueUsd ||
                    t.totalValueUSD ||
                    t.totalValue ||
                    t.valueUsd ||
                    t.valueUSD ||
                    t.value ||
                    t.financials?.totalPrice ||
                    0
                ) || 0),
              0
            );

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
                      {Array.isArray(tokens) && tokens.length > 0 && (
                        <TokenDisplay
                          tokens={
                            tokens
                              .filter(
                                (t: any) => t.type === 'Supplied' || !t.type || t.type === 'LP'
                              )
                              .slice(0, 2) as never[]
                          }
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
                    {maskValue(formatPrice(value))}
                  </td>
                </tr>

                {isOpen && tokens && (
                  <>
                    {tokens
                      .filter((t: any) => t.type === 'Supplied' || !t.type || t.type === 'LP')
                      .map((t: any, tIdx: number) => {
                        const tokenValue =
                          parseFloat(
                            String(
                              t.financials?.totalPrice ||
                                t.totalPrice ||
                                t.totalValueUsd ||
                                t.totalValueUSD ||
                                t.totalValue ||
                                t.valueUsd ||
                                t.valueUSD ||
                                t.value ||
                                0
                            )
                          ) || 0;

                        // Filtrar APENAS LiquidityUncollectedFee tokens para este token específico
                        const tokenUncollectedFees = (rewards || []).filter(
                          (r: any) =>
                            r.type === 'LiquidityUncollectedFee' &&
                            (r.symbol || '').toLowerCase() === (t.symbol || '').toLowerCase()
                        );

                        // Calcular valor dos uncollected fees para este token específico
                        const tokenRewardsValue = tokenUncollectedFees.reduce(
                          (s: number, r: any) =>
                            s + (parseFloat(r.financials?.totalPrice || r.totalPrice || 0) || 0),
                          0
                        );

                        return (
                          <tr
                            key={`${key}-tok-${tIdx}`}
                            className="table-row tbody-divider pool-token-rows-enter"
                          >
                            <td
                              className="td-small text-secondary col-name"
                              style={{ paddingLeft: 34 }}
                            >
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
                                {tokenRewardsValue && tokenRewardsValue > 0.001
                                  ? maskValue(formatPrice(tokenRewardsValue))
                                  : '-'}
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
        <TableFooter
          totalValue={totalValue}
          itemsCount={positionsCount}
          columns={
            [
              !hideRange && 'range',
              !hideAmount && 'amount',
              !hideRewards && 'rewards',
              'value',
            ].filter(Boolean) as string[]
          }
        />
      </table>
    </div>
  );
};

export default PoolTables;
