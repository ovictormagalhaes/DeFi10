import React from 'react';
import { WalletItem, extractHealthFactor, extractPoolFees24h, extractPoolRange, isLiquidityPoolData, isLendingData } from '../types/wallet';

interface TypedWalletItemProps {
  item: WalletItem;
}

/**
 * Exemplo de como usar as tipagens TypeScript para eliminar gambiarras
 * Este componente demonstra o acesso type-safe aos dados
 */
export const TypedWalletItem: React.FC<TypedWalletItemProps> = ({ item }) => {
  // Lending positions - acesso direto sem gambiarras
  if (item.type === "LendingAndBorrowing" && item.additionalData) {
    const healthFactor = extractHealthFactor(item);
    const isCollateral = item.additionalData.isCollateral;
    
    return (
      <div>
        <h3>{item.protocol.name} - {item.position.label}</h3>
        {healthFactor && (
          <div>Health Factor: {healthFactor.toFixed(2)} {healthFactor < 1.5 && '⚠️'}</div>
        )}
        <div>Is Collateral: {isCollateral ? 'Yes' : 'No'}</div>
      </div>
    );
  }

  // Liquidity pools - acesso direto sem gambiarras
  if (item.type === "LiquidityPool" && item.additionalData) {
    const range = extractPoolRange(item);
    const fees24h = extractPoolFees24h(item);
    
    return (
      <div>
        <h3>{item.protocol.name} - Liquidity Pool</h3>
        {range && (
          <div>
            Range: {range.lower.toFixed(6)} - {range.upper.toFixed(6)}
            {range.inRange ? ' ✅' : ' ❌'}
          </div>
        )}
        {range && <div>Current: {range.current.toFixed(6)}</div>}
        {fees24h && <div>Fees 24h: ${fees24h.toFixed(2)}</div>}
      </div>
    );
  }

  // Wallet items
  return (
    <div>
      <h3>{item.protocol.name} - {item.position.label}</h3>
      <div>Tokens: {item.position.tokens.length}</div>
      {item.position.tokens.map((token, index) => (
        <div key={index}>
          {token.symbol}: ${token.financials.totalPrice.toFixed(2)}
        </div>
      ))}
    </div>
  );
};

// Função utilitária tipada para processar uma lista de items
export function processWalletData(items: WalletItem[]) {
  const stats = {
    totalValue: 0,
    liquidityPools: 0,
    lendingPositions: 0,
    avgHealthFactor: 0,
    totalFees24h: 0
  };

  let healthFactorSum = 0;
  let healthFactorCount = 0;

  items.forEach(item => {
    // Soma valor total dos tokens
    stats.totalValue += item.position.tokens.reduce((sum, token) => 
      sum + token.financials.totalPrice, 0
    );

    if (item.type === "LiquidityPool") {
      stats.liquidityPools++;
      const fees24h = extractPoolFees24h(item);
      if (fees24h) {
        stats.totalFees24h += fees24h;
      }
    }

    if (item.type === "LendingAndBorrowing") {
      stats.lendingPositions++;
      const healthFactor = extractHealthFactor(item);
      if (healthFactor) {
        healthFactorSum += healthFactor;
        healthFactorCount++;
      }
    }
  });

  if (healthFactorCount > 0) {
    stats.avgHealthFactor = healthFactorSum / healthFactorCount;
  }

  return stats;
}

export default TypedWalletItem;