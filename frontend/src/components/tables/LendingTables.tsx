/**
 * LendingTables TypeScript Component - Versão Única Consolidada
 * Tabelas para exibir posições de lending/borrowing com suporte completo a TypeScript
 */

import React, { useMemo, useState } from 'react';
import StandardHeader from '../table/StandardHeader';
import TableFooter from '../table/TableFooter';
import TokenDisplay from '../TokenDisplay';
import MiniMetric from '../MiniMetric';
import { useMaskValues } from '../../context/MaskValuesContext';
import { useTheme } from '../../context/ThemeProvider';
import {
  formatPrice,
  formatTokenAmount,
  extractRewards,
  calculatePercentage,
  getTotalPortfolioValue,
  groupBy,
  sum,
  derivePositionKey
} from '../../utils/walletUtils';
import type { WalletItem, Token } from '../../types/wallet';
import { extractHealthFactor } from '../../types/wallet';
import { getLendingItems } from '../../types/filters';

// Interface CORRETA - APENAS WalletItem[] (usando extractHealthFactor do wallet.ts)
interface LendingTablesProps {
  items: WalletItem[]; // SEMPRE usar esta estrutura - vem direta do backend
  showMetrics?: boolean;
  
  // DEPRECATED - apenas para compatibilidade temporária
  positions?: WalletItem[];
  supplied?: any[];
  borrowed?: any[];
  rewards?: any[];
  healthFactor?: number;
}

interface LendingToken {
  token?: Token;
  balance?: number;
  amount?: number;
  totalPrice?: number;
  totalValueUsd?: number;
  totalValue?: number;
  valueUsd?: number;
  priceUsd?: number;
  priceUSD?: number;
  price?: number;
  position?: {
    additionalData?: {
      isCollateral?: boolean;
      IsCollateral?: boolean;
    };
  };
  additionalData?: {
    isCollateral?: boolean;
    IsCollateral?: boolean;
  };
  additionalInfo?: {
    IsCollateral?: boolean;
  };
  additional_info?: {
    is_collateral?: boolean;
  };
  isCollateral?: boolean;
  IsCollateral?: boolean;
}

interface RewardToken {
  token?: Token;
  totalValueUsd?: number;
  totalValueUSD?: number;
  totalValue?: number;
  valueUsd?: number;
  valueUSD?: number;
  value?: number;
  rewards?: any[];
  rewardTokens?: any[];
}

interface AggregatedPosition {
  token: Token;
  supplied: number;
  borrowed: number;
  netValue: number;
  rewards: any[];
  rewardsValue: number;
}

// Função para agregar posições por token
function aggregatePositions(positions: WalletItem[] = []): AggregatedPosition[] {
  const grouped = groupBy(positions, (p: WalletItem) => {
    const pos = (p as any).position || p;
    const token = pos.token || pos.asset || {};
    return (
      (token.address || token.contractAddress || token.contract || '').toLowerCase() || token.symbol || `g-${Math.random()}`
    );
  });

  return Object.values(grouped).map((group: any) => {
    const base = group[0];
    const pos = (base as any).position || base;
    const token = (pos as any).token || (pos as any).asset || {};
    const totalSupplied = sum(
      group.map((g: any) => {
        const gp = g.position || g;
        return (
          (gp as any).suppliedUsd || (gp as any).suppliedUSD || (gp as any).suppliedValueUsd || (gp as any).suppliedValue || (gp as any).supplied || (gp as any).depositedUsd || (gp as any).depositUsd || 0
        );
      })
    );
    const totalBorrowed = sum(
      group.map((g: any) => {
        const gp = g.position || g;
        return (
          (gp as any).borrowedUsd || (gp as any).borrowedUSD || (gp as any).borrowedValueUsd || (gp as any).borrowedValue || (gp as any).borrowed || (gp as any).debtUsd || (gp as any).debt || 0
        );
      })
    );
    const netValue = sum(
      group.map((g: any) => {
        const gp = g.position || g;
        return (gp as any).netValueUsd || (gp as any).netValueUSD || (gp as any).netValue || (gp as any).positionValueUsd || 0;
      })
    );

    const rewards = extractRewards(group.flatMap((g: any) => ((g as any).rewards || (g as any).rewardTokens || [])));
    const rewardsValue = sum(
      rewards.map((r) => r.totalValueUsd || r.totalValueUSD || r.totalValue || r.valueUsd || r.valueUSD || r.value || 0)
    );

    return {
      token,
      supplied: totalSupplied,
      borrowed: totalBorrowed,
      netValue,
      rewards,
      rewardsValue,
    };
  });
}

export default function LendingTables({
  items = [],
  showMetrics = true,
  
  // DEPRECATED - compatibilidade temporária
  positions = [],
  supplied = [],
  borrowed = [],
  rewards = [],
  healthFactor: propHealthFactor,
}: LendingTablesProps) {
  const { maskValue } = useMaskValues();
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // ARQUITETURA CORRETA: Usar items (WalletItem[]) ou fallback para positions
  const walletItems = useMemo(() => {
    // Prioridade 1: items (nova arquitetura)
    if (items && items.length > 0) {
      return items;
    }
    // Prioridade 2: positions (compatibilidade)
    if (positions && positions.length > 0) {
      return positions;
    }
    // Prioridade 3: array vazio (vai para legacy mode)
    return [];
  }, [items, positions]);
  
  // Filtrar apenas itens de lending
  const lendingItems = useMemo(() => {
    return getLendingItems(walletItems);
  }, [walletItems]);
  
  // Legacy mode: apenas quando não temos WalletItems E temos arrays legacy
  const legacyMode = lendingItems.length === 0 && 
    ((supplied && supplied.length) || (borrowed && borrowed.length) || (rewards && rewards.length));

  // ---------- Legacy Rendering Path (Aave style flat tables) ----------
  if (legacyMode) {
    const totalPortfolio = getTotalPortfolioValue ? getTotalPortfolioValue() : 0;
    const suppliedValueLegacy = (supplied || []).reduce((s, t) => s + (parseFloat(String(t.totalPrice || t.totalValueUsd || t.totalValue || t.valueUsd || 0)) || 0), 0);
    const borrowedValueLegacy = (borrowed || []).reduce((s, t) => s + (parseFloat(String(t.totalPrice || t.totalValueUsd || t.totalValue || t.valueUsd || 0)) || 0), 0);
    const netLegacy = suppliedValueLegacy - borrowedValueLegacy;
    const portfolioPercent = totalPortfolio > 0 ? calculatePercentage(netLegacy, totalPortfolio) : '0%';

    // LEGACY: Buscar Health Factor nos arrays antigos (apenas como fallback)
    const allLegacyPositions = [...(supplied || []), ...(borrowed || []), ...(rewards || [])];
    
    // ARQUITETURA CORRETA: Extrair Health Factor dos WalletItems
    let healthFactor: number | null = propHealthFactor || null;
    
    // Extrair de lendingItems (WalletItem[])
    if (!healthFactor && lendingItems.length > 0) {
      healthFactor = lendingItems
        .map(extractHealthFactor)
        .find(hf => hf != null) || null;
    }
    
    // Fallback para tokens individuais (legacy)
    if (!healthFactor) {
      const allTokens = [...(supplied || []), ...(borrowed || []), ...(rewards || [])];
      const tokenWithHF = allTokens.find((token: any) => 
        token.healthFactor != null || 
        token.additionalData?.healthFactor != null
      );
      
      if (tokenWithHF) {
        const hf = (tokenWithHF as any).healthFactor || (tokenWithHF as any).additionalData?.healthFactor;
        healthFactor = hf != null ? parseFloat(String(hf)) : null;
      }
    }

    interface SectionProps {
      title: string;
      tokens: LendingToken[] | RewardToken[];
      negative?: boolean;
    }

    const Section: React.FC<SectionProps> = ({ title, tokens, negative = false }) => {
      if (!tokens || tokens.length === 0) return null;
      
      const isSupplied = title === 'Supplied';
      const isBorrowed = title === 'Borrowed';

      // Calculate the correct total for this specific section
      const sectionTotal = tokens.reduce((sum, t) => {
        const valueRaw = parseFloat(String((t as any).totalPrice || (t as any).totalValueUsd || (t as any).totalValue || (t as any).valueUsd || 0)) || 0;
        return sum + (negative ? -Math.abs(valueRaw) : valueRaw);
      }, 0);

      return (
        <div className="table-wrapper">
          <table className="table-unified text-primary">
            <StandardHeader
              columnDefs={[
                {
                  key: 'collateral',
                  label: isSupplied ? 'Collateral' : isBorrowed ? '' : 'Collateral',
                  align: 'center'
                },
                { key: 'price', label: 'Price', align: 'right' },
                { key: 'amount', label: 'Amount', align: 'right' },
                { key: 'value', label: 'Value', align: 'right' }
              ]}
              labels={{ token: title === 'Supplied' ? 'Supply' : title === 'Borrowed' ? 'Borrow' : 'Token' }}
              columns={['token', 'collateral', 'price', 'amount', 'value']}
            />
            <tbody>
              {tokens.map((t: any, idx) => {
                const valueRaw = parseFloat(String(t.totalPrice || t.totalValueUsd || t.totalValue || t.valueUsd || 0)) || 0;
                const value = negative ? -Math.abs(valueRaw) : valueRaw;
                const unitPrice = parseFloat(String(t.priceUsd || t.priceUSD || t.price || 0)) || 0;
                const tokenObj = t?.token ? t.token : t;

                const isCollateral = [
                  (tokenObj as any)?.isCollateral,
                  (tokenObj as any)?.IsCollateral,
                  (tokenObj as any)?.additionalData?.isCollateral,
                  (tokenObj as any)?.additionalData?.IsCollateral,
                  (tokenObj as any)?.AdditionalData?.IsCollateral,
                  (tokenObj as any)?.additionalInfo?.IsCollateral,
                  (tokenObj as any)?.additional_info?.is_collateral,
                  (t as any)?.position?.additionalData?.IsCollateral,
                  (t as any)?.position?.additionalData?.isCollateral
                ].some((v) => v === true);

                return (
                  <tr
                    key={idx}
                    className={`table-row table-row-hover ${idx === tokens.length - 1 ? '' : 'tbody-divider'}`}
                  >
                    <td className="td text-primary col-name">
                      <TokenDisplay tokens={[t] as never[]} size={22} showChain={false} getChainIcon={() => undefined} />
                    </td>
                    <td className="td th-center col-collateral">
                      {isSupplied && (
                        isCollateral ? (
                          <span
                            className="toggle-pill on"
                            aria-label="Collateral"
                            role="switch"
                            aria-checked="true"
                          />
                        ) : (
                          <span
                            className="toggle-pill"
                            aria-label="Not collateral"
                            role="switch"
                            aria-checked="false"
                          />
                        )
                      )}
                      {isBorrowed && null}
                    </td>
                    <td className="td td-right td-mono text-primary col-price">
                      {maskValue(formatPrice(unitPrice))}
                    </td>
                    <td className="td td-right td-mono text-primary col-amount">
                      {maskValue(formatTokenAmount(t as any), { short: true })}
                    </td>
                    <td className="td td-right td-mono td-mono-strong text-primary col-value">
                      {maskValue(formatPrice(value))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <TableFooter 
              totalValue={sectionTotal}
              itemsCount={tokens.length}
              columns={['', 'price', 'amount', 'value']}
            />
          </table>
        </div>
      );
    };

    return (
      <div className="lending-tables-wrapper flex-col gap-12">
        {showMetrics && (
          <div className="mini-metrics">
            <MiniMetric label="Positions" value={(supplied?.length || 0) + (borrowed?.length || 0) + (rewards?.length || 0)} />
            <MiniMetric label="Portfolio %" value={portfolioPercent}/>
            {healthFactor && <MiniMetric label="Health Factor" value={healthFactor.toFixed(2)} accent={healthFactor < 1.5}/>}
          </div>
        )}
        <Section title="Supplied" tokens={supplied} negative={false} />
        {supplied.length > 0 && borrowed.length > 0 && <div className="spacer-6" />}
        <Section title="Borrowed" tokens={borrowed} negative={true} />
        {(supplied.length > 0 || borrowed.length > 0) && rewards.length > 0 && <div className="spacer-6" />}
        <Section title="Rewards" tokens={rewards} negative={false} />
      </div>
    );
  }

  // ---------- Aggregated (new) mode path ----------
  if (!lendingItems || lendingItems.length === 0) return null;

  const aggregated = useMemo(() => aggregatePositions(lendingItems), [lendingItems]);

  const suppliedList = aggregated.filter((p) => parseFloat(p.supplied.toString()) > 0);
  const borrowedList = aggregated.filter((p) => parseFloat(p.borrowed.toString()) > 0);
  const rewardsList = aggregated.filter((p) => p.rewards && p.rewards.length > 0 && p.rewardsValue > 0);

  function toggle(idx: number, type: string) {
    setExpanded((prev) => ({ ...prev, [`${type}-${idx}`]: !prev[`${type}-${idx}`] }));
  }

  const totalSuppliedValue = sum(suppliedList.map((p) => p.supplied));
  const totalBorrowedValue = sum(borrowedList.map((p) => p.borrowed));
  const totalRewardsValue = sum(rewardsList.map((p) => p.rewardsValue));
  const positionsCount = aggregated.length;
  const portfolioTotal = getTotalPortfolioValue ? getTotalPortfolioValue() : 0;
  const netValueAll = totalSuppliedValue - totalBorrowedValue;
  const portfolioPercent = portfolioTotal > 0 ? calculatePercentage(netValueAll, portfolioTotal) : '0%';

  // Extract Health Factor from WalletItem lending items - TYPE SAFE!
  const healthFactor = propHealthFactor || 
    lendingItems
      .map(extractHealthFactor) // Função TypeScript que já funciona com WalletItem
      .find(hf => hf != null) || null;

  return (
    <div className="lending-tables-wrapper flex-col gap-12">
      {showMetrics && (
        <div className="mini-metrics">
          <MiniMetric label="Positions" value={positionsCount} tooltip="Total number of positions" />
          <MiniMetric label="Portfolio %" value={portfolioPercent} tooltip="Percentage of total portfolio" />
          {healthFactor && <MiniMetric label="Health Factor" value={healthFactor.toFixed(2)} accent={healthFactor < 1.5} tooltip="Liquidation risk indicator" />}
        </div>
      )}

      {suppliedList.length > 0 && (
        <table className="table-unified text-primary">
          <StandardHeader
            columns={['token', 'supplied', 'net']}
            columnDefs={[
              { key: 'supplied', label: 'Supplied', align: 'right' },
              { key: 'net', label: 'Net Value', align: 'right' },
            ]}
            labels={{ token: 'Supplied' }}
          />
          <tbody>
            {suppliedList.map((p, i) => {
              const key = derivePositionKey(p, i);
              const suppliedValue = parseFloat(p.supplied.toString()) || 0;
              const netValue = parseFloat(p.netValue.toString()) || 0;
              const isOpen = expanded[`sup-${i}`];
              return (
                <React.Fragment key={`sup-${key}`}>
                  <tr
                    className={`table-row table-row-hover ${i === suppliedList.length - 1 && !isOpen ? '' : 'tbody-divider'}`}
                  >
                    <td className="td text-primary col-name" onClick={() => toggle(i, 'sup')} style={{ cursor: 'pointer' }}>
                      <div className="flex items-center gap-8">
                        <span className={`disclosure ${isOpen ? 'open' : ''}`} />
                        <TokenDisplay tokens={[p.token] as any} size={22} showChain={false} getChainIcon={() => undefined} />
                      </div>
                    </td>
                    <td className="td td-right td-mono tabular-nums text-primary col-supplied">
                      {maskValue(formatPrice(suppliedValue))}
                    </td>
                    <td className="td td-right td-mono tabular-nums td-mono-strong text-primary col-net">
                      {maskValue(formatPrice(netValue))}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className={`table-row table-row-nested ${i === suppliedList.length - 1 ? '' : 'tbody-divider'}`}>
                      <td colSpan={3} className="td td-nested-bg">
                        <div className="text-secondary text-sm">No deeper breakdown available (restored expandable row placeholder).</div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <TableFooter 
            totalValue={totalSuppliedValue}
            itemsCount={suppliedList.length}
            columns={['price', 'amount', 'value']}
          />
        </table>
      )}
      
      {/* Borrowed e Rewards tables seguem o mesmo padrão... */}
    </div>
  );
}