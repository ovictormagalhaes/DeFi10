import React, { useMemo } from 'react';

import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import type { WalletItem } from '../../types/wallet';
import { filterSuppliedTokens } from '../../utils/tokenFilters';
import {
  formatPrice,
  formatTokenAmount,
  calculatePercentage,
  getTotalPortfolioValue,
  derivePositionKey,
} from '../../utils/walletUtils';
import MiniMetric from '../MiniMetric';
import StandardHeader from '../table/StandardHeader';
import TableFooter from '../table/TableFooter';
import TokenDisplay from '../TokenDisplay.tsx';

// Interface para props do componente
interface DepositTablesProps {
  items: WalletItem[]; // Posições de deposits
  showMetrics?: boolean;
}

// Processar todas as posições de deposits para extrair tokens depositados
function processDepositData(items: WalletItem[]) {
  const allDepositedTokens: any[] = [];

  items.forEach((item) => {
    // Try multiple possible token locations
    const tokens = item.position?.tokens || item.tokens || [];

    // Filtrar apenas tokens depositados (Supplied type)
    const depositedTokens = filterSuppliedTokens(tokens);

    // Adicionar informações extras aos tokens
    depositedTokens.forEach((token) => {
      allDepositedTokens.push({
        ...token,
        positionKey: derivePositionKey(item),
      });
    });
  });

  return {
    depositedTokens: allDepositedTokens,
  };
}

const DepositTables: React.FC<DepositTablesProps> = ({ items = [], showMetrics = true }) => {
  const { maskValue } = useMaskValues();

  const { depositedTokens } = useMemo(() => {
    return processDepositData(items);
  }, [items]);

  const depositValue = useMemo(() => {
    return depositedTokens.reduce((sum, token) => {
      const value =
        parseFloat(
          String(token.financials?.totalPrice || token.totalPrice || token.totalValueUsd || 0)
        ) || 0;
      return sum + value;
    }, 0);
  }, [depositedTokens]);

  const positionsCount = items.length;

  const portfolioTotal = getTotalPortfolioValue ? getTotalPortfolioValue() : 0;
  const portfolioPercent =
    portfolioTotal > 0 ? calculatePercentage(depositValue, portfolioTotal) : '0%';

  if (!items || items.length === 0) return null;

  return (
    <div className="deposit-tables-wrapper flex-col gap-12">
      {showMetrics && (
        <div className="mini-metrics">
          <MiniMetric label="Positions" value={positionsCount} />
          <MiniMetric label="Portfolio %" value={portfolioPercent} />
        </div>
      )}

      {/* Deposited Tokens Table */}
      {depositedTokens.length > 0 && (
        <div className="table-section">
          <table className="table-unified text-primary">
            <StandardHeader
              columns={['amount', 'value']}
              columnDefs={null}
              labels={{ token: 'Deposited', amount: 'Amount', value: 'Value' }}
            />
            <tbody>
              {depositedTokens.map((token, idx) => {
                const tokenValue =
                  parseFloat(
                    String(
                      token.financials?.totalPrice || token.totalPrice || token.totalValueUsd || 0
                    )
                  ) || 0;

                return (
                  <tr key={`deposit-${idx}`} className="table-row table-row-hover tbody-divider">
                    <td className="td text-primary col-token">
                      <span className="flex align-center gap-8">
                        <TokenDisplay
                          tokens={[token] as never[]}
                          size={24}
                          showChain={false}
                          showName={true}
                          getChainIcon={(chainKey: string) => undefined}
                        />
                      </span>
                    </td>

                    <td className="td td-right td-mono text-primary col-amount">
                      {formatTokenAmount(token)}
                    </td>

                    <td className="td td-right td-mono td-mono-strong text-primary col-value">
                      {maskValue(formatPrice(tokenValue))}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <TableFooter
              totalValue={depositValue}
              itemsCount={depositedTokens.length}
              columns={['amount', 'value']}
            />
          </table>
        </div>
      )}
    </div>
  );
};

export default DepositTables;
