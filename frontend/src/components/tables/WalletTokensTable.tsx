/**
 * WalletTokensTable TypeScript Component - Migração completa para TypeScript
 * Tabela para exibir tokens da carteira com suporte completo a TypeScript
 */

import React from 'react';
import { useMaskValues } from '../../context/MaskValuesContext';
import { useTheme } from '../../context/ThemeProvider';
import { 
  formatPrice, 
  formatTokenAmount, 
  calculatePercentage, 
  getTotalPortfolioValue 
} from '../../utils/walletUtils';
import TokenDisplay from '../TokenDisplay';
import StandardHeader from '../table/StandardHeader';
import MiniMetric from '../MiniMetric';
import type { WalletItem } from '../../types/wallet';
import { getWalletTokenItems } from '../../types/filters';
// Pronto para usar funções TypeScript quando migrar para WalletItem[]

// Interface CORRETA - APENAS WalletItem[]
interface WalletTokensTableProps {
  items: WalletItem[]; // SEMPRE usar esta estrutura
  showBalanceColumn?: boolean;
  showUnitPriceColumn?: boolean;
  showMetrics?: boolean;
  
  // DEPRECATED - apenas para compatibilidade temporária
  tokens?: TokenData[];
}

interface TokenData {
  token?: WalletToken;
  // Permite estrutura aninhada ou direta
  [key: string]: any;
}

interface WalletToken {
  contractAddress?: string;
  tokenAddress?: string;
  address?: string;
  chainId?: string | number;
  chainID?: string | number;
  chain?: string;
  networkId?: string | number;
  network?: string;
  chainName?: string;
  symbol?: string;
  name?: string;
  priceUsd?: number | string;
  price?: number | string;
  priceUSD?: number | string;
  totalPrice?: number | string;
  balance?: number | string;
  amount?: number | string;
  decimals?: number;
  logo?: string;
  [key: string]: any;
}

interface ColumnDef {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * Gera uma chave única e estável para uma linha de token, 
 * combinando address + chain quando disponível.
 */
function deriveTokenKey(token: WalletToken | null, index: number): string {
  if (!token) return `tok-${index}`;
  
  const addr = (token.contractAddress || token.tokenAddress || token.address || '').toLowerCase();
  const chain = (
    token.chainId ||
    token.chainID ||
    token.chain ||
    token.networkId ||
    token.network ||
    token.chainName ||
    ''
  )
    .toString()
    .toLowerCase();
    
  if (addr) return `${addr}${chain ? `-${chain}` : ''}`;
  
  // Alguns tokens nativos podem compartilhar o placeholder (ex: 0xeeee...) 
  // então desambiguar por symbol+index
  const symbol = (token.symbol || '').toLowerCase();
  const name = (token.name || '').toLowerCase();
  return `${symbol || name || 'token'}-${index}`;
}

/**
 * Tabela de tokens da carteira com estilo similar ao PoolTables (estilo Uniswap)
 */
const WalletTokensTable: React.FC<WalletTokensTableProps> = ({
  tokens = [],
  showBalanceColumn = true,
  showUnitPriceColumn = true,
  showMetrics = true,
}) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  
  if (!tokens || tokens.length === 0) return null;

  const totalValue = tokens.reduce((sum, tokenData) => {
    const token = tokenData.token || tokenData;
    const value = parseFloat(String(token.totalPrice)) || 0;
    return sum + (isFinite(value) ? value : 0);
  }, 0);

  const count = tokens.length;
  const portfolioTotal = getTotalPortfolioValue ? getTotalPortfolioValue() : 0;
  const portfolioPercent = portfolioTotal > 0 ? calculatePercentage(totalValue, portfolioTotal) : '0%';

  const columnDefs: ColumnDef[] = [
    { key: 'price', label: 'Price', align: 'right' },
    { key: 'amount', label: 'Amount', align: 'right' },
    { key: 'value', label: 'Value', align: 'right' },
  ];

  return (
    <div className="wallet-tokens-table-wrapper flex-col gap-12">
      {showMetrics && (
        <div className="mini-metrics">
          <MiniMetric 
            label="Positions" 
            value={count}
          />
          <MiniMetric 
            label="Portfolio %" 
            value={portfolioPercent}
          />
        </div>
      )}
      
      <table className="table-unified text-primary">
        <StandardHeader 
          columns={['token', 'price', 'amount', 'value']}
          columnDefs={columnDefs} 
        />
        <tbody>
          {tokens.map((tokenData, index) => {
            const token = tokenData.token || tokenData;
            const key = deriveTokenKey(token, index);
            const unitPrice = parseFloat(String(
              token.priceUsd || token.price || token.priceUSD || 0
            )) || 0;

            return (
              <tr
                key={key}
                className={`table-row table-row-hover ${
                  index === tokens.length - 1 ? '' : 'tbody-divider'
                }`}
              >
                <td className="td text-primary col-name">
                  <TokenDisplay 
                    tokens={[token] as never[]} 
                    size={22} 
                    showChain={true} 
                  />
                </td>
                
                <td className="td td-right td-mono tabular-nums text-primary col-price">
                  {maskValue(formatPrice(unitPrice))}
                </td>
                
                <td className="td td-right td-mono tabular-nums text-primary col-amount">
                  {maskValue(formatTokenAmount(token, 4))}
                </td>
                
                <td className="td td-right td-mono tabular-nums td-mono-strong text-primary col-value">
                  {maskValue(formatPrice(parseFloat(String(token.totalPrice)) || 0))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default WalletTokensTable;