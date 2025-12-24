import React from 'react';
import { useTheme } from '../../context/ThemeProvider.tsx';
import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import { useChainIcons } from '../../context/ChainIconsProvider.jsx';
import { formatPrice, formatBalance } from '../../utils/walletUtils';
import RangeChip from '../RangeChip.jsx';

/**
 * PoolCards - Card view for liquidity pool positions
 * @param {Array} data - Pool positions data
 */
const PoolCards = ({ data = [] }) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const { getIcon: getChainIcon } = useChainIcons();
  const [flippedCards, setFlippedCards] = React.useState({});
  const [expandedRanges, setExpandedRanges] = React.useState({});
  const [expandedFees, setExpandedFees] = React.useState({});

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 20px',
        color: theme.textSecondary,
        fontSize: 14,
      }}>
        No pool positions found
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
        const rewards = position.rewards || [];
        const additionalInfo = item.additionalInfo || position.additionalInfo || {};
        
        // Check if this card is flipped
        const isFlipped = flippedCards[index] || false;
        
        // Check if range is expanded
        const isRangeExpanded = expandedRanges[index] || false;
        
        // Check if fees are expanded
        const isFeesExpanded = expandedFees[index] || false;
        
        // Toggle flip function
        const handleFlip = () => {
          setFlippedCards(prev => ({ ...prev, [index]: !prev[index] }));
        };
        
        // Toggle range expansion
        const toggleRangeExpansion = () => {
          setExpandedRanges(prev => ({ ...prev, [index]: !prev[index] }));
        };
        
        // Toggle fees expansion
        const toggleFeesExpansion = () => {
          setExpandedFees(prev => ({ ...prev, [index]: !prev[index] }));
        };
        
        // Calculate age from createdAt
        const getAge = (createdAt) => {
          if (!createdAt) return '-';
          const created = new Date(createdAt);
          const now = new Date();
          const diffMs = now - created;
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          
          if (diffDays === 0) return 'Today';
          if (diffDays === 1) return '1 day';
          if (diffDays < 30) return `${diffDays} days`;
          
          const diffMonths = Math.floor(diffDays / 30);
          if (diffMonths === 1) return '1 month';
          if (diffMonths < 12) return `${diffMonths} months`;
          
          const diffYears = Math.floor(diffMonths / 12);
          return diffYears === 1 ? '1 year' : `${diffYears} years`;
        };
        
        const age = getAge(additionalInfo.createdAt);
        
        // Separate regular tokens from uncollected fees
        const suppliedTokens = tokens.filter(t => {
          const type = (t.type || '').toLowerCase();
          return type !== 'liquidityuncollectedfee';
        });
        const feeTokens = tokens.filter(t => {
          const type = (t.type || '').toLowerCase();
          return type === 'liquidityuncollectedfee';
        });
        
        const totalValue = suppliedTokens.reduce((sum, token) => {
          const price = token.financials?.totalPrice || token.totalPrice || 0;
          return sum + price;
        }, 0);
        const rewardsValue = rewards.reduce((sum, reward) => sum + (reward.totalPrice || 0), 0);
        
        // Get token pair (usually 2 tokens in a pool)
        const token0 = suppliedTokens[0];
        const token1 = suppliedTokens[1];
        
        // Apply flip if needed
        const displayToken0 = isFlipped ? token1 : token0;
        const displayToken1 = isFlipped ? token0 : token1;
        
        // Pool metrics (mock - replace with actual data)
        const apr = position.apr || position.apy || 0;
        
        // Range data from additionalData or additionalInfo
        const rangeData = additionalInfo.range || item.additionalData?.range || position.range || null;
        const inRange = rangeData?.inRange ?? true; // Default to true if no range data
        
        // Build uncollected fees from tokens with type "LiquidityUncollectedFee"
        let uncollectedFees = position.uncollectedFees || additionalInfo.uncollectedFees || item.additionalData?.uncollectedFees || null;
        
        // If not found in additionalData, extract from tokens array
        if (!uncollectedFees && feeTokens.length > 0) {
          uncollectedFees = {};
          
          // Match fee tokens to supplied tokens by symbol or contract address
          feeTokens.forEach((feeToken) => {
            const feeSymbol = (feeToken.symbol || '').toLowerCase();
            const feeContract = (feeToken.contractAddress || '').toLowerCase();
            
            // Try to match with token0
            const token0Symbol = (token0?.symbol || '').toLowerCase();
            const token0Contract = (token0?.contractAddress || '').toLowerCase();
            
            // Try to match with token1
            const token1Symbol = (token1?.symbol || '').toLowerCase();
            const token1Contract = (token1?.contractAddress || '').toLowerCase();
            
            if ((feeSymbol && feeSymbol === token0Symbol) || (feeContract && feeContract === token0Contract)) {
              uncollectedFees.token0 = {
                amount: feeToken.financials?.amountFormatted || feeToken.financials?.balanceFormatted || 0,
                balance: feeToken.financials?.balanceFormatted || 0,
                value: feeToken.financials?.totalPrice || 0,
                totalPrice: feeToken.financials?.totalPrice || 0,
              };
            } else if ((feeSymbol && feeSymbol === token1Symbol) || (feeContract && feeContract === token1Contract)) {
              uncollectedFees.token1 = {
                amount: feeToken.financials?.amountFormatted || feeToken.financials?.balanceFormatted || 0,
                balance: feeToken.financials?.balanceFormatted || 0,
                value: feeToken.financials?.totalPrice || 0,
                totalPrice: feeToken.financials?.totalPrice || 0,
              };
            }
          });
        }
        
        // Apply range flip if needed (invert values and swap lower/upper)
        const displayRangeData = rangeData && isFlipped && rangeData.current && rangeData.lower && rangeData.upper ? {
          ...rangeData,
          current: 1 / rangeData.current,
          lower: 1 / rangeData.upper,  // Swap: old upper becomes new lower
          upper: 1 / rangeData.lower,  // Swap: old lower becomes new upper
        } : rangeData;
        
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
            {/* Header - Token Icons, Protocol & Chain */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              {/* Left side: Token Icons */}
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                {displayToken0?.logo && (
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
                      src={displayToken0.logo}
                      alt={displayToken0.symbol}
                      style={{ width: '100%', height: '100%', objectFit: 'fill' }}
                      onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                  </div>
                )}
                {displayToken1?.logo && (
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: `2px solid ${theme.bgPanel}`,
                    backgroundColor: theme.bgPanel,
                    marginLeft: -16,
                    zIndex: 1,
                  }}>
                    <img
                      src={displayToken1.logo}
                      alt={displayToken1.symbol}
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
                {displayToken0?.chain && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getChainIcon(displayToken0.chain) && (
                      <img
                        src={getChainIcon(displayToken0.chain)}
                        alt={displayToken0.chain}
                        style={{ width: 16, height: 16, borderRadius: '50%' }}
                        onError={(e) => e.currentTarget.style.display = 'none'}
                      />
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary }}>
                      {displayToken0.chain.charAt(0).toUpperCase() + displayToken0.chain.slice(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Token Pair Title */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ 
                fontSize: 16,
                fontWeight: 700,
                color: theme.textPrimary,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                {displayToken0?.symbol || 'Unknown'} / {displayToken1?.symbol || 'Unknown'}
                
                {/* Flip Button */}
                <button
                  onClick={handleFlip}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: theme.textSecondary,
                    transition: 'all 0.2s ease',
                    transform: isFlipped ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = theme.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = theme.textSecondary;
                  }}
                  title="Flip pair"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2L8 14M8 14L4 10M8 14L12 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 2L8 14M8 2L4 6M8 2L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"/>
                  </svg>
                </button>
                
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 4,
                  backgroundColor: inRange ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: inRange ? '#10b981' : '#ef4444',
                }}>
                  {inRange ? 'In Range' : 'Out of Range'}
                </span>
              </div>
            </div>

            {/* Metrics */}
            <div style={{ flex: 1 }}>
              {/* Amount Section */}
              <div style={{ 
                marginBottom: 6,
              }}>
                <div style={{ 
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.textSecondary,
                  marginBottom: 8,
                }}>
                  Amount
                </div>
                
                {/* Token 0 Amount */}
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                  paddingLeft: 8,
                }}>
                  <span style={{ 
                    fontSize: 13,
                    color: theme.textSecondary,
                  }}>
                    {displayToken0?.symbol || 'Token'}
                  </span>
                  <span style={{ 
                    fontSize: 14,
                    fontWeight: 700,
                    color: theme.textPrimary,
                  }}>
                    {maskValue(
                      (displayToken0?.financials?.amountFormatted ?? displayToken0?.financials?.balanceFormatted ?? displayToken0?.balance ?? 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6
                      })
                    )} {displayToken0?.symbol || ''}
                  </span>
                </div>
                
                {/* Token 1 Amount */}
                {displayToken1 && (
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                    paddingLeft: 8,
                  }}>
                    <span style={{ 
                      fontSize: 13,
                      color: theme.textSecondary,
                    }}>
                      {displayToken1?.symbol || 'Token'}
                    </span>
                    <span style={{ 
                      fontSize: 14,
                      fontWeight: 700,
                      color: theme.textPrimary,
                    }}>
                      {maskValue(
                        (displayToken1?.financials?.amountFormatted ?? displayToken1?.financials?.balanceFormatted ?? displayToken1?.balance ?? 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6
                        })
                      )} {displayToken1?.symbol || ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Value Section */}
              <div style={{ 
                marginBottom: 10,
              }}>
                <div style={{ 
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.textSecondary,
                  marginBottom: 8,
                }}>
                  Value
                </div>
                
                {/* Token 0 Value */}
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                  paddingLeft: 8,
                }}>
                  <span style={{ 
                    fontSize: 13,
                    color: theme.textSecondary,
                  }}>
                    {displayToken0?.symbol || 'Token'}
                  </span>
                  <span style={{ 
                    fontSize: 14,
                    fontWeight: 700,
                    color: theme.textPrimary,
                  }}>
                    {maskValue(formatPrice(displayToken0?.financials?.totalPrice || displayToken0?.totalPrice || 0))}
                  </span>
                </div>
                
                {/* Token 1 Value */}
                {displayToken1 && (
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 6,
                    paddingLeft: 8,
                  }}>
                    <span style={{ 
                      fontSize: 13,
                      color: theme.textSecondary,
                    }}>
                      {displayToken1?.symbol || 'Token'}
                    </span>
                    <span style={{ 
                      fontSize: 14,
                      fontWeight: 700,
                      color: theme.textPrimary,
                    }}>
                      {maskValue(formatPrice(displayToken1?.financials?.totalPrice || displayToken1?.totalPrice || 0))}
                    </span>
                  </div>
                )}
                
                {/* Total Value */}
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: `1px solid ${theme.border}`,
                }}>
                  <span style={{ 
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.textSecondary,
                  }}>
                    Total
                  </span>
                  <span style={{ 
                    fontSize: 14,
                    fontWeight: 700,
                    color: theme.textPrimary,
                  }}>
                    {maskValue(formatPrice(totalValue))}
                  </span>
                </div>
              </div>

              {/* APR */}
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}>
                <span style={{ fontSize: 14, color: theme.textSecondary }}>APR</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: theme.textPrimary }}>
                  {apr ? `${apr.toFixed(2)}%` : '0.00%'}
                </span>
              </div>

              {/* Age */}
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: rangeData ? 10 : 0,
              }}>
                <span style={{ fontSize: 14, color: theme.textSecondary }}>Age</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>
                  {age}
                </span>
              </div>

              {/* Range Chip */}
              {displayRangeData && (
                <>
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}>
                    <span style={{ fontSize: 14, color: theme.textSecondary }}>Range</span>
                    <RangeChip range={displayRangeData} width={90} height={14} />
                  </div>
                  
                  {/* Position Percentage - Always Visible */}
                  {displayRangeData.lower && displayRangeData.upper && displayRangeData.current && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                      cursor: 'pointer',
                    }}
                    onClick={toggleRangeExpansion}
                    >
                      <span style={{ fontSize: 13, color: theme.textSecondary }}>Position</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ 
                          fontSize: 13, 
                          fontWeight: 600, 
                          color: (() => {
                            const { lower, upper, current } = displayRangeData;
                            if (current < lower || current > upper) {
                              return '#ef4444';
                            }
                            return '#10b981';
                          })()
                        }}>
                          {(() => {
                            const { lower, upper, current } = displayRangeData;
                            if (current < lower) {
                              const distance = ((lower - current) / lower * 100).toFixed(1);
                              return `${distance}% below`;
                            } else if (current > upper) {
                              const distance = ((current - upper) / upper * 100).toFixed(1);
                              return `${distance}% above`;
                            } else {
                              const position = ((current - lower) / (upper - lower) * 100).toFixed(1);
                              return `${position}% in range`;
                            }
                          })()}
                        </span>
                        <svg 
                          width="12" 
                          height="12" 
                          viewBox="0 0 12 12" 
                          fill="none"
                          style={{
                            transform: isRangeExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
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
                  )}
                  
                  {/* Range Details - Collapsible */}
                  {isRangeExpanded && (
                    <div style={{
                      backgroundColor: theme.bgSecondary,
                      borderRadius: 8,
                      padding: '6px 12px 12px 12px',
                      marginTop: 4,
                      marginBottom: 8,
                    }}>
                      {/* Upper Price */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}>
                        <span style={{ fontSize: 12, color: theme.textSecondary }}>Upper</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary }}>
                          ${displayRangeData.upper?.toFixed(displayRangeData.upper < 0.01 ? 8 : displayRangeData.upper < 1 ? 4 : 2) || '0.00'}
                        </span>
                      </div>

                      {/* Current Price */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}>
                        <span style={{ fontSize: 12, color: theme.textSecondary }}>Current</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary }}>
                          ${displayRangeData.current?.toFixed(displayRangeData.current < 0.01 ? 8 : displayRangeData.current < 1 ? 4 : 2) || '0.00'}
                        </span>
                      </div>

                      {/* Lower Price */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 12, color: theme.textSecondary }}>Lower</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary }}>
                          ${displayRangeData.lower?.toFixed(displayRangeData.lower < 0.01 ? 8 : displayRangeData.lower < 1 ? 4 : 2) || '0.00'}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Uncollected Fees */}
              {uncollectedFees && (uncollectedFees.token0 || uncollectedFees.token1) && (() => {
                const totalFees = (uncollectedFees.token0?.value || uncollectedFees.token0?.totalPrice || 0) + 
                                 (uncollectedFees.token1?.value || uncollectedFees.token1?.totalPrice || 0);
                
                return (
                  <div style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: `1px solid ${theme.border}`,
                  }}>
                    {/* Uncollected Fees Header - Always Visible */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                      cursor: 'pointer',
                    }}
                    onClick={toggleFeesExpansion}
                    >
                      <span style={{ fontSize: 14, color: theme.textSecondary }}>Uncollected Fees</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>
                          {maskValue(formatPrice(totalFees))}
                        </span>
                        <svg 
                          width="12" 
                          height="12" 
                          viewBox="0 0 12 12" 
                          fill="none"
                          style={{
                            transform: isFeesExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
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
                    
                    {/* Fees Details - Collapsible */}
                    {isFeesExpanded && (
                      <div style={{
                        backgroundColor: theme.bgSecondary,
                        borderRadius: 8,
                        padding: '6px 12px 12px 12px',
                        marginTop: 4,
                      }}>
                        {/* Token 0 Fees */}
                        {uncollectedFees.token0 && (
                          <>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 6,
                            }}>
                              <span style={{ fontSize: 12, color: theme.textSecondary }}>
                                {displayToken0?.symbol || 'Token'} Amount
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary }}>
                                {maskValue(
                                  (uncollectedFees.token0.amount ?? uncollectedFees.token0.balance ?? 0).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6
                                  })
                                )} {displayToken0?.symbol || ''}
                              </span>
                            </div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: uncollectedFees.token1 ? 10 : 0,
                            }}>
                              <span style={{ fontSize: 12, color: theme.textSecondary }}>
                                {displayToken0?.symbol || 'Token'} Value
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>
                                {maskValue(formatPrice(uncollectedFees.token0.value || uncollectedFees.token0.totalPrice || 0))}
                              </span>
                            </div>
                          </>
                        )}

                        {/* Token 1 Fees */}
                        {uncollectedFees.token1 && (
                          <>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 6,
                            }}>
                              <span style={{ fontSize: 12, color: theme.textSecondary }}>
                                {displayToken1?.symbol || 'Token'} Amount
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary }}>
                                {maskValue(
                                  (uncollectedFees.token1.amount ?? uncollectedFees.token1.balance ?? 0).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 6
                                  })
                                )} {displayToken1?.symbol || ''}
                              </span>
                            </div>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}>
                              <span style={{ fontSize: 12, color: theme.textSecondary }}>
                                {displayToken1?.symbol || 'Token'} Value
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>
                                {maskValue(formatPrice(uncollectedFees.token1.value || uncollectedFees.token1.totalPrice || 0))}
                              </span>
                            </div>
                          </>
                        )}
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

export default PoolCards;
