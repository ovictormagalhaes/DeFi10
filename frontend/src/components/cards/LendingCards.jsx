import React from 'react';
import { useTheme } from '../../context/ThemeProvider.tsx';
import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import { useChainIcons } from '../../context/ChainIconsProvider.jsx';
import { formatPrice, formatBalance } from '../../utils/walletUtils';
import ProjectionSelector from '../ProjectionSelector.jsx';

/**
 * LendingCards - Card view for lending positions
 * @param {Array} data - Lending positions data
 */
const LendingCards = ({ data = [] }) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const { getIcon: getChainIcon } = useChainIcons();

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 20px',
        color: theme.textSecondary,
        fontSize: 14,
      }}>
        No lending positions found
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 20,
      padding: '8px 0',
      maxWidth: '100%',
      overflow: 'visible',
    }}>
      {data.map((item, index) => {
        const position = item.position || item;
        const protocol = position.protocol || item.protocol || {};
        const tokens = position.tokens || [];
        
        // Determine position type from position label or token type
        const positionLabel = position.label?.toLowerCase() || position.key?.toLowerCase() || '';
        const isBorrowPosition = positionLabel.includes('borrow') || 
                                 tokens.some(t => t.type?.toLowerCase() === 'borrowed');
        
        // Get supplied and borrowed tokens based on type field
        const suppliedTokens = tokens.filter(t => 
          t.type?.toLowerCase() === 'supplied' || 
          (!t.type && (t.balance || 0) > 0 && !t.debt)
        );
        const borrowedTokens = tokens.filter(t => 
          t.type?.toLowerCase() === 'borrowed' || 
          t.debt || 
          (t.balance || 0) < 0
        );
        
        const totalSupplied = suppliedTokens.reduce((sum, token) => {
          const price = token.financials?.totalPrice || token.totalPrice || 0;
          return sum + price;
        }, 0);
        const totalBorrowed = Math.abs(borrowedTokens.reduce((sum, token) => {
          const price = token.financials?.totalPrice || token.totalPrice || 0;
          return sum + price;
        }, 0));
        
        // Calculate rates
        const supplyRate = position.supplyRate || position.apy || item.additionalData?.apy || 0;
        const borrowRate = position.borrowRate || position.borrowApy || item.additionalData?.apy || 0;
        
        // Get main token and position type
        const mainToken = isBorrowPosition ? (borrowedTokens[0] || tokens[0]) : (suppliedTokens[0] || tokens[0]);
        const positionType = isBorrowPosition ? 'Borrow' : 'Supply';
        
        // Get projection data (support both new array format and legacy single projection)
        const projections = item.additionalData?.projections || item.additionalInfo?.projections || position?.projections || null;
        const projection = item.additionalInfo?.projection || item.additionalData?.projection || position.projection || null;
        
        // Get health factor
        const healthFactor = item.additionalData?.healthFactor || item.additionalInfo?.healthFactor || null;
        
        // Get collateral (boolean)
        const isCollateral = [
          position?.isCollateral,
          position?.IsCollateral,
          position?.additionalData?.isCollateral,
          position?.additionalData?.IsCollateral,
          position?.AdditionalData?.IsCollateral,
          position?.additionalInfo?.IsCollateral,
          position?.additional_info?.is_collateral,
          item?.additionalData?.IsCollateral,
          item?.additionalData?.isCollateral,
        ].some((v) => v === true);
        
        return (
          <div
            key={index}
            style={{
              backgroundColor: theme.bgPanel,
              border: `1px solid ${theme.border}`,
              borderRadius: 12,
              padding: 16,
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'visible',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.accent;
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.border;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Header - Token Icon, Protocol & Chain */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              {/* Left side: Token Icon */}
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                {mainToken?.logo && (
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: `2px solid ${theme.bgPanel}`,
                    backgroundColor: theme.bgPanel,
                    zIndex: 2,
                  }}>
                    <img
                      src={mainToken.logo}
                      alt={mainToken.symbol}
                      style={{ width: '100%', height: '100%', objectFit: 'fill' }}
                      onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                  </div>
                )}
              </div>

              {/* Right side: Protocol and Chain */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {/* Protocol */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {(protocol.logo || protocol.icon) && (
                    <img
                      src={protocol.logo || protocol.icon}
                      alt={protocol.name}
                      style={{ width: 16, height: 16, borderRadius: '50%' }}
                      onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary }}>
                    {protocol.name || 'Unknown'}
                  </span>
                </div>

                {/* Chain */}
                {mainToken?.chain && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getChainIcon(mainToken.chain) && (
                      <img
                        src={getChainIcon(mainToken.chain)}
                        alt={mainToken.chain}
                        style={{ width: 16, height: 16, borderRadius: '50%' }}
                        onError={(e) => e.currentTarget.style.display = 'none'}
                      />
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary }}>
                      {mainToken.chain.charAt(0).toUpperCase() + mainToken.chain.slice(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Token Title with Type Badge */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ 
                fontSize: 16,
                fontWeight: 700,
                color: theme.textPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                {mainToken?.symbol || 'Unknown'}
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  backgroundColor: isBorrowPosition ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: isBorrowPosition ? '#ef4444' : '#10b981',
                }}>
                  {positionType}
                </span>
              </div>
            </div>

            {/* Metrics */}
            <div style={{ flex: 1 }}>
              {/* Value (total in USD) */}
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}>
                <span style={{ 
                  fontSize: 13,
                  color: theme.textSecondary,
                }}>
                  Value
                </span>
                <span style={{ 
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.textPrimary,
                }}>
                  {maskValue(formatPrice(isBorrowPosition ? totalBorrowed : totalSupplied))}
                </span>
              </div>

              {/* Amount (quantity of tokens) */}
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}>
                <span style={{ 
                  fontSize: 13,
                  color: theme.textSecondary,
                }}>
                  Amount
                </span>
                <span style={{ 
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.textPrimary,
                }}>
                  {maskValue(
                    (mainToken?.financials?.amountFormatted ?? mainToken?.financials?.balanceFormatted ?? mainToken?.balance ?? 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6
                    })
                  )} {mainToken?.symbol || ''}
                </span>
              </div>

              {/* Health Factor */}
              {healthFactor != null && (
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}>
                  <span style={{ fontSize: 13, color: theme.textSecondary }}>
                    Health Factor
                  </span>
                  <span style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: healthFactor >= 2 ? '#10b981' : healthFactor >= 1.5 ? '#f59e0b' : '#ef4444'
                  }}>
                    {healthFactor.toFixed(2)}
                  </span>
                </div>
              )}

              {/* APY */}
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}>
                <span style={{ fontSize: 13, color: theme.textSecondary }}>
                  APY
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>
                  {isBorrowPosition 
                    ? (borrowRate ? `${borrowRate.toFixed(2)}%` : '0.00%')
                    : (supplyRate ? `${supplyRate.toFixed(2)}%` : '0.00%')
                  }
                </span>
              </div>

              {/* Collateral - sempre renderiza para manter espaçamento consistente */}
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: projection ? 10 : 0,
                visibility: isBorrowPosition ? 'hidden' : 'visible',
              }}>
                <span style={{ fontSize: 13, color: theme.textSecondary }}>
                  Collateral
                </span>
                <div style={{
                  width: 36,
                  height: 18,
                  borderRadius: 12,
                  backgroundColor: isCollateral ? theme.accent : theme.bgSecondary,
                  border: `1px solid ${isCollateral ? theme.accent : theme.border}`,
                  position: 'relative',
                  transition: 'all 0.2s ease',
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    transform: `translate(${isCollateral ? '18px' : '2px'}, -50%)`,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                  }} />
                </div>
              </div>

              {/* Projection */}
              {(projections || projection) && (() => {
                // Handle new projections array format
                if (projections && Array.isArray(projections) && projections.length > 0) {
                  return (
                    <div style={{
                      marginTop: 10,
                    }}>
                      <ProjectionSelector 
                        projections={projections} 
                        defaultType="apy" 
                        defaultPeriod="Day"
                        showTypeWhenSingle={false}
                        disableDropdownHoverEffects={true}
                        dropdownButtonStyle={{
                          fontSize: 13,
                          fontWeight: 400,
                          fontFamily: 'inherit',
                          color: 'rgb(162, 169, 181)',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: 0,
                          padding: 0,
                          transition: 'none',
                        }}
                      />
                    </div>
                  );
                }
                
                // Handle legacy single projection format
                if (projection) {
                  // Check if at least one projection value exists
                  const hasProjection = projection.oneDay != null || projection.oneWeek != null || 
                                       projection.oneMonth != null || projection.oneYear != null;
                  
                  if (!hasProjection) return null;
                  
                  return (
                    <div style={{
                      marginTop: 10,
                    }}>
                      <ProjectionSelector 
                        projection={projection} 
                        defaultPeriod="Day"
                        showTypeWhenSingle={false}
                        disableDropdownHoverEffects={true}
                        dropdownButtonStyle={{
                          fontSize: 13,
                          fontWeight: 400,
                          fontFamily: 'inherit',
                          color: 'rgb(162, 169, 181)',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: 0,
                          padding: 0,
                          transition: 'none',
                        }}
                      />
                    </div>
                  );
                }
                
                return null;
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LendingCards;
