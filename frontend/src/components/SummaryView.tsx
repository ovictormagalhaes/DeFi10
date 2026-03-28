import type { ThemeShape } from '../context/ThemeProvider';
import type { WalletItem } from '../types/wallet';

import AdvancedAnalytics from './AdvancedAnalytics';

interface PortfolioBreakdown {
  totalNet: number;
  walletValue: number;
  defiNet: number;
  defiGross: number;
  lendingBorrowed: number;
  lendingSupplied: number;
  stakingValue: number;
}

interface SummaryViewProps {
  walletTokens: WalletItem[];
  getLiquidityPoolsData: () => WalletItem[];
  getLendingAndBorrowingData: () => WalletItem[];
  getStakingData: () => WalletItem[];
  getLockingData: () => WalletItem[];
  getTotalPortfolioValue: () => number;
  getPortfolioBreakdown?: () => PortfolioBreakdown | null;
  maskValue: (value: string | number) => string;
  formatPrice: (value: number | string) => string;
  theme: ThemeShape;
  groupDefiByProtocol: (data: WalletItem[]) => unknown[];
  filterLendingDefiTokens: (tokens: unknown[], show: boolean) => unknown[];
  showLendingDefiTokens: boolean;
}

const SummaryView = ({
  walletTokens,
  getLiquidityPoolsData,
  getLendingAndBorrowingData,
  getStakingData,
  getLockingData,
  getTotalPortfolioValue,
  getPortfolioBreakdown,
  maskValue,
  formatPrice,
  theme,
  groupDefiByProtocol,
  filterLendingDefiTokens,
  showLendingDefiTokens,
}: SummaryViewProps): React.ReactElement => {
  const signedTokenValue = (t: Record<string, unknown>, pos: Record<string, unknown>): number => {
    const ty = (String(t.type || '')).toLowerCase();
    const val = Math.abs(parseFloat(String(t.totalPrice)) || 0);
    if (ty === 'borrowed' || ty === 'borrow' || ty === 'debt') return -val;
    if (!ty) {
      const posObj = pos?.position as Record<string, unknown> | undefined;
      const lbl = (String(posObj?.label || pos?.label || '')).toLowerCase();
      if (lbl.includes('borrow') || lbl.includes('debt')) return -val;
    }
    return val;
  };

  const breakdown: PortfolioBreakdown | null = getPortfolioBreakdown ? getPortfolioBreakdown() : null;
  const totalValue: number = breakdown ? breakdown.totalNet : getTotalPortfolioValue();
  const walletValue: number = breakdown ? breakdown.walletValue : 0;
  const liquidityData: WalletItem[] = getLiquidityPoolsData();
  const lendingData: WalletItem[] = getLendingAndBorrowingData();
  const stakingData: WalletItem[] = getStakingData();
  const defiNet: number = breakdown ? breakdown.defiNet : totalValue - walletValue;
  const defiGross: number = breakdown ? breakdown.defiGross : defiNet;
  const lendingBorrowed: number = breakdown ? breakdown.lendingBorrowed : 0;
  const lendingSupplied: number = breakdown ? breakdown.lendingSupplied : 0;
  const stakingValueCalc: number = breakdown ? breakdown.stakingValue : 0;
  // portfolioGross removido conforme solicitação; manter apenas net
  return (
    <div className="summary-panel panel-unified" style={{ marginTop: 18 }}>
      <div className="summary-header">
        <div className="circle-32 bg-primary-subtle" style={{ marginTop: 2 }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.textPrimary}
            strokeWidth="2"
          >
            <path d="M9 11H1l6-6 6 6" />
            <path d="M9 17l3-3 3 3" />
            <path d="M22 18.5c0 2.485 0 4.5-4 4.5s-4-2.015-4-4.5S14 14 18 14s4 2.015 4 4.5" />
            <circle cx="18" cy="5" r="3" />
          </svg>
        </div>
        <div className="">
          <h2 className="panel-heading" style={{ fontSize: 20, fontWeight: 600 }}>
            Portfolio Summary
          </h2>
          <p className="summary-sub text-secondary">Overview of your DeFi portfolio</p>
        </div>
      </div>

      {/* Total Portfolio - Hero Card */}
      <div
        style={{
          background: theme.brandGrad || theme.bgPanel,
          borderRadius: 14,
          padding: '24px 28px',
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
            Total Portfolio
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
            {maskValue(formatPrice(totalValue))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
              {walletTokens.length} tokens
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
              {liquidityData.length + lendingData.length + stakingData.length} DeFi positions
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="metric-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: theme.bgAccentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.accent || theme.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </div>
          <div>
            <div className="metric-label" style={{ marginBottom: 4 }}>Wallet Assets</div>
            <div className="metric-value-md text-primary">{maskValue(formatPrice(walletValue))}</div>
            <div className="text-xs text-secondary" style={{ marginTop: 2 }}>{walletTokens.length} tokens</div>
          </div>
        </div>

        <div className="metric-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: theme.bgAccentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={theme.accent || theme.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div className="metric-label" style={{ marginBottom: 4 }}>DeFi Positions</div>
            <div className="metric-value-md text-primary">{maskValue(formatPrice(defiNet))}</div>
            <div className="text-xs text-secondary" style={{ marginTop: 2 }}>
              {liquidityData.length + lendingData.length + stakingData.length} positions
            </div>
          </div>
        </div>

        {lendingSupplied > 0 && (
          <div className="metric-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v10l4.24 4.24" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
            <div>
              <div className="metric-label" style={{ marginBottom: 4 }}>Supplied</div>
              <div className="metric-value-md text-primary">{maskValue(formatPrice(lendingSupplied))}</div>
              {lendingBorrowed > 0 && (
                <div className="text-xs" style={{ marginTop: 2, color: theme.danger }}>
                  Borrowed: {maskValue(formatPrice(lendingBorrowed))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="quick-stats" style={{ marginBottom: 20 }}>
        {liquidityData.length > 0 && (
          <div className="quick-stat">
            <div className="quick-dot liquidity" />
            <span className="fs-13 text-secondary">
              {liquidityData.length} Liquidity Pool{liquidityData.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {lendingData.length > 0 && (
          <div className="quick-stat">
            <div className="quick-dot lending" />
            <span className="fs-13 text-secondary">
              {lendingData.length} Lending Position{lendingData.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {stakingData.length > 0 && (
          <div className="quick-stat">
            <div className="quick-dot staking" />
            <span className="fs-13 text-secondary">
              {stakingData.length} Staking Position{stakingData.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Advanced Analytics */}
      <AdvancedAnalytics
        walletTokens={walletTokens}
        getLiquidityPoolsData={getLiquidityPoolsData}
        getLendingAndBorrowingData={getLendingAndBorrowingData}
        getStakingData={getStakingData}
        getLockingData={getLockingData}
        getTotalPortfolioValue={getTotalPortfolioValue}
        maskValue={maskValue}
        formatPrice={formatPrice}
        theme={theme}
        groupDefiByProtocol={groupDefiByProtocol}
        filterLendingDefiTokens={filterLendingDefiTokens}
        showLendingDefiTokens={showLendingDefiTokens}
      />
    </div>
  );
};

export default SummaryView;
