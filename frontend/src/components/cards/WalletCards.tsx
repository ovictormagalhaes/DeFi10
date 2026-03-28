import { useCardContext } from '../../hooks/useCardContext';
import { formatPrice } from '../../utils/walletUtils';
import { capitalize } from '../../utils/format';
import { normalizeTokenData } from '../../utils/tokenUtils';
import SafeImage from '../SafeImage';
import EmptyStateCard from './EmptyStateCard';
import CardContainer from './CardContainer';
import SkeletonCardGrid from './SkeletonCardGrid';
import type { WalletItem } from '../../types/wallet';

interface WalletCardsProps {
  data: WalletItem[];
  isLoading?: boolean;
}

/**
 * WalletCards - Card view for wallet tokens
 * @param {Array} data - Wallet tokens data
 */
const WalletCards: React.FC<WalletCardsProps> = ({ data = [], isLoading }) => {
  const { theme, maskValue, getChainIcon } = useCardContext();

  if (!data || data.length === 0) {
    return <EmptyStateCard label="wallet tokens" />;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
      gap: 20,
      padding: '8px 0',
      maxWidth: '100%',
    }}>
      {data.map((item, index) => {
        // Extract token from data structure
        const token = (item.token || item) as { symbol?: string; name?: string; logo?: string; thumbnail?: string; chain?: string; network?: string; chainName?: string; financials?: Record<string, number | undefined>; priceUsd?: number; price?: number; priceUSD?: number; balance?: number; totalPrice?: number; [key: string]: unknown };
        const position = item.position || {};
        
        const { symbol, name, logo, chain, price } = normalizeTokenData(token);
        const amount = token.financials?.amountFormatted ?? token.financials?.balanceFormatted ?? token.balance ?? 0;
        const totalValue = token.financials?.totalPrice || token.totalPrice || 0;
        
        return (
          <CardContainer
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header: Logo (left) + Chain (right) */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 12,
            }}>
              {/* Token Logo */}
              <div style={{ 
                width: 36, 
                height: 36,
                borderRadius: '50%',
                backgroundColor: theme.bgSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {logo ? (
                  <SafeImage
                    src={logo}
                    alt={symbol}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      if (e.currentTarget.parentElement) {
                        e.currentTarget.parentElement.innerHTML = `<span style="font-size: 14px; font-weight: 600; color: ${theme.textSecondary}">${symbol.charAt(0)}</span>`;
                      }
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 600, color: theme.textSecondary }}>
                    {symbol.charAt(0)}
                  </span>
                )}
              </div>

              {/* Chain */}
              {chain && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6,
                }}>
                  {getChainIcon(chain) && (
                    <SafeImage
                      src={getChainIcon(chain)}
                      alt={chain}
                      style={{ width: 16, height: 16, borderRadius: '50%' }}
                    />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary }}>
                    {capitalize(chain)}
                  </span>
                </div>
              )}
            </div>

            {/* Token Name */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ 
                fontSize: 16,
                fontWeight: 700,
                color: theme.textPrimary,
              }}>
                {name}
              </div>
              {name !== symbol && (
                <div style={{ 
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.textSecondary,
                  marginTop: 2,
                }}>
                  {symbol}
                </div>
              )}
            </div>

            {/* Metrics */}
            <div style={{ flex: 1 }}>
              {/* Value */}
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
                  {maskValue(formatPrice(totalValue))}
                </span>
              </div>

              {/* Amount */}
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
                    amount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6
                    })
                  )} {symbol}
                </span>
              </div>

              {/* Price */}
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ 
                  fontSize: 13,
                  color: theme.textSecondary,
                }}>
                  Price
                </span>
                <span style={{ 
                  fontSize: 14,
                  fontWeight: 600,
                  color: theme.textPrimary,
                }}>
                  {maskValue(formatPrice(price))}
                </span>
              </div>
            </div>
          </CardContainer>
        );
      })}
      {isLoading && <SkeletonCardGrid itemCount={data.length} minCardWidth={280} gap={20} />}
    </div>
  );
};

export default WalletCards;
