import React from 'react';
import { useTheme } from '../../context/ThemeProvider.tsx';
import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import { useChainIcons } from '../../context/ChainIconsProvider.jsx';
import { formatPrice, formatBalance } from '../../utils/walletUtils';
import { filterSuppliedTokens, filterGovernanceTokens } from '../../utils/tokenFilters';

/**
 * LockingCards - Card view for locked token positions
 * @param {Array} data - Locking positions data
 */
const LockingCards = ({ data = [] }) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const { getIcon: getChainIcon } = useChainIcons();
  const [expandedGovernance, setExpandedGovernance] = React.useState({});

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 20px',
        color: theme.textSecondary,
        fontSize: 14,
      }}>
        No locking positions found
      </div>
    );
  }

  // Helper function to format unlock date
  const formatUnlockDate = (date) => {
    if (!date) return 'Unknown';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };

  // Helper function to calculate days until unlock
  const getDaysUntilUnlock = (date) => {
    if (!date) return 'Unknown';
    
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 30) return `${diffDays} days`;
    if (diffDays <= 365) {
      const months = Math.round(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    }
    
    const years = Math.round(diffDays / 365);
    return `${years} year${years > 1 ? 's' : ''}`;
  };

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
        
        // Get unlock date from additionalData
        const unlockTimestamp = item.additionalData?.unlockAt;
        const unlockDate = unlockTimestamp ? new Date(unlockTimestamp * 1000) : null;
        
        // Separate tokens by type
        const suppliedTokens = filterSuppliedTokens(tokens);
        const governanceTokens = filterGovernanceTokens(tokens);
        
        const totalValue = suppliedTokens.reduce((sum, token) => {
          return sum + (token.financials?.totalPrice || token.totalPrice || 0);
        }, 0);
        
        const governanceValue = governanceTokens.reduce((sum, token) => {
          return sum + (token.financials?.totalPrice || token.totalPrice || 0);
        }, 0);
        
        // Get main token (first supplied token)
        const mainToken = suppliedTokens[0];
        
        // Check if governance is expanded
        const isGovernanceExpanded = expandedGovernance[index] || false;
        
        // Toggle governance expansion
        const toggleGovernanceExpansion = () => {
          setExpandedGovernance(prev => ({ ...prev, [index]: !prev[index] }));
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
                      style={{ 
                        width: 18, 
                        height: 18, 
                        borderRadius: '50%',
                        objectFit: 'fill',
                      }}
                      onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                  )}
                  <span style={{ fontSize: 13, color: theme.textSecondary, fontWeight: 500 }}>
                    {protocol.name}
                  </span>
                </div>

                {/* Chain */}
                {mainToken?.chain && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getChainIcon(mainToken.chain) && (
                      <img
                        src={getChainIcon(mainToken.chain)}
                        alt={mainToken.chain}
                        style={{ 
                          width: 16, 
                          height: 16, 
                          borderRadius: '50%',
                          objectFit: 'fill',
                        }}
                        onError={(e) => e.currentTarget.style.display = 'none'}
                      />
                    )}
                    <span style={{ fontSize: 12, color: theme.textMuted }}>
                      {mainToken.chain.charAt(0).toUpperCase() + mainToken.chain.slice(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Token Symbol and Type */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ 
                fontSize: 18, 
                fontWeight: 700, 
                color: theme.textPrimary,
                marginBottom: 4,
              }}>
                {mainToken?.symbol || 'Unknown'}
              </div>
              <div style={{ 
                fontSize: 12, 
                color: theme.textMuted,
                fontWeight: 500,
              }}>
                Locked Token
              </div>
            </div>

            {/* Divider */}
            <div style={{ 
              height: 1, 
              backgroundColor: theme.border, 
              margin: '12px 0',
            }} />

            {/* Main Metrics */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: 12,
              marginBottom: 12,
            }}>
              {/* Value */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: theme.textSecondary }}>
                  Value
                </span>
                <span style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: theme.textPrimary,
                  fontFamily: 'monospace',
                }}>
                  {maskValue(formatPrice(totalValue))}
                </span>
              </div>

              {/* Locked Amount */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: theme.textSecondary }}>
                  Locked
                </span>
                <span style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: theme.textPrimary,
                  fontFamily: 'monospace',
                }}>
                  {formatBalance(mainToken?.financials?.balanceFormatted || mainToken?.balance || 0)} {mainToken?.symbol}
                </span>
              </div>

              {/* Unlock Date */}
              {unlockDate && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    Unlock
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontSize: 12, 
                      fontWeight: 600, 
                      color: theme.textPrimary,
                      fontFamily: 'monospace',
                    }}>
                      {formatUnlockDate(unlockDate)}
                    </div>
                    <div style={{ 
                      fontSize: 11, 
                      color: theme.textMuted,
                      marginTop: 2,
                    }}>
                      {getDaysUntilUnlock(unlockDate)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Governance Tokens Section */}
            {governanceTokens.length > 0 && (
              <>
                {/* Divider */}
                <div style={{ 
                  height: 1, 
                  backgroundColor: theme.border, 
                  margin: '12px 0',
                }} />

                {/* Governance Header */}
                <div
                  onClick={toggleGovernanceExpansion}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: '8px 0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span style={{ 
                      fontSize: 13, 
                      fontWeight: 600, 
                      color: theme.textPrimary,
                    }}>
                      Governance ({governanceTokens.length})
                    </span>
                  </div>
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke={theme.textSecondary} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    style={{
                      transform: isGovernanceExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>

                {/* Governance Tokens List (expandable) */}
                {isGovernanceExpanded && (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: 8,
                    marginTop: 8,
                  }}>
                    {governanceTokens.map((token, idx) => (
                      <div 
                        key={idx}
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '8px 12px',
                          backgroundColor: theme.bgApp,
                          borderRadius: 8,
                          border: `1px solid ${theme.border}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {token.logo && (
                            <img
                              src={token.logo}
                              alt={token.symbol}
                              style={{ 
                                width: 20, 
                                height: 20, 
                                borderRadius: '50%',
                                objectFit: 'fill',
                              }}
                              onError={(e) => e.currentTarget.style.display = 'none'}
                            />
                          )}
                          <span style={{ 
                            fontSize: 12, 
                            fontWeight: 600, 
                            color: theme.textPrimary,
                          }}>
                            {token.symbol}
                          </span>
                        </div>
                        <span style={{ 
                          fontSize: 12, 
                          fontWeight: 600, 
                          color: theme.textSecondary,
                          fontFamily: 'monospace',
                        }}>
                          {formatBalance(token.financials?.balanceFormatted || token.balance || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default LockingCards;
