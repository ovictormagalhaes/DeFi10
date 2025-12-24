/**
 * LockingTables TypeScript Component
 * Component para exibir posições de tokens bloqueados (vePENDLE, etc.)
 * Estrutura similar ao LendingTables com duas tabelas: Supply e Governance
 */

import React, { useMemo } from 'react';

import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import type { WalletItem } from '../../types/wallet';
import { filterSuppliedTokens, filterGovernanceTokens } from '../../utils/tokenFilters';
import {
  formatPrice,
  formatTokenAmount,
  calculatePercentage,
  getTotalPortfolioValue,
  derivePositionKey,
} from '../../utils/walletUtils';
import InfoIconWithTooltip from '../InfoIconWithTooltip';
import MiniMetric from '../MiniMetric';
import StandardHeader from '../table/StandardHeader';
import TableFooter from '../table/TableFooter';
import TokenDisplay from '../TokenDisplay.tsx';

// Interface para props do componente
interface LockingTablesProps {
  items: WalletItem[]; // Posições de locking
  showMetrics?: boolean;
}

// Processar todas as posições de locking para extrair tokens supply e governance
function processLockingData(items: WalletItem[]) {
  const allSuppliedTokens: any[] = [];
  const allGovernanceTokens: any[] = [];
  let unlockDate: Date | null = null;

  items.forEach((item) => {
    // Try multiple possible token locations
    const tokens = item.position?.tokens || item.tokens || [];

    // Extrair data de unlock dos additionalData (comum para todos os tokens)
    const unlockTimestamp = (item as any).additionalData?.unlockAt;
    if (unlockTimestamp && !unlockDate) {
      unlockDate = new Date(unlockTimestamp * 1000);
    }

    // Separar tokens por tipo
    const suppliedTokens = filterSuppliedTokens(tokens);
    const governanceTokens = filterGovernanceTokens(tokens);

    // Adicionar informações extras aos tokens
    suppliedTokens.forEach((token) => {
      allSuppliedTokens.push({
        ...token,
        unlockDate,
        positionKey: derivePositionKey(item),
      });
    });

    governanceTokens.forEach((token) => {
      allGovernanceTokens.push({
        ...token,
        positionKey: derivePositionKey(item),
      });
    });
  });

  return {
    suppliedTokens: allSuppliedTokens,
    governanceTokens: allGovernanceTokens,
    unlockDate,
  };
}

// Função para formatar data de unlock como yyyy/MM/dd HH:mm
function formatUnlockDate(date: Date | null): string {
  if (!date) return 'Unknown';

  // Formato: yyyy/MM/dd HH:mm
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

// Função para calcular dias restantes
function getDaysUntilUnlock(date: Date | null): string {
  if (!date) return 'Unknown';

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 30) return `${diffDays} days`;
  if (diffDays <= 365) {
    const months = Math.round(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''}`;
  }

  const years = Math.round(diffDays / 365);
  return `${years} year${years > 1 ? 's' : ''}`;
}

const LockingTables: React.FC<LockingTablesProps> = ({ items = [], showMetrics = true }) => {
  const { maskValue } = useMaskValues();

  const { suppliedTokens, governanceTokens, unlockDate } = useMemo(() => {
    return processLockingData(items);
  }, [items]);

  const suppliedValue = useMemo(() => {
    return suppliedTokens.reduce((sum, token) => {
      const value =
        parseFloat(
          String(token.financials?.totalPrice || token.totalPrice || token.totalValueUsd || 0)
        ) || 0;
      return sum + value;
    }, 0);
  }, [suppliedTokens]);

  const governanceValue = useMemo(() => {
    return governanceTokens.reduce((sum, token) => {
      const value =
        parseFloat(
          String(token.financials?.totalPrice || token.totalPrice || token.totalValueUsd || 0)
        ) || 0;
      return sum + value;
    }, 0);
  }, [governanceTokens]);

  const totalValue = suppliedValue + governanceValue;
  const positionsCount = items.length;

  const portfolioTotal = getTotalPortfolioValue ? getTotalPortfolioValue() : 0;
  const portfolioPercent =
    portfolioTotal > 0 ? calculatePercentage(totalValue, portfolioTotal) : '0%';

  if (!items || items.length === 0) return null;

  return (
    <div className="locking-tables-wrapper flex-col gap-12">
      {showMetrics && (
        <div className="mini-metrics">
          <MiniMetric label="Positions" value={positionsCount} />
          <MiniMetric label="Portfolio %" value={portfolioPercent} />
        </div>
      )}

      {/* Supply Table - Locked Tokens */}
      {suppliedTokens.length > 0 && (
        <div className="table-section">
          <table className="table-unified text-primary">
            <StandardHeader
              columns={['amount', 'unlock', 'value']}
              columnDefs={null}
              labels={{ token: 'Supply', amount: 'Amount', unlock: 'Unlock At', value: 'Value' }}
            />
            <tbody>
              {suppliedTokens.map((token, idx) => {
                const tokenValue =
                  parseFloat(
                    String(
                      token.financials?.totalPrice || token.totalPrice || token.totalValueUsd || 0
                    )
                  ) || 0;

                return (
                  <tr key={`supply-${idx}`} className="table-row table-row-hover tbody-divider">
                    <td className="td text-primary col-token">
                      <span className="flex align-center gap-8">
                        <TokenDisplay
                          tokens={[token] as never[]}
                          size={24}
                          showChain={false}
                          getChainIcon={(chainKey: string) => undefined}
                        />
                      </span>
                    </td>

                    <td className="td td-right td-mono text-primary col-amount">
                      {formatTokenAmount(token)}
                    </td>

                    <td className="td td-right td-mono text-primary col-unlock">
                      <span className="flex align-center justify-end gap-4">
                        <span>{formatUnlockDate(token.unlockDate)}</span>
                        <InfoIconWithTooltip
                          content={getDaysUntilUnlock(token.unlockDate)}
                          align="center"
                          maxWidth={120}
                        />
                      </span>
                    </td>

                    <td className="td td-right td-mono td-mono-strong text-primary col-value">
                      {maskValue(formatPrice(tokenValue))}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <TableFooter
              totalValue={suppliedValue}
              itemsCount={suppliedTokens.length}
              columns={['amount', 'unlock', 'value']}
            />
          </table>
        </div>
      )}

      {/* Governance Table - Voting Power Tokens */}
      {governanceTokens.length > 0 && (
        <div className="table-section">
          <table className="table-unified text-primary">
            <StandardHeader
              columns={['amount']}
              columnDefs={null}
              labels={{ token: 'Governance', amount: 'Amount' }}
            />
            <tbody>
              {governanceTokens.map((token, idx) => {
                return (
                  <tr key={`governance-${idx}`} className="table-row table-row-hover tbody-divider">
                    <td className="td text-primary col-token">
                      <span className="flex align-center gap-8">
                        <TokenDisplay
                          tokens={[token] as never[]}
                          size={24}
                          showChain={false}
                          getChainIcon={(chainKey: string) => undefined}
                        />
                      </span>
                    </td>

                    <td className="td td-right td-mono text-primary col-amount">
                      {formatTokenAmount(token)}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <TableFooter
              totalValue={governanceValue}
              itemsCount={governanceTokens.length}
              columns={['amount']}
            />
          </table>
        </div>
      )}
    </div>
  );
};

export default LockingTables;
