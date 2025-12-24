import React from 'react';
import { useTheme } from '../../context/ThemeProvider.tsx';
import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import { useChainIcons } from '../../context/ChainIconsProvider.jsx';
import { formatPrice, formatBalance } from '../../utils/walletUtils';

/**
 * LendingCards - Card view for lending positions
 * @param {Array} data - Lending positions data
 */
const LendingCards = ({ data = [] }) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const { getIcon: getChainIcon } = useChainIcons();
  const [expandedProjections, setExpandedProjections] = React.useState({});

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
      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
      gap: 20,
      padding: '8px 0',
      maxWidth: '100%',
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
        
        // Get projection data
        const projection = item.additionalInfo?.projection || item.additionalData?.projection || position.projection || null;
        
        // Get health factor
        const healthFactor = item.additionalData?.healthFactor || item.additionalInfo?.healthFactor || null;
        
        // Check if projection is expanded
        const isProjectionExpanded = expandedProjections[index] || false;
        
        // Toggle projection expansion
        const toggleProjectionExpansion = () => {
          setExpandedProjections(prev => ({ ...prev, [index]: !prev[index] }));
        };
        
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
                  fontWeight: 700,
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
                  fontWeight: 700,
                  color: theme.textPrimary,
                }}>
                  {maskValue(formatPrice(isBorrowPosition ? totalBorrowed : totalSupplied))}
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
                    fontWeight: 700, 
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
                marginBottom: projection ? 10 : 0,
              }}>
                <span style={{ fontSize: 14, color: theme.textSecondary }}>
                  APY
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: theme.textPrimary }}>
                  {isBorrowPosition 
                    ? (borrowRate ? `${borrowRate.toFixed(2)}%` : '0.00%')
                    : (supplyRate ? `${supplyRate.toFixed(2)}%` : '0.00%')
                  }
                </span>
              </div>

              {/* Projection */}
              {projection && (() => {
                const projections = [
                  { label: '1 Day', value: projection.oneDay, key: 'oneDay' },
                  { label: '1 Week', value: projection.oneWeek, key: 'oneWeek' },
                  { label: '1 Month', value: projection.oneMonth, key: 'oneMonth' },
                  { label: '1 Year', value: projection.oneYear, key: 'oneYear' },
                ].filter(p => p.value != null);
                
                if (projections.length === 0) return null;
                
                return (
                  <div style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: `1px solid ${theme.border}`,
                  }}>
                    {/* Projection Header - Always Visible */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                      cursor: 'pointer',
                    }}
                    onClick={toggleProjectionExpansion}
                    >
                      <span style={{ fontSize: 14, color: theme.textSecondary }}>Projection</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg 
                          width="12" 
                          height="12" 
                          viewBox="0 0 12 12" 
                          fill="none"
                          style={{
                            transform: isProjectionExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                          }}
                        >
                          <path 
                            d="M3 5L6 8L9 5" 
                            stroke={theme.textSecondary} 
                            strokeWidth="1.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Projection Details - Collapsible */}
                    {isProjectionExpanded && (
                      <div style={{
                        backgroundColor: theme.bgSecondary,
                        borderRadius: 8,
                        padding: '6px 12px 12px 12px',
                        marginTop: 4,
                      }}>
                        {projections.map((proj, idx) => (
                          <div key={proj.key} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: idx < projections.length - 1 ? 6 : 0,
                          }}>
                            <span style={{ fontSize: 12, color: theme.textSecondary }}>
                              {proj.label}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary }}>
                              {maskValue(formatPrice(proj.value))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LendingCards;
