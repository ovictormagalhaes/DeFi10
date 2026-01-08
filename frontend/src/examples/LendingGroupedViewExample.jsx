// Exemplo de uso completo do LendingGroupedView
// Este arquivo demonstra como implementar a nova visualização agrupada

import React, { useState } from 'react';
import { 
  LendingGroupedView, 
  LendingCards,
  LendingSectionHeader,
  LendingSubSectionHeader 
} from './components/cards';

/**
 * Exemplo 1: Substituição Simples
 * Trocar LendingCards por LendingGroupedView
 */
export const ExemploSimples = ({ lendingData }) => {
  return (
    <div>
      <LendingSectionHeader data={lendingData} />
      <LendingSubSectionHeader data={lendingData} groupByProtocol={true} />
      <LendingGroupedView data={lendingData} />
    </div>
  );
};

/**
 * Exemplo 2: Com Toggle de Visualização
 * Permite usuário escolher entre grouped e individual
 */
export const ExemploComToggle = ({ lendingData }) => {
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' ou 'individual'

  return (
    <div>
      {/* Header */}
      <LendingSectionHeader data={lendingData} />
      
      {/* Toggle Button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        marginBottom: 16,
        gap: 8 
      }}>
        <button
          onClick={() => setViewMode('grouped')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: viewMode === 'grouped' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
            backgroundColor: viewMode === 'grouped' ? '#eff6ff' : '#fff',
            cursor: 'pointer',
            fontWeight: viewMode === 'grouped' ? 600 : 400,
          }}
        >
          📊 Grouped View
        </button>
        <button
          onClick={() => setViewMode('individual')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: viewMode === 'individual' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
            backgroundColor: viewMode === 'individual' ? '#eff6ff' : '#fff',
            cursor: 'pointer',
            fontWeight: viewMode === 'individual' ? 600 : 400,
          }}
        >
          📋 Individual Cards
        </button>
      </div>

      {/* SubSection Header - passa groupByProtocol baseado no modo */}
      <LendingSubSectionHeader 
        data={lendingData} 
        groupByProtocol={viewMode === 'grouped'} 
      />

      {/* Conteúdo */}
      {viewMode === 'grouped' ? (
        <LendingGroupedView data={lendingData} />
      ) : (
        <LendingCards data={lendingData} />
      )}
    </div>
  );
};

/**
 * Exemplo 3: Com Filtros e Ordenação
 * Adiciona funcionalidades de filtragem e ordenação
 */
export const ExemploComFiltros = ({ lendingData }) => {
  const [viewMode, setViewMode] = useState('grouped');
  const [sortBy, setSortBy] = useState('protocol'); // 'protocol', 'healthFactor', 'value'
  const [filterHealthFactor, setFilterHealthFactor] = useState('all'); // 'all', 'risk', 'warning', 'healthy'

  // Filtrar por Health Factor
  const filteredData = lendingData.filter(item => {
    const hf = item.additionalData?.healthFactor || 
               item.additionalInfo?.healthFactor || 
               null;
    
    if (filterHealthFactor === 'all') return true;
    if (filterHealthFactor === 'risk' && hf !== null && hf < 1.5) return true;
    if (filterHealthFactor === 'warning' && hf !== null && hf >= 1.5 && hf < 2) return true;
    if (filterHealthFactor === 'healthy' && hf !== null && hf >= 2) return true;
    return false;
  });

  // Ordenar
  const sortedData = [...filteredData].sort((a, b) => {
    if (sortBy === 'protocol') {
      const protocolA = (a.position?.protocol?.name || a.protocol?.name || '').toLowerCase();
      const protocolB = (b.position?.protocol?.name || b.protocol?.name || '').toLowerCase();
      return protocolA.localeCompare(protocolB);
    }
    
    if (sortBy === 'healthFactor') {
      const hfA = a.additionalData?.healthFactor || a.additionalInfo?.healthFactor || 0;
      const hfB = b.additionalData?.healthFactor || b.additionalInfo?.healthFactor || 0;
      return hfA - hfB; // Menor primeiro (mais risco)
    }
    
    if (sortBy === 'value') {
      const getPositionValue = (item) => {
        const tokens = item.position?.tokens || item.tokens || [];
        return tokens.reduce((sum, token) => {
          return sum + Math.abs(token.financials?.totalPrice || token.totalPrice || 0);
        }, 0);
      };
      return getPositionValue(b) - getPositionValue(a); // Maior primeiro
    }
    
    return 0;
  });

  return (
    <div>
      {/* Header */}
      <LendingSectionHeader data={sortedData} />

      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        {/* View Mode Toggle */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setViewMode('grouped')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: viewMode === 'grouped' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
              backgroundColor: viewMode === 'grouped' ? '#eff6ff' : '#fff',
              cursor: 'pointer',
              fontWeight: viewMode === 'grouped' ? 600 : 400,
            }}
          >
            📊 Grouped
          </button>
          <button
            onClick={() => setViewMode('individual')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: viewMode === 'individual' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
              backgroundColor: viewMode === 'individual' ? '#eff6ff' : '#fff',
              cursor: 'pointer',
              fontWeight: viewMode === 'individual' ? 600 : 400,
            }}
          >
            📋 Individual
          </button>
        </div>

        {/* Health Factor Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Filter:</span>
          <select
            value={filterHealthFactor}
            onChange={(e) => setFilterHealthFactor(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              cursor: 'pointer',
            }}
          >
            <option value="all">All</option>
            <option value="risk">🔴 Risk (HF &lt; 1.5)</option>
            <option value="warning">🟡 Warning (HF 1.5-2)</option>
            <option value="healthy">🟢 Healthy (HF ≥ 2)</option>
          </select>
        </div>

        {/* Sort By */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              cursor: 'pointer',
            }}
          >
            <option value="protocol">Protocol</option>
            <option value="healthFactor">Health Factor (Risk First)</option>
            <option value="value">Total Value</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div style={{ 
        fontSize: 13, 
        color: '#6b7280', 
        marginBottom: 12 
      }}>
        Showing {sortedData.length} of {lendingData.length} positions
      </div>

      {/* SubSection Header */}
      <LendingSubSectionHeader 
        data={sortedData} 
        groupByProtocol={viewMode === 'grouped'} 
      />

      {/* Content */}
      {sortedData.length > 0 ? (
        viewMode === 'grouped' ? (
          <LendingGroupedView data={sortedData} />
        ) : (
          <LendingCards data={sortedData} />
        )
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#9ca3af',
        }}>
          No positions match your filters
        </div>
      )}
    </div>
  );
};

/**
 * Exemplo 4: Dados de Exemplo para Teste
 */
export const SAMPLE_LENDING_DATA = [
  // AAVE - Base (3 positions, HF: 2.35)
  {
    position: {
      protocol: { 
        name: 'Aave', 
        logo: 'https://cryptologos.cc/logos/aave-aave-logo.png' 
      },
      label: 'USDC Supply',
      tokens: [
        {
          symbol: 'USDC',
          type: 'supplied',
          chain: 'base',
          balance: 15000,
          logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
          financials: {
            totalPrice: 15000,
            balanceFormatted: 15000,
          },
        }
      ],
      supplyRate: 4.5,
    },
    additionalData: {
      healthFactor: 2.35,
      isCollateral: true,
      projections: [
        {
          type: 'apr',
          projection: {
            oneDay: 1.85,
            oneWeek: 12.95,
            oneMonth: 55.50,
            oneYear: 675.00
          }
        }
      ]
    }
  },
  {
    position: {
      protocol: { 
        name: 'Aave', 
        logo: 'https://cryptologos.cc/logos/aave-aave-logo.png' 
      },
      label: 'ETH Supply',
      tokens: [
        {
          symbol: 'ETH',
          type: 'supplied',
          chain: 'base',
          balance: 5.2,
          logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
          financials: {
            totalPrice: 10000,
            balanceFormatted: 5.2,
          },
        }
      ],
      supplyRate: 3.2,
    },
    additionalData: {
      healthFactor: 2.35,
      isCollateral: true,
      projections: [
        {
          type: 'apr',
          projection: {
            oneDay: 0.88,
            oneWeek: 6.16,
            oneMonth: 26.40,
            oneYear: 320.00
          }
        }
      ]
    }
  },
  {
    position: {
      protocol: { 
        name: 'Aave', 
        logo: 'https://cryptologos.cc/logos/aave-aave-logo.png' 
      },
      label: 'USDT Borrow',
      tokens: [
        {
          symbol: 'USDT',
          type: 'borrowed',
          chain: 'base',
          balance: -10000,
          logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
          financials: {
            totalPrice: -10000,
            balanceFormatted: 10000,
          },
        }
      ],
      borrowRate: 5.8,
    },
    additionalData: {
      healthFactor: 2.35,
      projections: [
        {
          type: 'apr',
          projection: {
            oneDay: -1.59,
            oneWeek: -11.13,
            oneMonth: -47.67,
            oneYear: -580.00
          }
        }
      ]
    }
  },

  // Kamino - Solana (2 positions, HF: 1.85)
  {
    position: {
      protocol: { 
        name: 'Kamino', 
        logo: 'https://kamino.finance/logo.png' 
      },
      label: 'SOL Supply',
      tokens: [
        {
          symbol: 'SOL',
          type: 'supplied',
          chain: 'solana',
          balance: 125,
          logo: 'https://cryptologos.cc/logos/solana-sol-logo.png',
          financials: {
            totalPrice: 25000,
            balanceFormatted: 125,
          },
        }
      ],
      supplyRate: 12.5,
    },
    additionalData: {
      healthFactor: 1.85,
      isCollateral: true,
      projections: [
        {
          type: 'apr',
          projection: {
            oneDay: 8.56,
            oneWeek: 59.92,
            oneMonth: 256.85,
            oneYear: 3125.00
          }
        }
      ]
    }
  },
  {
    position: {
      protocol: { 
        name: 'Kamino', 
        logo: 'https://kamino.finance/logo.png' 
      },
      label: 'USDC Borrow',
      tokens: [
        {
          symbol: 'USDC',
          type: 'borrowed',
          chain: 'solana',
          balance: -10000,
          logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
          financials: {
            totalPrice: -10000,
            balanceFormatted: 10000,
          },
        }
      ],
      borrowRate: 7.2,
    },
    additionalData: {
      healthFactor: 1.85,
      projections: [
        {
          type: 'apr',
          projection: {
            oneDay: -1.97,
            oneWeek: -13.79,
            oneMonth: -59.07,
            oneYear: -720.00
          }
        }
      ]
    }
  },

  // Compound - Ethereum (1 position, HF: 3.15)
  {
    position: {
      protocol: { 
        name: 'Compound', 
        logo: 'https://cryptologos.cc/logos/compound-comp-logo.png' 
      },
      label: 'DAI Supply',
      tokens: [
        {
          symbol: 'DAI',
          type: 'supplied',
          chain: 'ethereum',
          balance: 20000,
          logo: 'https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png',
          financials: {
            totalPrice: 20000,
            balanceFormatted: 20000,
          },
        }
      ],
      supplyRate: 5.5,
    },
    additionalData: {
      healthFactor: 3.15,
      isCollateral: true,
      projections: [
        {
          type: 'apr',
          projection: {
            oneDay: 3.01,
            oneWeek: 21.07,
            oneMonth: 90.30,
            oneYear: 1100.00
          }
        }
      ]
    }
  },
];

/**
 * Exemplo 5: Integração em Dashboard
 */
export const LendingDashboard = () => {
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 20 }}>
      <ExemploComFiltros lendingData={SAMPLE_LENDING_DATA} />
    </div>
  );
};

export default LendingDashboard;
