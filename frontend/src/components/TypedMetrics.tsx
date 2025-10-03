import React from 'react';
import MiniMetric from './MiniMetric.jsx';
import { useMaskValues } from '../context/MaskValuesContext';
import { useTheme } from '../context/ThemeProvider';
import { formatPrice } from '../utils/walletUtils.js';
import type { WalletItem, Range } from '../types/wallet';
import { extractHealthFactor, extractPoolFees24h, extractPoolRange } from '../types/wallet';

interface TypedMetricsProps {
  items: WalletItem[];
}

// Análise avançada com TypeScript type-safe
const AdvancedAnalysis: React.FC<{ items: WalletItem[] }> = ({ items }) => {
  const { maskValue } = useMaskValues();

  // Análise de Risk Profile usando type guards
  const riskAnalysis = React.useMemo(() => {
    const liquidityPools = items.filter((item): item is WalletItem & { type: "LiquidityPool" } => 
      item.type === "LiquidityPool"
    );
    const lendingPositions = items.filter((item): item is WalletItem & { type: "LendingAndBorrowing" } => 
      item.type === "LendingAndBorrowing"
    );

    // Análise de ranges dos pools (type-safe)
    const rangeAnalysis = liquidityPools.map(pool => {
      const range = extractPoolRange(pool);
      const fees24h = extractPoolFees24h(pool);
      const value = pool.totalPrice || pool.totalValueUsd || 0;
      
      return {
        pool,
        range,
        fees24h: fees24h || 0,
        value: Number(value),
        isInRange: range?.inRange || false,
        riskScore: range && !range.inRange ? (value / 1000) : 0
      };
    });

    // Análise de health factors (type-safe)
    const healthAnalysis = lendingPositions.map(position => {
      const healthFactor = extractHealthFactor(position);
      const value = position.totalPrice || position.totalValueUsd || 0;
      
      return {
        position,
        healthFactor: healthFactor || 0,
        value: Number(value),
        riskScore: healthFactor && healthFactor < 1.5 ? (Number(value) / 100) : 0
      };
    });

    // Cálculos agregados type-safe
    const totalRisk = [...rangeAnalysis, ...healthAnalysis].reduce((sum, item) => sum + item.riskScore, 0);
    const totalValue = items.reduce((sum, item) => sum + Number(item.totalPrice || item.totalValueUsd || 0), 0);
    const riskPercentage = totalValue > 0 ? (totalRisk / totalValue) * 100 : 0;

    return {
      totalPositions: items.length,
      liquidityPoolsCount: liquidityPools.length,
      lendingPositionsCount: lendingPositions.length,
      outOfRangePools: rangeAnalysis.filter(p => !p.isInRange).length,
      lowHealthFactorPositions: healthAnalysis.filter(p => p.healthFactor > 0 && p.healthFactor < 1.5).length,
      totalRiskScore: totalRisk,
      riskPercentage,
      averagePoolFees: rangeAnalysis.length > 0 
        ? rangeAnalysis.reduce((sum, p) => sum + p.fees24h, 0) / rangeAnalysis.length 
        : 0,
      averageHealthFactor: healthAnalysis.length > 0 
        ? healthAnalysis.reduce((sum, p) => sum + p.healthFactor, 0) / healthAnalysis.length 
        : 0
    };
  }, [items]);

  // Diversification Analysis
  const diversificationAnalysis = React.useMemo(() => {
    const protocolDistribution = items.reduce((acc, item) => {
      const protocol = item.protocol?.name || 'Unknown';
      const value = Number(item.totalPrice || item.totalValueUsd || 0);
      
      if (!acc[protocol]) acc[protocol] = 0;
      acc[protocol] += value;
      
      return acc;
    }, {} as Record<string, number>);

    const typeDistribution = items.reduce((acc, item) => {
      const value = Number(item.totalPrice || item.totalValueUsd || 0);
      
      if (!acc[item.type]) acc[item.type] = 0;
      acc[item.type] += value;
      
      return acc;
    }, {} as Record<string, number>);

    const protocolCount = Object.keys(protocolDistribution).length;
    const typeCount = Object.keys(typeDistribution).length;
    
    // Herfindahl-Hirschman Index for concentration
    const totalValue = Object.values(protocolDistribution).reduce((sum, value) => sum + value, 0);
    const hhi = totalValue > 0 
      ? Object.values(protocolDistribution)
          .map(value => Math.pow(value / totalValue, 2))
          .reduce((sum, squared) => sum + squared, 0)
      : 0;
    
    return {
      protocolCount,
      typeCount,
      concentrationIndex: hhi,
      diversificationScore: Math.max(0, 100 - (hhi * 100)), // Higher is more diversified
      topProtocol: Object.entries(protocolDistribution).sort(([,a], [,b]) => b - a)[0]
    };
  }, [items]);

  return (
    <div style={{ marginTop: 24 }}>
      <h4 style={{ marginBottom: 16 }}>📊 Análise Avançada TypeScript</h4>
      
      {/* Risk Analysis */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: 12, 
        marginBottom: 16 
      }}>
        <div style={{ padding: 12, border: '1px solid #e0e0e0', borderRadius: 8 }}>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>Risk Score</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: riskAnalysis.riskPercentage > 10 ? '#f44336' : '#4caf50' }}>
            {riskAnalysis.riskPercentage.toFixed(2)}%
          </div>
        </div>
        
        <div style={{ padding: 12, border: '1px solid #e0e0e0', borderRadius: 8 }}>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>Out of Range</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: riskAnalysis.outOfRangePools > 0 ? '#ff9800' : '#4caf50' }}>
            {riskAnalysis.outOfRangePools}/{riskAnalysis.liquidityPoolsCount}
          </div>
        </div>
        
        <div style={{ padding: 12, border: '1px solid #e0e0e0', borderRadius: 8 }}>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>Low Health Factor</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: riskAnalysis.lowHealthFactorPositions > 0 ? '#f44336' : '#4caf50' }}>
            {riskAnalysis.lowHealthFactorPositions}
          </div>
        </div>
        
        <div style={{ padding: 12, border: '1px solid #e0e0e0', borderRadius: 8 }}>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>Diversification</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
            {diversificationAnalysis.diversificationScore.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Detailed Analysis */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: 16,
        fontSize: '0.875rem'
      }}>
        <div style={{ padding: 12, background: '#f9f9f9', borderRadius: 8 }}>
          <h5 style={{ margin: '0 0 8px 0' }}>📈 Performance Metrics</h5>
          <div>Avg Pool Fees: {maskValue(formatPrice(riskAnalysis.averagePoolFees))}</div>
          <div>Avg Health Factor: {riskAnalysis.averageHealthFactor.toFixed(2)}</div>
          <div>Protocols: {diversificationAnalysis.protocolCount}</div>
          <div>Asset Types: {diversificationAnalysis.typeCount}</div>
        </div>
        
        <div style={{ padding: 12, background: '#f9f9f9', borderRadius: 8 }}>
          <h5 style={{ margin: '0 0 8px 0' }}>⚡ TypeScript Benefits</h5>
          <div>✅ Type-safe risk calculations</div>
          <div>✅ Automated null checks</div>
          <div>✅ Guaranteed data structure</div>
          <div>✅ Compile-time validation</div>
        </div>
      </div>
    </div>
  );
};

/**
 * Componente que demonstra o uso das tipagens TypeScript
 * Elimina gambiarras de verificação de tipos
 */
export const TypedMetrics: React.FC<TypedMetricsProps> = ({ items }) => {
  const { maskValue } = useMaskValues();
  const { theme } = useTheme();

  // Calcular estatísticas usando funções tipadas - SEM GAMBIARRAS!
  const stats = {
    totalItems: items.length,
    walletItems: items.filter(item => item.type === "Wallet").length,
    liquidityPools: items.filter(item => item.type === "LiquidityPool").length,
    lendingPositions: items.filter(item => item.type === "LendingAndBorrowing").length,
    
    // Health Factor - acesso direto e type-safe
    healthFactor: items
      .map(extractHealthFactor)
      .find(hf => hf !== null),
    
    // Total Fees 24h - acesso direto e type-safe  
    totalFees24h: items
      .map(extractPoolFees24h)
      .filter(fees => fees !== null)
      .reduce((sum, fees) => sum + (fees || 0), 0),
    
    // Pools em range - acesso direto e type-safe
    poolsInRange: items
      .map(extractPoolRange)
      .filter(range => range !== null)
      .filter(range => range?.inRange).length,
    
    // Total value dos tokens
    totalValue: items.reduce((total, item) => {
      return total + item.position.tokens.reduce((sum, token) => {
        return sum + (token.financials.totalPrice || 0);
      }, 0);
    }, 0)
  };

  return (
    <div className="typed-metrics-wrapper">
      <h3>📊 Estatísticas Tipadas (Sem Gambiarras!)</h3>
      
      <div className="mini-metrics">
        <MiniMetric 
          label="Total Items" 
          value={stats.totalItems} 
          tooltip="Total number of wallet items"
        />
        
        <MiniMetric 
          label="Wallet" 
          value={stats.walletItems} 
          tooltip="Wallet token items"
        />
        
        <MiniMetric 
          label="Liquidity" 
          value={stats.liquidityPools} 
          tooltip="Liquidity pool positions"
        />
        
        <MiniMetric 
          label="Lending" 
          value={stats.lendingPositions} 
          tooltip="Lending and borrowing positions"
        />
        
        {stats.healthFactor && (
          <MiniMetric 
            label="Health Factor" 
            value={stats.healthFactor.toFixed(2)} 
            tooltip="Average health factor"
            accent={stats.healthFactor < 1.5}
          />
        )}
        
        {stats.totalFees24h > 0 && (
          <MiniMetric 
            label="Fees 24h" 
            value={maskValue(formatPrice(stats.totalFees24h))} 
            tooltip="Total fees earned in 24h" 
          />
        )}
        
        {stats.poolsInRange > 0 && (
          <MiniMetric 
            label="In Range" 
            value={stats.poolsInRange} 
            tooltip="Pools currently in range" 
          />
        )}
        
        <MiniMetric 
          label="Total Value" 
          value={maskValue(formatPrice(stats.totalValue))} 
          tooltip="Total portfolio value"
          accent
        />
      </div>

      {/* Análise Avançada TypeScript */}
      <AdvancedAnalysis items={items} />

      <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
        <h4>🎯 Benefícios das Tipagens:</h4>
        <ul style={{ fontSize: 12, lineHeight: 1.4 }}>
          <li>✅ <strong>extractHealthFactor(item)</strong> - acesso direto ao healthFactor</li>
          <li>✅ <strong>extractPoolFees24h(item)</strong> - acesso direto ao fees24h</li>
          <li>✅ <strong>extractPoolRange(item)</strong> - acesso direto ao range</li>
          <li>✅ <strong>item.type === "LiquidityPool"</strong> - type guards nativos</li>
          <li>✅ <strong>item.position.tokens</strong> - estrutura garantida pelo TypeScript</li>
          <li>❌ <strong>Não mais:</strong> positionLike?.additionalData || positionLike.position?.additionalData</li>
        </ul>
      </div>
    </div>
  );
};

export default TypedMetrics;