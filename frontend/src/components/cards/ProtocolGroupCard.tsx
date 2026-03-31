import { useState } from 'react';
import { useCardContext } from '../../hooks/useCardContext';
import { formatPrice } from '../../utils/walletUtils';
import { capitalize } from '../../utils/format';
import ProjectionSelector from '../ProjectionSelector';
import OmniScoreBadge from '../OmniScoreBadge';
import SafeImage from '../SafeImage';
import type { WalletItem } from '../../types/wallet';

interface LendingGroupDetail {
  protocolName: string;
  chainName: string;
  positions: WalletItem[];
  healthFactor: number | null;
  protocolLogo?: string;
  totals: {
    totalSupplied: number;
    totalBorrowed: number;
    netPosition: number;
    avgSupplyRate: number;
    avgBorrowRate: number;
    avgApy: number;
  };
}

interface ProtocolGroupCardProps {
  protocolName: string;
  chainName: string;
  positions: WalletItem[];
  healthFactor: number | null;
  onOpenDetail?: (detail: LendingGroupDetail) => void;
}

/**
 * ProtocolGroupCard - Agrupa lending/borrowing positions por Protocol + Chain
 * Exibe Health Factor compartilhado e mantém individualidade dos tokens
 */
const ProtocolGroupCard: React.FC<ProtocolGroupCardProps> = ({ protocolName, chainName, positions = [], healthFactor = null, onOpenDetail }) => {
  const { theme, maskValue, getChainIcon } = useCardContext();
  const [isExpanded, setIsExpanded] = useState(true);

  if (!positions || positions.length === 0) return null;

  // Filter out transaction history items (they have no tokens and are for data storage only)
  const visiblePositions = positions.filter(item => {
    const position = item.position || item;
    const tokens = position.tokens || [];
    const label = (position.label || '').toLowerCase();
    return tokens.length > 0 && !label.includes('transaction history') && !label.includes('hidden');
  });

  // If no visible positions after filtering, don't render
  if (visiblePositions.length === 0) return null;

  // Get protocol info from first position
  const firstPosition = positions[0]?.position || positions[0];
  const protocol = (firstPosition.protocol || positions[0]?.protocol || {}) as { name?: string; logo?: string; icon?: string; iconUrl?: string; [key: string]: unknown };
  
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
  const aggregateProjections: unknown[] = [];

  const globalSeenKeys = new Set<string>();
  positions.forEach(item => {
    const position = item.position || item;
    const allTokens = position.tokens || [];
    const tokens = allTokens.filter((t: any) => {
      const k = String(t.key || `${t.symbol}-${t.type}-${t.contractAddress || ''}`);
      if (globalSeenKeys.has(k)) return false;
      globalSeenKeys.add(k);
      return true;
    });

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

    const itemApy = (item.additionalData?.projections as any[])?.find((p: any) => p.type === 'apy')?.metadata?.value || item.additionalInfo?.apy || 0;
    const supplyRate = position.supplyRate || position.apy || (supplyValue > borrowValue ? itemApy : 0);
    const borrowRate = position.borrowRate || position.borrowApy || (borrowValue > supplyValue ? Math.abs(itemApy) : 0);

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
          backgroundColor: theme.bgPanel,
          borderBottom: `1px solid ${theme.border}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background-color 0.2s ease',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bgHover || theme.bgPanel}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.bgPanel}
      >
        {/* Left: Protocol + Chain */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Protocol Logo */}
          {protocolLogo && (
            <SafeImage
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
                    <SafeImage
                      src={getChainIcon(chainName)}
                      alt={chainName}
                      style={{ width: 16, height: 16, borderRadius: '50%' }}
                    />
                  )}
                  <span style={{ 
                    fontSize: 12, 
                    fontWeight: 600, 
                    color: theme.textSecondary 
                  }}>
                    {capitalize(chainName)}
                  </span>
                </div>
              )}
            </div>
            <div style={{ 
              fontSize: 12, 
              color: theme.textSecondary,
              marginTop: 2,
            }}>
              {visiblePositions.length} position{visiblePositions.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Right: Omni Score + Health Factor + Detail Button + Expand Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <OmniScoreBadge
            type="lending"
            {...(() => {
              const suppliesMap = new Map<string, number>();
              const borrowsMap = new Map<string, number>();
              positions.forEach(item => {
                const pos = item.position || item;
                (pos.tokens || []).forEach(t => {
                  const ttype = (t.type || '').toLowerCase();
                  const usd = Math.abs(t.balanceUSD || t.totalPrice || 0);
                  if (ttype === 'supplied' || (!ttype && (t.balance || 0) > 0 && !t.debt)) {
                    if (t.symbol) suppliesMap.set(t.symbol, (suppliesMap.get(t.symbol) || 0) + usd);
                  } else if (ttype === 'borrowed' || t.debt || (t.balance || 0) < 0) {
                    if (t.symbol) borrowsMap.set(t.symbol, (borrowsMap.get(t.symbol) || 0) + usd);
                  }
                });
              });
              return {
                supplies: [...suppliesMap.entries()].map(([token, value]) => ({ token, value })),
                borrows: [...borrowsMap.entries()].map(([token, value]) => ({ token, value })),
              };
            })()}
            protocol={protocolName}
            chain={chainName}
          />
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
          
          {/* Detail View Button */}
          {typeof onOpenDetail === 'function' && (
            <button
              type="button"
              title="Expand lending view"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail({
                  protocolName,
                  chainName,
                  positions,
                  healthFactor,
                  protocolLogo,
                  totals: {
                    totalSupplied,
                    totalBorrowed,
                    netPosition,
                    avgSupplyRate,
                    avgBorrowRate,
                    avgApy,
                  },
                });
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.bgPanel,
                color: theme.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.bgHover || theme.bgSecondary;
                e.currentTarget.style.color = theme.textPrimary;
                e.currentTarget.style.borderColor = theme.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.bgPanel;
                e.currentTarget.style.color = theme.textSecondary;
                e.currentTarget.style.borderColor = theme.border;
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <polyline points="10 8 16 8 16 14" />
                <line x1="8" y1="16" x2="16" y2="8" />
              </svg>
            </button>
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
            backgroundColor: theme.bgPanel,
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

          {/* Individual Token Cards - flatten tokens from positions */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
            gap: 16,
            padding: 20,
            backgroundColor: theme.bgApp,
          }}>
            {[...visiblePositions].sort((a, b) => {
              const aTokens = (a.position || a).tokens || [];
              const bTokens = (b.position || b).tokens || [];
              const aIsBorrow = aTokens.some(t => {
                const type = (t.type || '').toLowerCase();
                return type.includes('borrowed') || type.includes('borrow');
              });
              const bIsBorrow = bTokens.some(t => {
                const type = (t.type || '').toLowerCase();
                return type.includes('borrowed') || type.includes('borrow');
              });
              return Number(aIsBorrow) - Number(bIsBorrow);
            }).flatMap((item, posIndex) => {
              const position = item.position || item;
              const tokens = position.tokens || [];

              const projections = item.additionalData?.projections || item.additionalInfo?.projections || position?.projections || null;
              const projection = item.additionalInfo?.projection || item.additionalData?.projection || position.projection || null;
              const projApy = (item.additionalData?.projections as any[])?.find((p: any) => p.type === 'apy')?.metadata?.value;
              const supplyRate = position.supplyRate || position.apy || projApy || 0;
              const borrowRate = position.borrowRate || position.borrowApy || projApy || 0;

              const isCollateral = [
                position?.isCollateral,
                position?.IsCollateral,
                position?.additionalData?.isCollateral,
                item?.additionalData?.isCollateral,
              ].some((v) => v === true);

              const seen = new Set<string>();
              const uniqueTokens = tokens.filter((t: any) => {
                const k = String(t.key || `${t.symbol}-${t.type}-${t.contractAddress || ''}`);
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
              });

              return uniqueTokens.map((token, tokenIndex) => {
                const tokenType = (token.type || '').toLowerCase();
                const isBorrowToken = tokenType.includes('borrowed') || tokenType.includes('borrow');
                const positionType = isBorrowToken ? 'Borrow' : 'Supply';
                const tokenValue = token.financials?.totalPrice || token.totalPrice || 0;

                return (
                <div
                  key={`${posIndex}-${tokenIndex}`}
                  style={{
                    backgroundColor: theme.bgPanel,
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
                    {token?.logo && (
                      <SafeImage
                        src={token.logo}
                        alt={token.symbol}
                        style={{ width: 32, height: 32, borderRadius: '50%' }}
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
                        {token?.symbol || 'Unknown'}
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: isBorrowToken ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: isBorrowToken ? '#ef4444' : '#10b981',
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
                        {maskValue(formatPrice(tokenValue))}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: theme.textSecondary }}>Amount</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>
                        {maskValue(
                          (token?.financials?.amountFormatted ?? token?.financials?.balanceFormatted ?? token?.balance ?? 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6
                          })
                        )} {token?.symbol || ''}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: theme.textSecondary }}>APY</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>
                        {isBorrowToken 
                          ? (borrowRate ? `${Math.abs(borrowRate).toFixed(2)}%` : '0.00%')
                          : (supplyRate ? `${supplyRate.toFixed(2)}%` : '0.00%')
                        }
                      </span>
                    </div>

                    {/* Collateral - sempre renderiza para manter espaçamento consistente */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      visibility: isBorrowToken ? 'hidden' : 'visible',
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
              });
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ProtocolGroupCard;
