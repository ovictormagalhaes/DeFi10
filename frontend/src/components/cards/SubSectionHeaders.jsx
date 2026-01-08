import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeProvider.tsx';
import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import { formatPrice } from '../../utils/walletUtils';
import PeriodDropdown from '../PeriodDropdown.jsx';

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
    if (screenSize === 'mobile') return '1 1 100%';
    if (screenSize === 'tablet') return '1 1 calc(50% - 5px)';
    return '1 1 0';
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
      minWidth: screenSize === 'mobile' ? '100%' : screenSize === 'tablet' ? 'calc(50% - 5px)' : '120px',
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
        wordBreak: 'break-word',
        overflowWrap: 'break-word'
      }}>
        {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
        {value}
      </div>
    </div>
  );
};

/**
 * SubSectionItemWithDropdown - SubSection item with integrated dropdown selector for projections
 */
const SubSectionItemWithDropdown = ({ 
  label, 
  values, // Can be: 1) Object with keys {day, week, month, year}, 2) Object with type keys like {apr: {...}, aprHistorical: {...}}, or 3) Simple object like {apr: "5.00", aprHistorical: "6.00"}
  defaultType = 'apr',
  defaultPeriod = 'day',
  showTypeWhenSingle = true,
  color,
  flex = 1,
  screenSize 
}) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const [selectedType, setSelectedType] = useState(defaultType);
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);

  const periodOptions = [
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
  ];

  // Check if values contains projection types (apr, aprhistorical, etc.) or direct periods (day, week, etc.)
  const hasTypes = values && !values.day && !values.week && !values.month && !values.year;
  
  // Check if values are simple (not nested objects with periods)
  const currentTypeValues = hasTypes ? values[selectedType] : values;
  const isSimpleValue = typeof currentTypeValues === 'string' || typeof currentTypeValues === 'number';
  
  // Get available types
  const typeOptions = hasTypes 
    ? Object.keys(values).map(type => {
        const lowerType = type.toLowerCase();
        switch (lowerType) {
          case 'apr': return { key: type, label: 'APR' };
          case 'aprhistorical': return { key: type, label: 'APR Historical' };
          default: return { key: type, label: type.charAt(0).toUpperCase() + type.slice(1) };
        }
      })
    : [{ key: 'apr', label: 'APR' }];

  // Get current value based on selected type and period
  let currentValue, currentColor;
  if (isSimpleValue) {
    // Simple value - just use it directly with % suffix
    currentValue = currentTypeValues;
    const numValue = typeof currentValue === 'string' ? parseFloat(currentValue) : currentValue;
    currentColor = typeof color === 'function' ? color(currentValue) : color;
  } else {
    // Complex value with periods
    currentValue = currentTypeValues?.[selectedPeriod];
    currentColor = typeof color === 'function' ? color(currentValue) : color;
  }

  // Handler for type change
  const handleTypeChange = (displayLabel) => {
    const typeOption = typeOptions.find(t => t.label === displayLabel);
    if (typeOption) setSelectedType(typeOption.key);
  };

  // Handler for period change
  const handlePeriodChange = (displayLabel) => {
    const periodOption = periodOptions.find(p => p.label === displayLabel);
    if (periodOption) setSelectedPeriod(periodOption.key);
  };

  const showTypeDropdown = (typeOptions.length > 1 || showTypeWhenSingle) && hasTypes;
  const showPeriodDropdown = !isSimpleValue; // Only show period dropdown if not simple value

  const getFlexStyle = () => {
    if (screenSize === 'mobile') return '1 1 100%';
    if (screenSize === 'tablet') return '1 1 calc(50% - 5px)';
    return '1 1 0';
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
      minWidth: screenSize === 'mobile' ? '100%' : screenSize === 'tablet' ? 'calc(50% - 5px)' : '120px',
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      {/* Header: Label and Dropdown */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
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
        
        {/* Type Selector */}
        {showTypeDropdown && (
          <PeriodDropdown
            periods={typeOptions.map(t => t.label)}
            selectedPeriod={typeOptions.find(t => t.key === selectedType)?.label || typeOptions[0]?.label}
            onPeriodChange={handleTypeChange}
            compact={true}
          />
        )}

        {/* Period Selector - only show if not simple value */}
        {showPeriodDropdown && (
          <PeriodDropdown
            periods={periodOptions.map(p => p.label)}
            selectedPeriod={periodOptions.find(p => p.key === selectedPeriod)?.label || 'Day'}
            onPeriodChange={handlePeriodChange}
            compact={true}
          />
        )}
      </div>

      {/* Value Display */}
      <div style={{ 
        fontSize: 15, 
        fontWeight: 600, 
        color: currentColor || theme.textPrimary,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        wordBreak: 'break-word',
        overflowWrap: 'break-word'
      }}>
        {isSimpleValue ? `${currentValue}%` : maskValue(formatPrice(currentValue))}
      </div>
    </div>
  );
};

/**
 * LendingSubSectionHeader - Subsection for Lending details
 * Opcionalmente agrupa por Protocol + Chain para mostrar Health Factors únicos
 */
export const LendingSubSectionHeader = ({ data = [], groupByProtocol = false }) => {
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
  
  // Projection sums by type
  const projectionSums = {
    apr: { day: 0, week: 0, month: 0, year: 0 },
    aprHistorical: { day: 0, week: 0, month: 0, year: 0 },
  };

  // Se groupByProtocol, calcular Health Factor único por protocolo + chain
  let uniqueHealthFactors = new Map();

  data.forEach(item => {
    const position = item.position || item;
    const tokens = Array.isArray(position.tokens) ? position.tokens : [];
    
    const hf = position.additionalData?.healthFactor || 
               position.healthFactor ||
               item.additionalData?.healthFactor ||
               item.healthFactor;
    
    if (groupByProtocol && hf != null && isFinite(parseFloat(hf)) && parseFloat(hf) > 0) {
      // Agrupar por protocol + chain para não contar o mesmo HF múltiplas vezes
      const protocol = position.protocol || item.protocol || {};
      const chain = tokens[0]?.chain || 'unknown';
      const key = `${protocol.name || 'unknown'}-${chain}`;
      
      if (!uniqueHealthFactors.has(key)) {
        uniqueHealthFactors.set(key, parseFloat(hf));
      }
    } else if (!groupByProtocol && hf != null && isFinite(parseFloat(hf)) && parseFloat(hf) > 0) {
      healthFactorSum += parseFloat(hf);
      healthFactorCount++;
    }

    const supplyRate = position.supplyRate || position.apy || item.additionalData?.apy || 0;
    const borrowRate = position.borrowRate || position.borrowApy || item.additionalData?.apy || 0;
    
    // Support both new projections array and legacy single projection
    const projections = item.additionalData?.projections || 
                       item.additionalInfo?.projections || 
                       position?.projections ||
                       null;
    
    const legacyProjection = item.additionalInfo?.projection || 
                            item.additionalData?.projection || 
                            position.projection ||
                            null;
    
    // Process projections array (new format)
    if (projections && Array.isArray(projections)) {
      projections.forEach(proj => {
        const rawType = proj.type?.toLowerCase() || 'apr';
        // Map type to correct key in projectionSums
        const type = rawType === 'aprhistorical' ? 'aprHistorical' : rawType;
        const projection = proj.projection;
        
        if (projection && projectionSums[type]) {
          projectionSums[type].day += parseFloat(projection.oneDay || 0);
          projectionSums[type].week += parseFloat(projection.oneWeek || 0);
          projectionSums[type].month += parseFloat(projection.oneMonth || 0);
          projectionSums[type].year += parseFloat(projection.oneYear || 0);
        }
      });
    } 
    // Process legacy projection (backward compatibility)
    else if (legacyProjection) {
      projectionSums.apr.day += parseFloat(legacyProjection.oneDay || 0);
      projectionSums.apr.week += parseFloat(legacyProjection.oneWeek || 0);
      projectionSums.apr.month += parseFloat(legacyProjection.oneMonth || 0);
      projectionSums.apr.year += parseFloat(legacyProjection.oneYear || 0);
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

  // Calcular average Health Factor
  let avgHealthFactor = null;
  if (groupByProtocol && uniqueHealthFactors.size > 0) {
    const hfArray = Array.from(uniqueHealthFactors.values());
    avgHealthFactor = hfArray.reduce((sum, hf) => sum + hf, 0) / hfArray.length;
  } else if (!groupByProtocol && healthFactorCount > 0) {
    avgHealthFactor = healthFactorSum / healthFactorCount;
  }
  
  const netPosition = suppliedValue - borrowedValue;
  const avgApy = netPosition !== 0 ? (weightedApySum / netPosition) : null;

  // Check if any projection type has values
  const hasAprProjections = projectionSums.apr.day !== 0 || projectionSums.apr.week !== 0 || 
                           projectionSums.apr.month !== 0 || projectionSums.apr.year !== 0;
  const hasAprHistoricalProjections = projectionSums.aprHistorical.day !== 0 || projectionSums.aprHistorical.week !== 0 || 
                                 projectionSums.aprHistorical.month !== 0 || projectionSums.aprHistorical.year !== 0;
  const hasProjections = hasAprProjections || hasAprHistoricalProjections;

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
  ].filter(Boolean);

  // Build projection values object
  let projectionValues = {};
  const shouldShowTypeDropdown = false; // LendingCards uses showTypeWhenSingle: false
  
  if (hasAprProjections && hasAprHistoricalProjections) {
    // Multiple types: create nested structure
    projectionValues = {
      apr: projectionSums.apr,
      aprHistorical: projectionSums.aprHistorical,
    };
  } else if (hasAprProjections) {
    // Single type: use nested structure if showTypeWhenSingle is true, otherwise flat
    if (shouldShowTypeDropdown) {
      projectionValues = { apr: projectionSums.apr };
    } else {
      projectionValues = projectionSums.apr;
    }
  } else if (hasAprHistoricalProjections) {
    if (shouldShowTypeDropdown) {
      projectionValues = { aprHistorical: projectionSums.aprHistorical };
    } else {
      projectionValues = projectionSums.aprHistorical;
    }
  }

  const projectionItem = hasProjections ? {
    label: 'Projection',
    values: projectionValues,
    defaultType: 'apr',
    defaultPeriod: 'day',
    showTypeWhenSingle: false,
    color: (value) => value >= 0 ? '#10b981' : '#ef4444',
    flex: 1,
    withDropdown: true,
  } : null;

  if (items.length === 0 && !projectionItem) return null;

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
      {projectionItem && (
        <SubSectionItemWithDropdown
          key="projection"
          {...projectionItem}
          screenSize={screenSize}
        />
      )}
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
  
  // Historical APR tracking
  let totalAprHistoricalWeighted = 0;
  let totalWeightForAprHistorical = 0;
  
  // Projection sums by type
  const projectionSums = {
    apr: { day: 0, week: 0, month: 0, year: 0 },
    aprHistorical: { day: 0, week: 0, month: 0, year: 0 },
  };

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
    
    // APR Historical do backend
    const positionAprHistorical = position.additionalData?.aprHistorical || 
                                  position.aprHistorical || 
                                  item.aprHistorical ||
                                  item.additionalData?.aprHistorical;
    
    // Support both new projections array and legacy single projection
    const projections = item.additionalData?.projections || 
                       item.additionalInfo?.projections || 
                       position?.projections ||
                       null;
    
    const legacyProjection = item.additionalInfo?.projection || 
                            item.additionalData?.projection || 
                            position.projection ||
                            null;
    
    // Process projections array (new format)
    if (projections && Array.isArray(projections)) {
      projections.forEach(proj => {
        const rawType = proj.type?.toLowerCase() || 'apr';
        // Map type to correct key in projectionSums
        const type = rawType === 'aprhistorical' ? 'aprHistorical' : rawType;
        const projection = proj.projection;
        
        if (projection && projectionSums[type]) {
          projectionSums[type].day += parseFloat(projection.oneDay || 0);
          projectionSums[type].week += parseFloat(projection.oneWeek || 0);
          projectionSums[type].month += parseFloat(projection.oneMonth || 0);
          projectionSums[type].year += parseFloat(projection.oneYear || 0);
        }
      });
    } 
    // Process legacy projection (backward compatibility)
    else if (legacyProjection) {
      projectionSums.apr.day += parseFloat(legacyProjection.oneDay || 0);
      projectionSums.apr.week += parseFloat(legacyProjection.oneWeek || 0);
      projectionSums.apr.month += parseFloat(legacyProjection.oneMonth || 0);
      projectionSums.apr.year += parseFloat(legacyProjection.oneYear || 0);
    }
    
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
      
      if (tokenType.includes('supplied') || 
          tokenType.includes('supply') || 
          tokenType.includes('liquidity') ||
          tokenType.includes('deposit') ||
          !tokenType ||
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
    
    // APR Historical weighted by position liquidity value
    if (positionAprHistorical != null && !isNaN(positionAprHistorical) && positionLiquidityValue > 0) {
      totalAprHistoricalWeighted += positionAprHistorical * positionLiquidityValue;
      totalWeightForAprHistorical += positionLiquidityValue;
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

  const avgAPR = totalWeightForApr > 0 ? totalAprWeighted / totalWeightForApr : null;
  const avgAprHistorical = totalWeightForAprHistorical > 0 ? totalAprHistoricalWeighted / totalWeightForAprHistorical : null;
  
  // Check if any projection type has values
  const hasAprProjections = projectionSums.apr.day !== 0 || projectionSums.apr.week !== 0 || 
                           projectionSums.apr.month !== 0 || projectionSums.apr.year !== 0;
  const hasAprHistoricalProjections = projectionSums.aprHistorical.day !== 0 || projectionSums.aprHistorical.week !== 0 || 
                                 projectionSums.aprHistorical.month !== 0 || projectionSums.aprHistorical.year !== 0;
  const hasProjections = hasAprProjections || hasAprHistoricalProjections;

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
  ];
  
  // AVG APR item with dropdown to choose between APR and APR Historical
  const avgAprItem = (avgAPR !== null || avgAprHistorical !== null) ? {
    label: 'AVG',
    values: {
      apr: avgAPR !== null ? avgAPR.toFixed(2) : '0.00',
      aprHistorical: avgAprHistorical !== null ? avgAprHistorical.toFixed(2) : '0.00',
    },
    defaultType: 'apr',
    showTypeWhenSingle: true,
    color: (value) => {
      const numValue = parseFloat(value);
      return numValue > 10 ? '#10b981' : theme.textPrimary;
    },
    flex: 1,
    withDropdown: true,
  } : null;

  // Build projection values object
  let projectionValues = {};
  const shouldShowTypeDropdown = true; // From prop showTypeWhenSingle in projectionItem
  
  if (hasAprProjections && hasAprHistoricalProjections) {
    // Multiple types: create nested structure
    projectionValues = {
      apr: projectionSums.apr,
      aprHistorical: projectionSums.aprHistorical,
    };
  } else if (hasAprProjections) {
    // Single type: use nested structure if showTypeWhenSingle is true, otherwise flat
    if (shouldShowTypeDropdown) {
      projectionValues = { apr: projectionSums.apr };
    } else {
      projectionValues = projectionSums.apr;
    }
  } else if (hasAprHistoricalProjections) {
    if (shouldShowTypeDropdown) {
      projectionValues = { aprHistorical: projectionSums.aprHistorical };
    } else {
      projectionValues = projectionSums.aprHistorical;
    }
  }

  const projectionItem = hasProjections ? {
    label: 'Projection',
    values: projectionValues,
    defaultType: 'apr',
    defaultPeriod: 'day',
    showTypeWhenSingle: true, // PoolCards shows type dropdown even with single type
    color: (value) => value >= 0 ? '#10b981' : '#ef4444',
    flex: 1,
    withDropdown: true,
  } : null;

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
      {avgAprItem && (
        <SubSectionItemWithDropdown
          key="avgApr"
          {...avgAprItem}
          screenSize={screenSize}
        />
      )}
      {projectionItem && (
        <SubSectionItemWithDropdown
          key="projection"
          {...projectionItem}
          screenSize={screenSize}
        />
      )}
    </div>
  );
};


