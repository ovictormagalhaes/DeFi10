/**
 * Exemplo da ARQUITETURA CORRETA para usar WalletItem[]
 * Todos os componentes devem seguir este padrão
 */

import React from 'react';
import type { WalletItem } from '../types/wallet';
import { 
  getLiquidityPoolItems, 
  getLendingItems, 
  getStakingItems, 
  getWalletTokenItems,
  groupItemsByProtocol 
} from '../types/filters';
import { LendingTables, PoolTables, WalletTokensTable } from './tables';

interface CorrectArchitectureExampleProps {
  walletItems: WalletItem[]; // SEMPRE esta estrutura
}

const CorrectArchitectureExample: React.FC<CorrectArchitectureExampleProps> = ({
  walletItems
}) => {
  
  // ARQUITETURA CORRETA: Filtrar os WalletItems por tipo
  const liquidityPools = getLiquidityPoolItems(walletItems);
  const lendingPositions = getLendingItems(walletItems);
  const stakingPositions = getStakingItems(walletItems);
  const walletTokens = getWalletTokenItems(walletItems);
  
  // Agrupar por protocolo se necessário
  const itemsByProtocol = groupItemsByProtocol(walletItems);
  
  return (
    <div className="wallet-sections">
      {/* 🎯 CORRETO: Passar WalletItem[] diretamente */}
      
      {lendingPositions.length > 0 && (
        <section>
          <h2>Lending & Borrowing</h2>
          <LendingTables items={lendingPositions} />
        </section>
      )}
      
      {liquidityPools.length > 0 && (
        <section>
          <h2>Liquidity Pools</h2>
          <PoolTables items={liquidityPools} />
        </section>
      )}
      
      {walletTokens.length > 0 && (
        <section>
          <h2>Wallet Tokens</h2>
          <WalletTokensTable items={walletTokens} />
        </section>
      )}
      
      {/* Exemplo de agrupamento por protocolo */}
      {Object.entries(itemsByProtocol).map(([protocolId, protocolItems]) => (
        <section key={protocolId}>
          <h2>{protocolItems[0]?.protocol.name}</h2>
          
          {/* Filtrar items do protocolo por tipo */}
          <LendingTables items={getLendingItems(protocolItems)} />
          <PoolTables items={getLiquidityPoolItems(protocolItems)} />
          <WalletTokensTable items={getWalletTokenItems(protocolItems)} />
        </section>
      ))}
    </div>
  );
};

export default CorrectArchitectureExample;

/*
RESUMO DA ARQUITETURA CORRETA:

1. ✅ Backend retorna: WalletItem[]
2. ✅ Frontend recebe: WalletItem[]  
3. ✅ Componentes usam: WalletItem[]
4. ✅ Filtros aplicados: getLendingItems(), getLiquidityPoolItems(), etc
5. ✅ NUNCA fazer: conversões de objeto X para objeto Y

BENEFÍCIOS:
- Health Factor sempre disponível em WalletItem.additionalData.healthFactor
- Range sempre disponível em WalletItem.additionalData.range
- Type safety completa com TypeScript
- Código simples e direto
- Sem conversões desnecessárias
- Fácil de manter e debuggar
*/