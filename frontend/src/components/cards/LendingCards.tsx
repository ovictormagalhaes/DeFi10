import React, { useMemo, useState } from 'react';
import { useCardContext } from '../../hooks/useCardContext';
import { formatPrice, formatBalance } from '../../utils/walletUtils';
import { capitalize } from '../../utils/format';
import OmniScoreBadge from '../OmniScoreBadge';
import ProjectionSelector from '../ProjectionSelector';
import SafeImage from '../SafeImage';
import EmptyStateCard from './EmptyStateCard';
import CardContainer from './CardContainer';
import type { WalletItem } from '../../types/wallet';

const MAX_HISTORY_ROWS = 20;

interface LendingExpandedProps {
  protocolName: string;
  chainName: string;
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
  onBack: () => void;
}

interface LendingCardsProps {
  data: WalletItem[];
  mode?: 'cards' | 'expanded';
  expandedProps?: LendingExpandedProps | null;
}

const LendingCards: React.FC<LendingCardsProps> = ({ data = [], mode = 'cards', expandedProps = null }) => {
  const { theme, maskValue, getChainIcon } = useCardContext();

  // Compute aggregated data for expanded mode
  const { supplyHistory, borrowHistory, repayHistory, aggregateProjections, totalSupplied, totalBorrowed, netPosition } = useMemo(() => {
    if (mode !== 'expanded') {
      return { supplyHistory: [], borrowHistory: [], repayHistory: [], aggregateProjections: [], totalSupplied: 0, totalBorrowed: 0, netPosition: 0 };
    }

    const supplies = [];
    const borrows = [];
    const repays = [];
    const projectionsAccumulator = [];

    (data || []).forEach((item) => {
      const position = item.position || item;
      const tokens = position.tokens || [];
      const mainToken = (tokens[0] || {}) as { symbol?: string; name?: string; logo?: string; chain?: string; [key: string]: unknown };

      const additionalData =
        item.additionalData ||
        position.additionalData ||
        item.AdditionalData ||
        position.AdditionalData ||
        {};

      // Build token info map for decimal conversions
      const tokenInfoMap = new Map();
      
      ['suppliesTokens', 'borrowsTokens', 'repaysTokens'].forEach(key => {
        const tokenArray = additionalData[key];
        if (Array.isArray(tokenArray)) {
          tokenArray.forEach(token => {
            const address = (token.tokenAddress || token.mintAddress || '').toLowerCase();
            if (address && token.decimals != null) {
              tokenInfoMap.set(address, {
                decimals: token.decimals,
                symbol: token.symbol,
                name: token.name,
                logo: token.logoUrl || token.logo
              });
            }
          });
        }
      });

      // Helper to convert balance using decimals
      const convertBalance = (balance, tokenAddress) => {
        const address = (tokenAddress || '').toLowerCase();
        const tokenInfo = tokenInfoMap.get(address);
        if (tokenInfo && tokenInfo.decimals != null) {
          const rawBalance = Number(balance);
          if (isNaN(rawBalance)) return balance;
          return rawBalance / Math.pow(10, tokenInfo.decimals);
        }
        return balance;
      };

      if (Array.isArray(additionalData.supplies)) {
        additionalData.supplies.forEach((s) => {
          const ts = s.timestamp || s.time || s.date;
          const tokenAddress = s.mintAddress || s.tokenAddress;
          supplies.push({
            symbol: s.symbol || mainToken.symbol,
            mintAddress: tokenAddress,
            balance: convertBalance(s.balance, tokenAddress),
            raw: s,
            timestamp: ts,
          });
        });
      }

      if (Array.isArray(additionalData.borrows)) {
        additionalData.borrows.forEach((b) => {
          const ts = b.timestamp || b.time || b.date;
          const tokenAddress = b.mintAddress || b.tokenAddress;
          borrows.push({
            symbol: b.symbol || mainToken.symbol,
            mintAddress: tokenAddress,
            balance: convertBalance(b.balance, tokenAddress),
            raw: b,
            timestamp: ts,
          });
        });
      }

      if (Array.isArray(additionalData.repays)) {
        additionalData.repays.forEach((r) => {
          const ts = r.timestamp || r.time || r.date;
          const tokenAddress = r.mintAddress || r.tokenAddress;
          repays.push({
            symbol: r.symbol || mainToken.symbol,
            mintAddress: tokenAddress,
            balance: convertBalance(r.balance, tokenAddress),
            raw: r,
            timestamp: ts,
          });
        });
      }

      const projections =
        additionalData.projections ||
        item.additionalInfo?.projections ||
        position?.projections;

      if (projections && Array.isArray(projections)) {
        projectionsAccumulator.push(...projections);
      }
    });

    const parseTs = (value) => {
      if (!value) return 0;
      const d = new Date(value);
      const t = d.getTime();
      return Number.isNaN(t) ? 0 : t;
    };

    supplies.sort((a, b) => parseTs(b.timestamp) - parseTs(a.timestamp));
    borrows.sort((a, b) => parseTs(b.timestamp) - parseTs(a.timestamp));
    repays.sort((a, b) => parseTs(b.timestamp) - parseTs(a.timestamp));

    // Aggregate projections by type
    const aggregatedByType = new Map();
    projectionsAccumulator.forEach((p) => {
      if (!p || !p.projection) return;
      const rawType = ((p.type || 'apr')).toString();
      const typeKey = rawType.toLowerCase();

      const base = aggregatedByType.get(typeKey) || {
        type: rawType,
        projection: { oneDay: 0, oneWeek: 0, oneMonth: 0, oneYear: 0 },
        metadata: {},
      };

      base.projection.oneDay += Number(p.projection.oneDay || 0);
      base.projection.oneWeek += Number(p.projection.oneWeek || 0);
      base.projection.oneMonth += Number(p.projection.oneMonth || 0);
      base.projection.oneYear += Number(p.projection.oneYear || 0);

      aggregatedByType.set(typeKey, base);
    });

    const uniqueProjections = Array.from(aggregatedByType.values());
    const totals = (expandedProps?.totals || {}) as { totalSupplied?: number; totalBorrowed?: number; netPosition?: number; [key: string]: unknown };

    return {
      supplyHistory: supplies.slice(0, MAX_HISTORY_ROWS),
      borrowHistory: borrows.slice(0, MAX_HISTORY_ROWS),
      repayHistory: repays.slice(0, MAX_HISTORY_ROWS),
      aggregateProjections: uniqueProjections,
      totalSupplied: totals.totalSupplied || 0,
      totalBorrowed: totals.totalBorrowed || 0,
      netPosition: totals.netPosition || 0,
    };
  }, [data, mode, expandedProps]);

  if (!data || data.length === 0) {
    return <EmptyStateCard label="lending positions" />;
  }

  // Expanded mode rendering
  if (mode === 'expanded' && expandedProps) {
    const { protocolName, chainName, healthFactor, protocolLogo, onBack } = expandedProps;
    const healthColor = healthFactor >= 2 ? '#10b981' : healthFactor >= 1.5 ? '#f59e0b' : '#ef4444';

    return (
      <div style={{
        backgroundColor: theme.bgPanel,
        borderRadius: 16,
        border: `1px solid ${theme.border}`,
        padding: 24,
        boxShadow: theme.shadowPanel || '0 10px 40px rgba(0,0,0,0.45)',
      }}>
        {/* Expanded Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              type="button" 
              onClick={onBack} 
              style={{
                borderRadius: 999,
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.bgSecondary,
                color: theme.textPrimary,
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.bgHover;
                e.currentTarget.style.color = theme.accent;
                e.currentTarget.style.borderColor = theme.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.bgSecondary;
                e.currentTarget.style.color = theme.textPrimary;
                e.currentTarget.style.borderColor = theme.border;
              }}
            >
              <span style={{ display: 'inline-block', transform: 'rotate(180deg)' }}>❯</span>
              Back
            </button>

            {protocolLogo && (
              <SafeImage src={protocolLogo} alt={protocolName} style={{
                width: 40, height: 40, borderRadius: '50%', objectFit: 'cover',
                border: `2px solid ${theme.border}`, backgroundColor: theme.bgSecondary,
              }} />
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: theme.textPrimary }}>
                {protocolName || 'Lending Protocol'}
                {chainName && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                    backgroundColor: theme.bgSecondary, borderRadius: 20, border: `1px solid ${theme.border}`,
                  }}>
                    {getChainIcon(chainName) && (
                      <SafeImage src={getChainIcon(chainName)} alt={chainName} style={{ width: 16, height: 16, borderRadius: '50%' }} />
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary }}>
                      {capitalize(chainName)}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>
                Detailed lending view · {data.length} position{data.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {healthFactor != null && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 11, color: theme.textSecondary, fontWeight: 600 }}>HEALTH FACTOR</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: healthColor }}>{healthFactor.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Summary Bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px',
          borderRadius: 12, backgroundColor: theme.bgSecondary, border: `1px solid ${theme.border}`,
          marginBottom: 24, gap: 20,
        }}>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>Supply</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
              {maskValue(formatPrice(totalSupplied))}
            </div>
          </div>

          <div style={{ flex: 1, textAlign: 'center', padding: '0 16px', borderLeft: `1px solid ${theme.border}`, borderRight: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>Net Position</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: netPosition >= 0 ? '#10b981' : '#ef4444' }}>
              {maskValue(formatPrice(netPosition))}
            </div>
          </div>

          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>Borrow</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
              {maskValue(formatPrice(totalBorrowed))}
            </div>
          </div>
        </div>

        {/* Aggregated Projection */}
        {aggregateProjections && aggregateProjections.length > 0 && (
          <div style={{
            marginBottom: 24, padding: '14px 18px', borderRadius: 12,
            border: `1px solid ${theme.border}`, backgroundColor: theme.bgSecondary,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textSecondary }}>
                Projection (protocol)
              </span>
              <span style={{ fontSize: 12, color: theme.textSecondary }}>Aggregated from all positions</span>
            </div>
            <ProjectionSelector
              projections={aggregateProjections}
              defaultType="apr"
              defaultPeriod="Month"
              showTypeWhenSingle={true}
              dropdownButtonStyle={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary, backgroundColor: 'transparent', border: 'none', padding: 0 }}
              disableDropdownHoverEffects={true}
            />
          </div>
        )}

        {/* Position cards section header */}
        <div style={{ marginTop: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.textPrimary }}>
              Positions in this protocol
            </h3>
            <span style={{ fontSize: 12, color: theme.textSecondary }}>
              {data.length} position{data.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Recursively render cards for individual positions */}
          <LendingCards data={data} mode="cards" />
        </div>

        {/* Transaction History Section */}
        {(supplyHistory.length > 0 || borrowHistory.length > 0 || repayHistory.length > 0) && (
          <TransactionHistory
            supplyHistory={supplyHistory}
            borrowHistory={borrowHistory}
            repayHistory={repayHistory}
            theme={theme}
          />
        )}
      </div>
    );
  }

  // Default cards mode rendering
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
      gap: 20,
      padding: '8px 0',
      maxWidth: '100%',
      overflow: 'visible',
    }}>
      {[...data].sort((a, b) => {
        const aPos = a.position || a;
        const bPos = b.position || b;
        const aTokens = aPos.tokens || [];
        const bTokens = bPos.tokens || [];
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
        const protocol = (position.protocol || item.protocol || {}) as { logo?: string; icon?: string; name?: string; [key: string]: unknown };
        const tokens = position.tokens || [];

        const projections = item.additionalData?.projections || item.additionalInfo?.projections || position?.projections || null;
        const projection = item.additionalInfo?.projection || item.additionalData?.projection || position.projection || null;
        const healthFactor = item.additionalData?.healthFactor || item.additionalInfo?.healthFactor || null;
        const projApy = (item.additionalData?.projections as any[])?.find((p: any) => p.type === 'apy')?.metadata?.value;
        const supplyRate = position.supplyRate || position.apy || projApy || 0;
        const borrowRate = position.borrowRate || position.borrowApy || projApy || 0;

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

        return tokens.map((token, tokenIndex) => {
          const tokenType = (token.type || '').toLowerCase();
          const isBorrowToken = tokenType.includes('borrowed') || tokenType.includes('borrow');
          const positionType = isBorrowToken ? 'Borrow' : 'Supply';
          const tokenValue = token.financials?.totalPrice || token.totalPrice || 0;

          return (
          <CardContainer
            key={`${posIndex}-${tokenIndex}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'visible',
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
                {token?.logo && (
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: `2px solid ${theme.bgPanel}`,
                    backgroundColor: theme.bgPanel,
                    zIndex: 2,
                  }}>
                    <SafeImage
                      src={token.logo}
                      alt={token.symbol}
                      style={{ width: '100%', height: '100%', objectFit: 'fill' }}
                    />
                  </div>
                )}
              </div>

              {/* Right side: Protocol and Chain */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                {/* Protocol */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {(protocol.logo || protocol.icon) && (
                    <SafeImage
                      src={protocol.logo || protocol.icon}
                      alt={protocol.name}
                      style={{ width: 16, height: 16, borderRadius: '50%' }}
                    />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: theme.textPrimary }}>
                    {protocol.name || 'Unknown'}
                  </span>
                </div>

                {/* Chain */}
                {token?.chain && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getChainIcon(token.chain) && (
                      <SafeImage
                        src={getChainIcon(token.chain)}
                        alt={token.chain}
                        style={{ width: 16, height: 16, borderRadius: '50%' }}
                      />
                    )}
                    <span style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary }}>
                      {capitalize(token.chain)}
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
                justifyContent: 'space-between',
                gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {token?.symbol || 'Unknown'}
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    backgroundColor: isBorrowToken ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: isBorrowToken ? '#ef4444' : '#10b981',
                  }}>
                    {positionType}
                  </span>
                </div>
                <OmniScoreBadge
                  type="lending"
                  supplies={isBorrowToken ? [] : [{ token: token?.symbol || '', value: Math.abs(token?.balanceUSD || token?.totalPrice || 0) }]}
                  borrows={isBorrowToken ? [{ token: token?.symbol || '', value: Math.abs(token?.balanceUSD || token?.totalPrice || 0) }] : []}
                  protocol={(protocol.name as string) || undefined}
                  chain={token?.chain || undefined}
                />
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
                  {maskValue(formatPrice(tokenValue))}
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
                    (token?.financials?.amountFormatted ?? token?.financials?.balanceFormatted ?? token?.balance ?? 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6
                    })
                  )} {token?.symbol || ''}
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
                marginBottom: projection ? 10 : 0,
                visibility: isBorrowToken ? 'hidden' : 'visible',
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
                        invertSign={isBorrowToken}
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
                        invertSign={isBorrowToken}
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
          </CardContainer>
          );
        });
      })}
    </div>
  );
};

/**
 * TransactionHistory - Unified transaction history with tabs and pagination
 */
const TransactionHistory = ({ supplyHistory, borrowHistory, repayHistory, theme }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [displayCount, setDisplayCount] = useState(10);

  // Merge and sort all transactions by timestamp (most recent first)
  const allTransactions = useMemo(() => {
    const combined = [
      ...supplyHistory.map(tx => ({ ...tx, type: 'supply' })),
      ...borrowHistory.map(tx => ({ ...tx, type: 'borrow' })),
      ...repayHistory.map(tx => ({ ...tx, type: 'repay' }))
    ];
    
    return combined.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA; // Most recent first
    });
  }, [supplyHistory, borrowHistory, repayHistory]);

  // Filter based on active tab
  const filteredTransactions = useMemo(() => {
    if (activeTab === 'all') return allTransactions;
    return allTransactions.filter(tx => tx.type === activeTab);
  }, [allTransactions, activeTab]);

  // Paginated transactions
  const visibleTransactions = filteredTransactions.slice(0, displayCount);
  const hasMore = filteredTransactions.length > displayCount;

  // Determine which tabs to show
  const hasSupplies = supplyHistory.length > 0;
  const hasBorrows = borrowHistory.length > 0;
  const hasRepays = repayHistory.length > 0;

  return (
    <div style={{ marginTop: 32 }}>
      {/* Header with title and count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.textPrimary }}>
          Transaction History
        </h3>
        <span style={{ fontSize: 12, color: theme.textSecondary }}>
          {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        marginBottom: 16,
        borderBottom: `1px solid ${theme.border}`,
        paddingBottom: 0,
      }}>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: `2px solid ${activeTab === 'all' ? theme.accent : 'transparent'}`,
            backgroundColor: 'transparent',
            color: activeTab === 'all' ? theme.textPrimary : theme.textSecondary,
            fontWeight: activeTab === 'all' ? 600 : 400,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          All
        </button>
        {hasSupplies && (
          <button
            onClick={() => setActiveTab('supply')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'supply' ? theme.accent : 'transparent'}`,
              backgroundColor: 'transparent',
              color: activeTab === 'supply' ? theme.textPrimary : theme.textSecondary,
              fontWeight: activeTab === 'supply' ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Supply
          </button>
        )}
        {hasBorrows && (
          <button
            onClick={() => setActiveTab('borrow')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'borrow' ? theme.accent : 'transparent'}`,
              backgroundColor: 'transparent',
              color: activeTab === 'borrow' ? theme.textPrimary : theme.textSecondary,
              fontWeight: activeTab === 'borrow' ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Borrow
          </button>
        )}
        {hasRepays && (
          <button
            onClick={() => setActiveTab('repay')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'repay' ? theme.accent : 'transparent'}`,
              backgroundColor: 'transparent',
              color: activeTab === 'repay' ? theme.textPrimary : theme.textSecondary,
              fontWeight: activeTab === 'repay' ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Repay
          </button>
        )}
      </div>

      {/* Transaction List */}
      <div style={{ 
        backgroundColor: theme.bgSecondary, 
        borderRadius: 12, 
        border: `1px solid ${theme.border}`, 
        overflow: 'hidden',
      }}>
        {visibleTransactions.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: theme.textSecondary }}>
            No transactions found
          </div>
        ) : (
          <>
            {visibleTransactions.map((tx, idx) => {
              const dateLabel = tx.timestamp 
                ? new Date(tx.timestamp).toLocaleString('en-US', { 
                    month: 'short', day: 'numeric', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                  })
                : '-';
              const amount = tx.balance != null 
                ? Number(tx.balance).toLocaleString('en-US', { maximumFractionDigits: 6 })
                : '-';
              
              // Determine styling based on transaction type
              const isSupply = tx.type === 'supply';
              const isRepay = tx.type === 'repay';
              const isBorrow = tx.type === 'borrow';
              
              let iconColor, bgColor, icon;
              if (isSupply) {
                iconColor = '#10b981'; // Green
                bgColor = 'rgba(16, 185, 129, 0.15)';
                icon = <path d="M12 5v14M19 12l-7 7-7-7" />; // Down arrow (deposit)
              } else if (isRepay) {
                iconColor = '#3b82f6'; // Blue
                bgColor = 'rgba(59, 130, 246, 0.15)';
                icon = <path d="M12 19V5M5 12l7-7 7 7" />; // Up arrow (payment)
              } else {
                iconColor = '#ef4444'; // Red
                bgColor = 'rgba(239, 68, 68, 0.15)';
                icon = <path d="M12 19V5M5 12l7-7 7 7" />; // Up arrow (withdrawal)
              }

              return (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: idx < visibleTransactions.length - 1 ? `1px solid ${theme.border}` : 'none',
                    transition: 'background-color 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.bgHover || theme.bgPanel}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {/* Type Icon */}
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: '50%', 
                    backgroundColor: bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke={iconColor}
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      {icon}
                    </svg>
                  </div>

                  {/* Symbol and Type */}
                  <div style={{ flex: '0 0 100px' }}>
                    <div style={{ 
                      fontWeight: 600, 
                      color: theme.textPrimary,
                      fontSize: 14,
                    }}>
                      {tx.symbol || '—'}
                    </div>
                    <div style={{ 
                      fontSize: 11, 
                      color: theme.textSecondary,
                      textTransform: 'capitalize',
                    }}>
                      {tx.type}
                    </div>
                  </div>

                  {/* Amount */}
                  <div style={{ 
                    flex: 1, 
                    textAlign: 'right',
                    fontWeight: 600,
                    color: theme.textPrimary,
                    fontSize: 14,
                  }}>
                    {amount}
                  </div>

                  {/* Date */}
                  <div style={{ 
                    flex: '0 0 150px',
                    textAlign: 'right',
                    color: theme.textSecondary, 
                    fontSize: 12,
                  }}>
                    {dateLabel}
                  </div>
                </div>
              );
            })}

            {/* Show More Button */}
            {hasMore && (
              <div style={{ padding: '12px 16px', textAlign: 'center', borderTop: `1px solid ${theme.border}` }}>
                <button
                  onClick={() => setDisplayCount(prev => prev + 10)}
                  style={{
                    padding: '8px 20px',
                    border: `1px solid ${theme.border}`,
                    borderRadius: 8,
                    backgroundColor: theme.bgPanel,
                    color: theme.textPrimary,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.bgHover || theme.bgSecondary;
                    e.currentTarget.style.borderColor = theme.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.bgPanel;
                    e.currentTarget.style.borderColor = theme.border;
                  }}
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LendingCards;
