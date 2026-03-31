import React from 'react';

import { useCardContext } from '../../hooks/useCardContext';
import type { WalletItem } from '../../types/wallet';
import { capitalize } from '../../utils/format';
import { filterSuppliedTokens, filterGovernanceTokens } from '../../utils/tokenFilters';
import { formatPrice, formatBalance } from '../../utils/walletUtils';
import SafeImage from '../SafeImage';

import CardContainer from './CardContainer';
import EmptyStateCard from './EmptyStateCard';
import SkeletonCardGrid from './SkeletonCardGrid';

interface LockingCardsProps {
  data: WalletItem[];
  isLoading?: boolean;
}

const LockingCards: React.FC<LockingCardsProps> = ({ data = [], isLoading }) => {
  const { theme, maskValue, getChainIcon } = useCardContext();
  const [expandedGovernance, setExpandedGovernance] = React.useState<Record<number, boolean>>({});

  if (!data || data.length === 0) {
    return <EmptyStateCard label="locking positions" />;
  }

  // Helper function to format unlock date
  const formatUnlockDate = (date: Date | null): string => {
    if (!date) return 'Unknown';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };

  // Helper function to calculate days until unlock
  const getDaysUntilUnlock = (date: Date | null): string => {
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))',
        gap: 20,
        padding: '8px 0',
        maxWidth: '100%',
      }}
    >
      {data.map((item, index) => {
        const position = item.position || item;
        const protocol = (position.protocol || item.protocol || {}) as {
          logo?: string;
          icon?: string;
          name?: string;
          [key: string]: unknown;
        };
        const tokens = position.tokens || [];

        // Get unlock date from additionalData
        const unlockTimestamp = item.additionalData?.unlockAt;
        const unlockDate = unlockTimestamp ? new Date(unlockTimestamp * 1000) : null;

        // Separate tokens by type
        const suppliedTokens = filterSuppliedTokens(tokens);
        const governanceTokens = filterGovernanceTokens(tokens);

        const totalValue = suppliedTokens.reduce((sum, token) => {
          return sum + Number(token.financials?.totalPrice || token.totalPrice || 0);
        }, 0);

        const governanceValue = governanceTokens.reduce((sum, token) => {
          return sum + Number(token.financials?.totalPrice || token.totalPrice || 0);
        }, 0);

        // Get main token (first supplied token)
        const mainToken = suppliedTokens[0];

        // Check if governance is expanded
        const isGovernanceExpanded = expandedGovernance[index] || false;

        // Toggle governance expansion
        const toggleGovernanceExpansion = () => {
          setExpandedGovernance((prev) => ({ ...prev, [index]: !prev[index] }));
        };

        return (
          <CardContainer
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header - Token Icon, Protocol & Chain */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              {/* Left side: Token Icon */}
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                {mainToken?.logo && (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: `2px solid ${theme.bgPanel}`,
                      backgroundColor: theme.bgPanel,
                      zIndex: 2,
                    }}
                  >
                    <SafeImage
                      src={mainToken.logo as string}
                      alt={mainToken.symbol as string}
                      style={{ width: '100%', height: '100%', objectFit: 'fill' }}
                    />
                  </div>
                )}
              </div>

              {/* Right side: Protocol and Chain */}
              <div
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}
              >
                {/* Protocol */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {(protocol.logo || protocol.icon) && (
                    <SafeImage
                      src={protocol.logo || protocol.icon}
                      alt={protocol.name}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        objectFit: 'fill',
                      }}
                    />
                  )}
                  <span style={{ fontSize: 13, color: theme.textSecondary, fontWeight: 500 }}>
                    {protocol.name}
                  </span>
                </div>

                {/* Chain */}
                {mainToken?.chain && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getChainIcon(mainToken.chain as string) && (
                      <SafeImage
                        src={getChainIcon(mainToken.chain as string)}
                        alt={mainToken.chain as string}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          objectFit: 'fill',
                        }}
                      />
                    )}
                    <span style={{ fontSize: 12, color: theme.textMuted }}>
                      {capitalize(String(mainToken.chain || ''))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Token Symbol and Type */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: theme.textPrimary,
                  marginBottom: 4,
                }}
              >
                {mainToken?.symbol || 'Unknown'}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: theme.textMuted,
                  fontWeight: 500,
                }}
              >
                Locked Token
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                height: 1,
                backgroundColor: theme.border,
                margin: '12px 0',
              }}
            />

            {/* Main Metrics */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                marginBottom: 12,
              }}
            >
              {/* Value */}
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: 13, color: theme.textSecondary }}>Value</span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: theme.textPrimary,
                    fontFamily: 'monospace',
                  }}
                >
                  {maskValue(formatPrice(totalValue))}
                </span>
              </div>

              {/* Locked Amount */}
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: 13, color: theme.textSecondary }}>Locked</span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: theme.textPrimary,
                    fontFamily: 'monospace',
                  }}
                >
                  {formatBalance(
                    Number(mainToken?.financials?.balanceFormatted || mainToken?.balance || 0)
                  )}{' '}
                  {mainToken?.symbol as string}
                </span>
              </div>

              {/* Unlock Date */}
              {unlockDate && (
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: theme.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Unlock
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: theme.textPrimary,
                        fontFamily: 'monospace',
                      }}
                    >
                      {formatUnlockDate(unlockDate)}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: theme.textMuted,
                        marginTop: 2,
                      }}
                    >
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
                <div
                  style={{
                    height: 1,
                    backgroundColor: theme.border,
                    margin: '12px 0',
                  }}
                />

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
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={theme.accent}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: theme.textPrimary,
                      }}
                    >
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
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {/* Governance Tokens List (expandable) */}
                {isGovernanceExpanded && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
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
                            <SafeImage
                              src={token.logo as string}
                              alt={token.symbol as string}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                objectFit: 'fill',
                              }}
                            />
                          )}
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: theme.textPrimary,
                            }}
                          >
                            {token.symbol}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: theme.textSecondary,
                            fontFamily: 'monospace',
                          }}
                        >
                          {formatBalance(
                            Number(token.financials?.balanceFormatted || token.balance || 0)
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContainer>
        );
      })}
      {isLoading && <SkeletonCardGrid itemCount={data.length} minCardWidth={340} gap={20} />}
    </div>
  );
};

export default LockingCards;
