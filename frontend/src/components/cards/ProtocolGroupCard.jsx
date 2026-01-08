import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeProvider.tsx';
import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import { useChainIcons } from '../../context/ChainIconsProvider.jsx';
import { formatPrice } from '../../utils/walletUtils';
import ProjectionSelector from '../ProjectionSelector.jsx';

/**
 * ProtocolGroupCard - Agrupa lending/borrowing positions por Protocol + Chain
 * Exibe Health Factor compartilhado e mantém individualidade dos tokens
 */
const ProtocolGroupCard = ({ protocolName, chainName, positions = [], healthFactor = null }) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const { getIcon: getChainIcon } = useChainIcons();
  const [isExpanded, setIsExpanded] = useState(true);

  if (!positions || positions.length === 0) return null;

  // Get protocol info from first position
  const firstPosition = positions[0]?.position || positions[0];
  const protocol = firstPosition.protocol || positions[0]?.protocol || {};
  
  // Get protocol logo from multiple possible sources
  const protocolLogo = protocol.logo || 
                       protocol.icon || 
                       protocol.iconUrl || 
                       firstPosition.protocolIcon ||
                       firstPosition.protocolLogo;

  // Calculate group totals and averages
  let totalSupplied = 0;
  let totalBorrowed = 0;
  let weightedSupplyRate = 0;
  let weightedBorrowRate = 0;
  let supplyWeight = 0;
  let borrowWeight = 0;

  // Aggregate projections
  const aggregateProjections = [];

  positions.forEach(item => {
    const position = item.position || item;
    const tokens = position.tokens || [];

    const suppliedTokens = tokens.filter(t => 
      t.type?.toLowerCase() === 'supplied' || 
      (!t.type && (t.balance || 0) > 0 && !t.debt)
    );
    const borrowedTokens = tokens.filter(t => 
      t.type?.toLowerCase() === 'borrowed' || 
      t.debt || 
      (t.balance || 0) < 0
    );

    const supplyValue = suppliedTokens.reduce((sum, token) => {
      return sum + (token.financials?.totalPrice || token.totalPrice || 0);
    }, 0);
    const borrowValue = Math.abs(borrowedTokens.reduce((sum, token) => {
      return sum + (token.financials?.totalPrice || token.totalPrice || 0);
    }, 0));

    totalSupplied += supplyValue;
    totalBorrowed += borrowValue;

    const supplyRate = position.supplyRate || position.apy || 0;
    const borrowRate = position.borrowRate || position.borrowApy || 0;

    if (supplyValue > 0 && supplyRate) {
      weightedSupplyRate += supplyRate * supplyValue;
      supplyWeight += supplyValue;
    }
    if (borrowValue > 0 && borrowRate) {
      weightedBorrowRate += borrowRate * borrowValue;
      borrowWeight += borrowValue;
    }

    // Collect projections
    const projections = item.additionalData?.projections || item.additionalInfo?.projections || position?.projections;
    if (projections && Array.isArray(projections)) {
      aggregateProjections.push(...projections);
    }
  });

  const avgSupplyRate = supplyWeight > 0 ? weightedSupplyRate / supplyWeight : 0;
  const avgBorrowRate = borrowWeight > 0 ? weightedBorrowRate / borrowWeight : 0;
  const netPosition = totalSupplied - totalBorrowed;
  const avgApy = netPosition !== 0 ? ((weightedSupplyRate - weightedBorrowRate) / netPosition) : 0;

  // Determine health color
  const healthColor = healthFactor >= 2 ? '#10b981' : healthFactor >= 1.5 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{
      backgroundColor: theme.bgPanel,
      border: `2px solid ${theme.border}`,
      borderRadius: 16,
      marginBottom: 24,
      overflow: 'hidden',
      transition: 'all 0.2s ease',
    }}>
      {/* Header - Protocol + Chain + Health Factor */}
      <div 
        style={{
          padding: '16px 20px',
          backgroundColor: theme.bgSecondary,
          borderBottom: `1px solid ${theme.border}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background-color 0.2s ease',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bgHover || theme.bgSecondary}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.bgSecondary}
      >
        {/* Left: Protocol + Chain */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Protocol Logo */}
          {protocolLogo && (
            <img
              src={protocolLogo}
              alt={protocolName}
              style={{ 
                width: 36, 
                height: 36, 
                borderRadius: '50%',
                objectFit: 'cover',
                border: `2px solid ${theme.border}`,
                backgroundColor: theme.bgPanel,
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          
          {/* Protocol Name */}
          <div>
            <div style={{ 
              fontSize: 18, 
              fontWeight: 700, 
              color: theme.textPrimary,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              {protocolName}
              
              {/* Chain Badge */}
              {chainName && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6,
                  padding: '4px 12px',
                  backgroundColor: theme.bgPanel,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 20,
                }}>
                  {getChainIcon(chainName) && (
                    <img
                      src={getChainIcon(chainName)}
                      alt={chainName}
                      style={{ width: 16, height: 16, borderRadius: '50%' }}
                      onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                  )}
                  <span style={{ 
                    fontSize: 12, 
                    fontWeight: 600, 
                    color: theme.textSecondary 
                  }}>
                    {chainName.charAt(0).toUpperCase() + chainName.slice(1)}
                  </span>
                </div>
              )}
            </div>
            <div style={{ 
              fontSize: 12, 
              color: theme.textSecondary,
              marginTop: 2,
            }}>
              {positions.length} position{positions.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Right: Health Factor + Expand Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {healthFactor !== null && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
            }}>
              <span style={{ fontSize: 11, color: theme.textSecondary, fontWeight: 600 }}>
                HEALTH FACTOR
              </span>
              <span style={{ fontSize: 20, fontWeight: 700, color: healthColor }}>
                {healthFactor.toFixed(2)}
              </span>
            </div>
          )}
          
          {/* Expand/Collapse Icon */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.textSecondary}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <>
          {/* Summary Metrics Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 24px',
            backgroundColor: theme.bgSecondary,
            borderBottom: `1px solid ${theme.border}`,
            gap: 20,
          }}>
            {/* Supply - Left */}
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>
                Supply
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M19 12l-7 7-7-7"/>
                </svg>
                {maskValue(formatPrice(totalSupplied))}
              </div>
            </div>

            {/* Net Position - Center */}
            <div style={{ 
              flex: 1, 
              textAlign: 'center',
              padding: '0 16px',
              borderLeft: `1px solid ${theme.border}`,
              borderRight: `1px solid ${theme.border}`,
            }}>
              <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>
                Net Position
              </div>
              <div style={{ 
                fontSize: 16, 
                fontWeight: 700, 
                color: netPosition >= 0 ? '#10b981' : '#ef4444' 
              }}>
                {maskValue(formatPrice(netPosition))}
              </div>
            </div>

            {/* Borrow - Right */}
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>
                Borrow
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7"/>
                </svg>
                {maskValue(formatPrice(totalBorrowed))}
              </div>
            </div>
          </div>

          {/* Individual Position Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
            padding: 20,
          }}>
            {positions.map((item, index) => {
              const position = item.position || item;
              const tokens = position.tokens || [];

              const positionLabel = position.label?.toLowerCase() || position.key?.toLowerCase() || '';
              const isBorrowPosition = positionLabel.includes('borrow') || 
                                       tokens.some(t => t.type?.toLowerCase() === 'borrowed');

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
                return sum + (token.financials?.totalPrice || token.totalPrice || 0);
              }, 0);
              const totalBorrowed = Math.abs(borrowedTokens.reduce((sum, token) => {
                return sum + (token.financials?.totalPrice || token.totalPrice || 0);
              }, 0));

              const supplyRate = position.supplyRate || position.apy || item.additionalData?.apy || 0;
              const borrowRate = position.borrowRate || position.borrowApy || item.additionalData?.apy || 0;

              const mainToken = isBorrowPosition ? (borrowedTokens[0] || tokens[0]) : (suppliedTokens[0] || tokens[0]);
              const positionType = isBorrowPosition ? 'Borrow' : 'Supply';

              const projections = item.additionalData?.projections || item.additionalInfo?.projections || position?.projections || null;
              const projection = item.additionalInfo?.projection || item.additionalData?.projection || position.projection || null;

              const isCollateral = [
                position?.isCollateral,
                position?.IsCollateral,
                position?.additionalData?.isCollateral,
                item?.additionalData?.isCollateral,
              ].some((v) => v === true);

              return (
                <div
                  key={index}
                  style={{
                    backgroundColor: theme.bgSecondary,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                    padding: 16,
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = theme.accent;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.border;
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Token Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    {mainToken?.logo && (
                      <img
                        src={mainToken.logo}
                        alt={mainToken.symbol}
                        style={{ width: 32, height: 32, borderRadius: '50%' }}
                        onError={(e) => e.currentTarget.style.display = 'none'}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: 15, 
                        fontWeight: 700, 
                        color: theme.textPrimary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        {mainToken?.symbol || 'Unknown'}
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: isBorrowPosition ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isBorrowPosition ? '#ef4444' : '#10b981',
                        }}>
                          {positionType}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: theme.textSecondary }}>Value</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>
                        {maskValue(formatPrice(isBorrowPosition ? totalBorrowed : totalSupplied))}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: theme.textSecondary }}>Amount</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>
                        {maskValue(
                          (mainToken?.financials?.amountFormatted ?? mainToken?.financials?.balanceFormatted ?? mainToken?.balance ?? 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6
                          })
                        )} {mainToken?.symbol || ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: theme.textSecondary }}>APY</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>
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
                      visibility: isBorrowPosition ? 'hidden' : 'visible',
                    }}>
                      <span style={{ fontSize: 12, color: theme.textSecondary }}>Collateral</span>
                      <div style={{
                        width: 32,
                        height: 16,
                        borderRadius: 10,
                        backgroundColor: isCollateral ? theme.accent : theme.bgPanel,
                        border: `1px solid ${isCollateral ? theme.accent : theme.border}`,
                        position: 'relative',
                        transition: 'all 0.2s ease',
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          transform: `translate(${isCollateral ? '16px' : '2px'}, -50%)`,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: '#fff',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                        }} />
                      </div>
                    </div>

                    {/* Projection */}
                    {(projections || projection) && (() => {
                      if (projections && Array.isArray(projections) && projections.length > 0) {
                        return (
                          <div style={{ marginTop: 8, borderTop: `1px solid ${theme.border}`, paddingTop: 8 }}>
                            <ProjectionSelector 
                              projections={projections} 
                              defaultType="apr" 
                              defaultPeriod="Day"
                              showTypeWhenSingle={false}
                            />
                          </div>
                        );
                      }
                      if (projection) {
                        const hasProjection = projection.oneDay != null || projection.oneWeek != null || 
                                             projection.oneMonth != null || projection.oneYear != null;
                        if (hasProjection) {
                          return (
                            <div style={{ marginTop: 8, borderTop: `1px solid ${theme.border}`, paddingTop: 8 }}>
                              <ProjectionSelector 
                                projection={projection} 
                                defaultPeriod="Day"
                                showTypeWhenSingle={false}
                              />
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ProtocolGroupCard;
