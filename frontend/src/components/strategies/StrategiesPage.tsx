/**
 * Strategies Page - Main Container
 * Menu with tabs for each strategy type
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../context/ThemeProvider';
import { StrategyType } from '../../types/strategy';
import { AllocationStrategySection } from './AllocationStrategySection';
import { getAvailableStrategies } from '../../utils/strategies/strategyFactory';
import { authenticateWallet, hasValidToken } from '../../services/apiClient';
import { estimateSolveTime } from '../../services/proofOfWork';
import type { WalletItem } from '../../types/wallet';

interface StrategiesPageProps {
  walletGroupId: string;
  portfolio: WalletItem[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const StrategiesPage: React.FC<StrategiesPageProps> = ({
  walletGroupId,
  portfolio
}) => {
  const { theme } = useTheme();
  const availableStrategies = getAvailableStrategies();
  const [activeTab, setActiveTab] = useState<StrategyType>(StrategyType.AllocationByWeight);
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [powProgress, setPowProgress] = useState(0);

  const isWalletGroup = UUID_REGEX.test(walletGroupId);
  const needsAuth = !isWalletGroup && walletGroupId && !hasValidToken(walletGroupId);

  useEffect(() => {
    if (isWalletGroup || !walletGroupId) {
      setAuthenticated(true);
      return;
    }
    if (hasValidToken(walletGroupId)) {
      setAuthenticated(true);
    } else {
      setAuthenticated(false);
    }
  }, [walletGroupId, isWalletGroup]);

  const handleAuthenticate = useCallback(async () => {
    setAuthenticating(true);
    setAuthError(null);
    setPowProgress(0);
    try {
      await authenticateWallet(walletGroupId, (nonce) => {
        setPowProgress(nonce);
      });
      setAuthenticated(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthenticating(false);
    }
  }, [walletGroupId]);

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

      {/* Auth Gate for direct wallet users */}
      {!authenticated && !isWalletGroup && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '20px',
            fontWeight: 600,
            color: theme.textPrimary
          }}>
            Authentication Required
          </h3>
          <p style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            color: theme.textSecondary,
            maxWidth: 400
          }}>
            Strategies require authentication. A short proof-of-work challenge will run in your browser ({estimateSolveTime(5)}).
          </p>
          {authError && (
            <p style={{ color: '#ef4444', margin: '0 0 16px 0', fontSize: '14px' }}>
              {authError}
            </p>
          )}
          <button
            onClick={handleAuthenticate}
            disabled={authenticating}
            style={{
              padding: '12px 32px',
              borderRadius: 8,
              border: 'none',
              background: authenticating ? theme.border : theme.accent,
              color: '#fff',
              fontSize: '15px',
              fontWeight: 600,
              cursor: authenticating ? 'not-allowed' : 'pointer',
            }}
          >
            {authenticating
              ? `Solving challenge... (${powProgress.toLocaleString()} hashes)`
              : 'Authenticate'}
          </button>
        </div>
      )}

      {/* Strategy Content */}
      {authenticated && (
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
      )}
    </div>
  );
};

export default StrategiesPage;
