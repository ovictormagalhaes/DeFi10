import { useTheme } from '../../context/ThemeProvider';
import { useMaskValues } from '../../context/MaskValuesContext';
import { formatPrice, formatBalance } from '../../utils/walletUtils';
import SafeImage from '../SafeImage';
import EmptyStateCard from './EmptyStateCard';
import CardContainer from './CardContainer';
import SkeletonCardGrid from './SkeletonCardGrid';
import type { WalletItem } from '../../types/wallet';

interface StakingCardsProps {
  data: WalletItem[];
  isLoading?: boolean;
}

const StakingCards: React.FC<StakingCardsProps> = ({ data = [], isLoading }) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();

  if (!data || data.length === 0) {
    return <EmptyStateCard label="staking positions" />;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
      gap: 16,
      padding: '8px 0',
    }}>
      {data.map((item, index) => {
        const position = item.position || item;
        const protocol = (position.protocol || {}) as { name?: string; icon?: string; [key: string]: unknown };
        const tokens = position.tokens || [];
        const rewards = position.rewards || [];
        
        // Calculate total value
        const totalValue = tokens.reduce((sum, token) => sum + (token.totalPrice || 0), 0);
        const rewardsValue = rewards.reduce((sum, reward) => sum + (reward.totalPrice || 0), 0);
        
        return (
          <CardContainer
            key={index}
          >
            {/* Header - Protocol */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12,
              marginBottom: 10,
              paddingBottom: 12,
              borderBottom: `1px solid ${theme.border}`,
            }}>
              {protocol.icon && (
                <SafeImage
                  src={protocol.icon}
                  alt={protocol.name}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: `1px solid ${theme.border}`,
                  }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: 600, 
                  fontSize: 14,
                  color: theme.textPrimary,
                  marginBottom: 2,
                }}>
                  {protocol.name || 'Unknown Protocol'}
                </div>
                <div style={{ 
                  fontSize: 12,
                  color: theme.textSecondary,
                }}>
                  Staking Position
                </div>
              </div>
            </div>

            {/* Total Value & Rewards */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 10,
            }}>
              <div>
                <div style={{ 
                  fontSize: 11,
                  color: theme.textSecondary,
                  marginBottom: 4,
                }}>
                  Staked Value
                </div>
                <div style={{ 
                  fontSize: 16,
                  fontWeight: 700,
                  color: theme.textPrimary,
                }}>
                  {maskValue(formatPrice(totalValue))}
                </div>
              </div>
              <div>
                <div style={{ 
                  fontSize: 11,
                  color: theme.textSecondary,
                  marginBottom: 4,
                }}>
                  Rewards
                </div>
                <div style={{ 
                  fontSize: 16,
                  fontWeight: 700,
                  color: rewardsValue > 0 ? '#10b981' : theme.textPrimary,
                }}>
                  {maskValue(formatPrice(rewardsValue))}
                </div>
              </div>
            </div>

            {/* Tokens */}
            <div>
              <div style={{ 
                fontSize: 12,
                color: theme.textSecondary,
                marginBottom: 8,
                fontWeight: 600,
              }}>
                Staked Assets ({tokens.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tokens.slice(0, 2).map((token, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: theme.bgSecondary,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {token.logo && (
                        <SafeImage
                          src={token.logo}
                          alt={token.symbol}
                          style={{ width: 20, height: 20, borderRadius: '50%' }}
                        />
                      )}
                      <span style={{ 
                        fontSize: 13,
                        fontWeight: 500,
                        color: theme.textPrimary,
                      }}>
                        {token.symbol}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: 13,
                        fontWeight: 600,
                        color: theme.textPrimary,
                      }}>
                        {maskValue(formatPrice(token.totalPrice || 0))}
                      </div>
                      <div style={{ 
                        fontSize: 11,
                        color: theme.textSecondary,
                      }}>
                        {maskValue(formatBalance(token.balance || 0, token.native))}
                      </div>
                    </div>
                  </div>
                ))}
                {tokens.length > 2 && (
                  <div style={{ 
                    fontSize: 12,
                    color: theme.textSecondary,
                    textAlign: 'center',
                    padding: '4px 0',
                  }}>
                    +{tokens.length - 2} more assets
                  </div>
                )}
              </div>
            </div>
          </CardContainer>
        );
      })}
      {isLoading && <SkeletonCardGrid itemCount={data.length} minCardWidth={320} gap={16} />}
    </div>
  );
};

export default StakingCards;
