/**
 * Strategies Page - Main Container
 * Menu with tabs for each strategy type
 */

import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeProvider';
import { StrategyType } from '../../types/strategy';
import { AllocationStrategySection } from './AllocationStrategySection';
import { getAvailableStrategies } from '../../utils/strategies/strategyFactory';
import type { WalletItem } from '../../types/wallet';

interface StrategiesPageProps {
  walletGroupId: string;
  portfolio: WalletItem[];
}

export const StrategiesPage: React.FC<StrategiesPageProps> = ({
  walletGroupId,
  portfolio
}) => {
  const { theme } = useTheme();
  const availableStrategies = getAvailableStrategies();
  const [activeTab, setActiveTab] = useState<StrategyType>(StrategyType.AllocationByWeight);

  // Filter only available strategies
  const enabledStrategies = availableStrategies.filter(s => s.available);

  // Responsive padding (matches main app pattern)
  const [viewportWidth, setViewportWidth] = React.useState(window.innerWidth);

  React.useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidePadding =
    viewportWidth >= 1100
      ? '4%'
      : viewportWidth >= 800
        ? 'max(2%, 12px)'
        : viewportWidth >= 480
          ? '20px'
          : '12px';

  return (
    <div style={{
      maxWidth: '100%',
      margin: '0 auto',
      padding: `8px ${sidePadding} 16px ${sidePadding}`,
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{
            margin: '0 0 8px 0',
            fontSize: '32px',
            fontWeight: 600,
            color: theme.textPrimary
          }}>
            📊 Strategies
          </h1>
          <p style={{
            margin: 0,
            fontSize: '16px',
            color: theme.textSecondary
          }}>
            Create and manage portfolio strategies to optimize your DeFi positions
          </p>
        </div>
      </div>

      {/* Strategy Content */}
      <div style={{ minHeight: '400px' }}>
        {activeTab === StrategyType.AllocationByWeight && (
          <AllocationStrategySection
            walletGroupId={walletGroupId}
            portfolio={portfolio}
          />
        )}
        
        {/* Placeholder for future types */}
        {activeTab !== StrategyType.AllocationByWeight && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 20px',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '64px',
              marginBottom: '16px'
            }}>
              🚧
            </div>
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '24px',
              fontWeight: 600,
              color: theme.textPrimary
            }}>
              Coming Soon
            </h3>
            <p style={{
              margin: 0,
              fontSize: '16px',
              color: theme.textSecondary
            }}>
              This strategy type is under development.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategiesPage;
