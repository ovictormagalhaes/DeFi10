import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeProvider.tsx';
import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import { formatPrice } from '../../utils/walletUtils';

// Hook to detect screen sizes
const useScreenSize = () => {
  const [screenSize, setScreenSize] = useState('desktop');

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < 640) setScreenSize('mobile');
      else if (width < 1024) setScreenSize('tablet');
      else setScreenSize('desktop');
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  return screenSize;
};

/**
 * SubSectionItem - Individual item in the subsection
 */
const SubSectionItem = ({ 
  label, 
  value, 
  icon, 
  color, 
  flex = 1,
  screenSize 
}) => {
  const { theme } = useTheme();

  // Calcular flex baseado no screenSize
  const getFlexStyle = () => {
    if (screenSize === 'mobile') return '1 1 100%'; // 1 por linha
    if (screenSize === 'tablet') return '1 1 calc((100% - 10px) / 2)'; // 2 por linha
    return '1 1 0'; // Desktop: distribui igualmente
  };

  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '8px 14px',
      backgroundColor: theme.bgPanel || theme.bgSecondary,
      border: `1px solid ${theme.border}`,
      borderRadius: 8,
      flex: getFlexStyle(),
      boxSizing: 'border-box',
    }}>
      <div style={{ 
        fontSize: 11, 
        color: theme.textSecondary, 
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {label}
      </div>
      <div style={{ 
        fontSize: 15, 
        fontWeight: 600, 
        color: color || theme.textPrimary,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap'
      }}>
        {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
        {value}
      </div>
    </div>
  );
};

/**
 * LendingSubSectionHeader - Subsection for Lending details
 */
export const LendingSubSectionHeader = ({ data = [] }) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const screenSize = useScreenSize();

  // Calculate metrics
  let healthFactorSum = 0;
  let healthFactorCount = 0;
  let suppliedValue = 0;
  let borrowedValue = 0;
  let weightedApySum = 0;
  let weightForApy = 0;
  
  // Projeções do backend (soma de todas as posições)
  let dailyProjectionSum = 0;
  let weeklyProjectionSum = 0;
  let monthlyProjectionSum = 0;
  let yearlyProjectionSum = 0;

  data.forEach(item => {
    const position = item.position || item;
    const tokens = Array.isArray(position.tokens) ? position.tokens : [];
    
    // Health Factor - buscar em todos lugares possíveis
    const hf = position.additionalData?.healthFactor || 
               position.healthFactor ||
               item.additionalData?.healthFactor ||
               item.healthFactor;
    
    if (hf != null && isFinite(parseFloat(hf)) && parseFloat(hf) > 0) {
      healthFactorSum += parseFloat(hf);
      healthFactorCount++;
    }

    // APY - usar a mesma lógica do LendingCards
    const supplyRate = position.supplyRate || position.apy || item.additionalData?.apy || 0;
    const borrowRate = position.borrowRate || position.borrowApy || item.additionalData?.apy || 0;
    
    // Projeções do backend - usar os mesmos caminhos do LendingCards
    const projection = item.additionalInfo?.projection || 
                       item.additionalData?.projection || 
                       position.projection ||
                       null;
    
    if (projection) {
      const daily = parseFloat(projection.oneDay || 0);
      const weekly = parseFloat(projection.oneWeek || 0);
      const monthly = parseFloat(projection.oneMonth || 0);
      const yearly = parseFloat(projection.oneYear || 0);
      
      dailyProjectionSum += daily;
      weeklyProjectionSum += weekly;
      monthlyProjectionSum += monthly;
      yearlyProjectionSum += yearly;
    }
    
    // Processar tokens
    tokens.forEach(token => {
      const tokenValue = parseFloat(
        token.totalPrice || 
        token.financials?.totalPrice || 
        token.balanceUSD ||
        0
      );
      
      const tokenType = (token.type || '').toLowerCase();
      const tokenApy = token.apy || token.apr;
      
      if (tokenType.includes('supplied') || tokenType.includes('supply') || tokenType.includes('deposit')) {
        suppliedValue += tokenValue;
        
        // Usar supplyRate para supply tokens
        if (supplyRate != null && !isNaN(supplyRate) && tokenValue > 0 && supplyRate !== 0) {
          weightedApySum += supplyRate * tokenValue;
        }
      } else if (tokenType.includes('borrowed') || tokenType.includes('borrow') || tokenType.includes('debt')) {
        borrowedValue += tokenValue;
        
        // Usar borrowRate para borrow tokens (usar valor absoluto ao subtrair)
        if (borrowRate != null && !isNaN(borrowRate) && tokenValue > 0 && borrowRate !== 0) {
          const borrowCost = Math.abs(borrowRate) * tokenValue;
          weightedApySum -= borrowCost; // Subtrair o custo (sempre positivo)
        }
      }
    });
  });

  const avgHealthFactor = healthFactorCount > 0 ? healthFactorSum / healthFactorCount : null;
  
  // Calcular APY médio baseado na posição líquida
  // APY = (Supply Value * Supply Rate - Borrow Value * Borrow Rate) / Net Position
  const netPosition = suppliedValue - borrowedValue;
  const avgApy = netPosition !== 0 ? (weightedApySum / netPosition) : null;

  // Projeções totais
  const totalProjections = {
    dailyProjectionSum, 
    weeklyProjectionSum, 
    monthlyProjectionSum, 
    yearlyProjectionSum,
    'Has projections': dailyProjectionSum !== 0 || weeklyProjectionSum !== 0 || monthlyProjectionSum !== 0 || yearlyProjectionSum !== 0
  };

  const items = [
    avgHealthFactor !== null && {
      label: 'Health Factor',
      value: avgHealthFactor.toFixed(2),
      flex: 1,
      color: avgHealthFactor > 2 ? '#10b981' : avgHealthFactor > 1.5 ? '#f59e0b' : '#ef4444',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      ),
    },
    avgApy !== null && avgApy !== 0 && {
      label: 'Avg APY',
      value: `${avgApy >= 0 ? '+' : ''}${avgApy.toFixed(2)}%`,
      flex: 1,
      color: avgApy >= 0 ? '#10b981' : '#ef4444',
    },
    dailyProjectionSum !== 0 && {
      label: 'Day',
      value: maskValue(formatPrice(dailyProjectionSum)),
      flex: 1,
      color: dailyProjectionSum >= 0 ? '#10b981' : '#ef4444',
    },
    weeklyProjectionSum !== 0 && {
      label: 'Week',
      value: maskValue(formatPrice(weeklyProjectionSum)),
      flex: 1,
      color: weeklyProjectionSum >= 0 ? '#10b981' : '#ef4444',
    },
    monthlyProjectionSum !== 0 && {
      label: 'Month',
      value: maskValue(formatPrice(monthlyProjectionSum)),
      flex: 1,
      color: monthlyProjectionSum >= 0 ? '#10b981' : '#ef4444',
    },
    yearlyProjectionSum !== 0 && {
      label: 'Year',
      value: maskValue(formatPrice(yearlyProjectionSum)),
      flex: 1,
      color: yearlyProjectionSum >= 0 ? '#10b981' : '#ef4444',
    },
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
    }}>
      {items.map((item, index) => (
        <SubSectionItem
          key={index}
          {...item}
          screenSize={screenSize}
        />
      ))}
    </div>
  );
};

/**
 * LiquiditySubSectionHeader - Subsection for Liquidity Pools details
 */
export const LiquiditySubSectionHeader = ({ data = [] }) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const screenSize = useScreenSize();

  // Calculate metrics
  let inRangeValue = 0;
  let outOfRangeValue = 0;
  let inRangeCount = 0;
  let outOfRangeCount = 0;
  let totalUncollectedFees = 0;
  let totalLiquidity = 0;
  let aprSum = 0;
  let aprCount = 0;
  let totalAprWeighted = 0;
  let totalWeightForApr = 0;

  data.forEach(item => {
    const position = item.position || item;
    const tokens = Array.isArray(position.tokens) ? position.tokens : [];
    
    // APR do backend
    const positionApr = position.additionalData?.apr || 
                        position.apr || 
                        item.apr ||
                        item.additionalData?.apr ||
                        position.additionalData?.apy ||
                        position.apy;
    
    // Check range status - IMPORTANTE: item.additionalData vem primeiro!
    const rangeData = item.additionalData?.range || 
                      item.additionalInfo?.range || 
                      position.additionalData?.range || 
                      position.range || 
                      position.rangeData ||
                      item.range;
    
    const isInRange = rangeData?.inRange ?? (
      rangeData && rangeData.current != null && rangeData.lower != null && rangeData.upper != null &&
      rangeData.current >= rangeData.lower && rangeData.current <= rangeData.upper
    );

    // Calculate position liquidity value
    let positionLiquidityValue = 0;
    let positionFeesValue = 0;

    tokens.forEach(token => {
      const tokenValue = parseFloat(
        token.totalPrice || 
        token.financials?.totalPrice || 
        token.balanceUSD ||
        0
      );
      
      const tokenType = (token.type || '').toLowerCase();
      
      // Para liquidez, aceitar vários tipos de token
      if (tokenType.includes('supplied') || 
          tokenType.includes('supply') || 
          tokenType.includes('liquidity') ||
          tokenType.includes('deposit') ||
          !tokenType || // tokens sem tipo também podem ser liquidez
          tokenType === '') {
        positionLiquidityValue += tokenValue;
      }
      
      // Fees separadas
      if (tokenType.includes('uncollectedfee') || 
          tokenType.includes('reward') ||
          tokenType.includes('fee')) {
        positionFeesValue += tokenValue;
      }
    });

    totalLiquidity += positionLiquidityValue;
    totalUncollectedFees += positionFeesValue;
    
    // APR weighted by position liquidity value
    if (positionApr != null && !isNaN(positionApr) && positionLiquidityValue > 0) {
      totalAprWeighted += positionApr * positionLiquidityValue;
      totalWeightForApr += positionLiquidityValue;
      aprSum += positionApr;
      aprCount++;
    }

    // Count in range vs out of range baseado em rangeData.inRange
    if (rangeData) {
      if (isInRange) {
        inRangeCount++;
      } else {
        outOfRangeCount++;
      }
    }
  });

  // APR do backend (média ponderada pelo valor de liquidez)
  const avgAPR = totalWeightForApr > 0 ? totalAprWeighted / totalWeightForApr : null;

  const items = [
    {
      label: 'In Range',
      value: inRangeCount.toString(),
      flex: 1.2,
      color: '#10b981',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ),
    },
    {
      label: 'Out of Range',
      value: outOfRangeCount.toString(),
      flex: 1.2,
      color: '#ef4444',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
    },
    {
      label: 'AVG APR',
      value: avgAPR !== null ? `${avgAPR.toFixed(2)}%` : '0.00%',
      flex: 1,
      color: avgAPR > 10 ? '#10b981' : theme.textPrimary,
    },
  ];

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 16,
    }}>
      {items.map((item, index) => (
        <SubSectionItem
          key={index}
          {...item}
          screenSize={screenSize}
        />
      ))}
    </div>
  );
};
