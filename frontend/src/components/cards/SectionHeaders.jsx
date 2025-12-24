import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeProvider.tsx';
import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import { formatPrice } from '../../utils/walletUtils';

// Hook to detect mobile screens
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    setIsMobile(mediaQuery.matches);

    const handler = (e) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isMobile;
};

/**
 * WalletSectionHeader - Header for Wallet tokens section
 */
export const WalletSectionHeader = ({ data = [] }) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const isMobile = useIsMobile();
  
  const totalValue = data.reduce((sum, item) => {
    const token = item.token || item;
    return sum + (token.financials?.totalPrice || token.totalPrice || 0);
  }, 0);
  
  const tokenCount = data.length;
  
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ 
        fontSize: 18, 
        fontWeight: 600, 
        color: theme.textPrimary,
        marginBottom: 12,
        textAlign: 'center',
      }}>
        Wallet
      </h3>
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        padding: '16px 24px',
        backgroundColor: theme.bgPanel,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        boxShadow: `0 2px 8px ${theme.shadow}`,
        gap: isMobile ? 16 : 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 4 }}>
            Tokens
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
            </svg>
            {tokenCount}
          </div>
        </div>
        
        <div style={{ 
          flex: 1, 
          textAlign: isMobile ? 'left' : 'center',
          padding: isMobile ? 0 : '0 16px',
          borderLeft: isMobile ? 'none' : `1px solid ${theme.border}`,
          borderRight: isMobile ? 'none' : `1px solid ${theme.border}`,
          borderTop: isMobile ? `1px solid ${theme.border}` : 'none',
          borderBottom: isMobile ? `1px solid ${theme.border}` : 'none',
          paddingTop: isMobile ? 16 : 0,
          paddingBottom: isMobile ? 16 : 0,
        }}>
          <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 4 }}>
            Total Value
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.textPrimary }}>
            {maskValue(formatPrice(totalValue))}
          </div>
        </div>
        
        <div style={{ flex: 1, textAlign: 'right', display: isMobile ? 'none' : 'block' }}>
          {/* Placeholder for symmetry - hidden on mobile */}
          <div style={{ fontSize: 13, marginBottom: 4 }}>&nbsp;</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>&nbsp;</div>
        </div>
      </div>
    </div>
  );
};

/**
 * LendingSectionHeader - Header for Lending & Borrowing section
 */
export const LendingSectionHeader = ({ data = [] }) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const isMobile = useIsMobile();
  
  let totalSupply = 0;
  let totalBorrow = 0;
  
  data.forEach(item => {
    const position = item.position || item;
    const tokens = position.tokens || [];
    
    // Check if this is a borrow position
    const positionLabel = position.label?.toLowerCase() || position.key?.toLowerCase() || '';
    const isBorrowPosition = positionLabel.includes('borrow') || 
                             tokens.some(t => t.type?.toLowerCase() === 'borrowed');
    
    // Get supplied and borrowed tokens
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
    
    totalSupply += supplyValue;
    totalBorrow += borrowValue;
  });
  
  const netValue = totalSupply - totalBorrow;
  
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ 
        fontSize: 18, 
        fontWeight: 600, 
        color: theme.textPrimary,
        marginBottom: 12,
        textAlign: 'center',
      }}>
        Lending & Borrowing
      </h3>
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        padding: '16px 24px',
        backgroundColor: theme.bgPanel,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        boxShadow: `0 2px 8px ${theme.shadow}`,
        gap: isMobile ? 16 : 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 4 }}>
            Supply
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M19 12l-7 7-7-7"/>
            </svg>
            {maskValue(formatPrice(totalSupply))}
          </div>
        </div>
        
        <div style={{ 
          flex: 1, 
          textAlign: isMobile ? 'left' : 'center',
          padding: isMobile ? 0 : '0 16px',
          borderLeft: isMobile ? 'none' : `1px solid ${theme.border}`,
          borderRight: isMobile ? 'none' : `1px solid ${theme.border}`,
          borderTop: isMobile ? `1px solid ${theme.border}` : 'none',
          borderBottom: isMobile ? `1px solid ${theme.border}` : 'none',
          paddingTop: isMobile ? 16 : 0,
          paddingBottom: isMobile ? 16 : 0,
        }}>
          <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 4 }}>
            Net Position
          </div>
          <div style={{ 
            fontSize: 20, 
            fontWeight: 700, 
            color: netValue >= 0 ? '#10b981' : '#ef4444' 
          }}>
            {maskValue(formatPrice(netValue))}
          </div>
        </div>
        
        <div style={{ flex: 1, textAlign: isMobile ? 'left' : 'right' }}>
          <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 4 }}>
            Borrow
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
            {maskValue(formatPrice(totalBorrow))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * PoolsSectionHeader - Header for Liquidity Pools section
 */
export const PoolsSectionHeader = ({ data = [] }) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  const isMobile = useIsMobile();
  
  let totalValue = 0;
  let totalFees = 0;
  
  data.forEach(item => {
    const position = item.position || item;
    const tokens = position.tokens || [];
    
    // Calculate total value from supplied tokens (excluding fees)
    const suppliedTokens = tokens.filter(t => 
      t.type?.toLowerCase() === 'supplied' || 
      (!t.type && t.financials?.totalPrice)
    );
    
    const positionValue = suppliedTokens.reduce((sum, token) => {
      return sum + (token.financials?.totalPrice || token.totalPrice || 0);
    }, 0);
    
    totalValue += positionValue;
    
    // Calculate uncollected fees
    const feeTokens = tokens.filter(t => 
      t.type?.toLowerCase() === 'liquidityuncollectedfee'
    );
    
    const feesValue = feeTokens.reduce((sum, token) => {
      return sum + (token.financials?.totalPrice || token.totalPrice || 0);
    }, 0);
    
    totalFees += feesValue;
  });
  
  const positionsCount = data.length;
  
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ 
        fontSize: 18, 
        fontWeight: 600, 
        color: theme.textPrimary,
        marginBottom: 12,
        textAlign: 'center',
      }}>
        Liquidity Pools
      </h3>
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'stretch' : 'center',
        padding: '16px 24px',
        backgroundColor: theme.bgPanel,
        border: `1px solid ${theme.border}`,
        borderRadius: 16,
        boxShadow: `0 2px 8px ${theme.shadow}`,
        gap: isMobile ? 16 : 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 4 }}>
            Positions
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.textPrimary, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
              <path d="m6.08 9.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59"/>
              <path d="m6.08 14.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59"/>
            </svg>
            {positionsCount}
          </div>
        </div>
        
        <div style={{ 
          flex: 1, 
          textAlign: isMobile ? 'left' : 'center',
          padding: isMobile ? 0 : '0 16px',
          borderLeft: isMobile ? 'none' : `1px solid ${theme.border}`,
          borderRight: isMobile ? 'none' : `1px solid ${theme.border}`,
          borderTop: isMobile ? `1px solid ${theme.border}` : 'none',
          borderBottom: isMobile ? `1px solid ${theme.border}` : 'none',
          paddingTop: isMobile ? 16 : 0,
          paddingBottom: isMobile ? 16 : 0,
        }}>
          <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 4 }}>
            Total Value
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: theme.textPrimary }}>
            {maskValue(formatPrice(totalValue))}
          </div>
        </div>
        
        <div style={{ flex: 1, textAlign: isMobile ? 'left' : 'right' }}>
          <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 4 }}>
            Uncollected Fees
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
              <path d="M12 18V6"/>
            </svg>
            {maskValue(formatPrice(totalFees))}
          </div>
        </div>
      </div>
    </div>
  );
};
