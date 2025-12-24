import React from 'react';
import { useTheme } from '../../context/ThemeProvider.tsx';
import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import { useChainIcons } from '../../context/ChainIconsProvider.jsx';
import { formatPrice } from '../../utils/walletUtils';

/**
 * WalletCards - Card view for wallet tokens
 * @param {Array} data - Wallet tokens data
 */
const WalletCards = ({ data = [] }) => {
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
        No wallet tokens found
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
    }}>
      {data.map((item, index) => {
        // Extract token from data structure
        const token = item.token || item;
        const position = item.position || {};
        
        // Get token data
        const symbol = token.symbol || 'Unknown';
        const name = token.name || symbol;
        const logo = token.logo || token.thumbnail || null;
        const chain = token.chain || token.network || token.chainName || 'unknown';
        
        // Get financial data
        const price = token.financials?.price || token.priceUsd || token.price || token.priceUSD || 0;
        const amount = token.financials?.amountFormatted ?? token.financials?.balanceFormatted ?? token.balance ?? 0;
        const totalValue = token.financials?.totalPrice || token.totalPrice || 0;
        
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
              e.currentTarget.style.boxShadow = `0 4px 12px ${theme.shadow}`;
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
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
                  <img
                    src={logo}
                    alt={symbol}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement.innerHTML = `<span style="font-size: 14px; font-weight: 600; color: ${theme.textSecondary}">${symbol.charAt(0)}</span>`;
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
                    <img
                      src={getChainIcon(chain)}
                      alt={chain}
                      style={{ width: 16, height: 16, borderRadius: '50%' }}
                      onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                  )}
                  <span style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary }}>
                    {chain.charAt(0).toUpperCase() + chain.slice(1)}
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
              {/* Price */}
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
                  Price
                </span>
                <span style={{ 
                  fontSize: 14,
                  fontWeight: 700,
                  color: theme.textPrimary,
                }}>
                  {maskValue(formatPrice(price))}
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
                  fontWeight: 700,
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

              {/* Value */}
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ 
                  fontSize: 13,
                  color: theme.textSecondary,
                }}>
                  Value
                </span>
                <span style={{ 
                  fontSize: 16,
                  fontWeight: 700,
                  color: theme.textPrimary,
                }}>
                  {maskValue(formatPrice(totalValue))}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WalletCards;
