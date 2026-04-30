import React, { useState, useCallback, useEffect } from 'react';
import { useV2 } from '../context/V2Context';
import { authenticateWallet, hasValidToken } from '../../services/apiClient';
import { estimateSolveTime } from '../../services/proofOfWork';
import { AllocationStrategySection } from '../components/strategies/AllocationStrategySection';
import { StrategyType } from '../../types/strategy';
import ErrorScreen from '../components/shared/ErrorScreen';
import s from './StrategiesPage.module.css';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TYPES = [
  { type: StrategyType.AllocationByWeight, icon: '⚖️', label: 'Allocation', desc: 'Target weights & rebalancing' },
  { type: StrategyType.HealthFactorTarget, icon: '🛡️', label: 'Health Factor', desc: 'Per-position liquidation targets' },
  { type: StrategyType.BestPurchaseWindow, icon: '📈', label: 'Purchase Window', desc: 'Price signals & entry conditions' },
];

export const StrategiesPage: React.FC = () => {
  const { account, selectedWalletGroupId, walletData } = useV2();
  const [activeType, setActiveType] = useState(StrategyType.AllocationByWeight);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [powProgress, setPowProgress] = useState(0);

  const walletGroupId = selectedWalletGroupId ?? account ?? '';
  const portfolio: any[] = walletData?.items ?? [];
  const isWalletGroup = UUID_REGEX.test(walletGroupId);

  useEffect(() => {
    if (isWalletGroup || !walletGroupId) {
      setAuthenticated(true);
    } else if (hasValidToken(walletGroupId)) {
      setAuthenticated(true);
    } else {
      setAuthenticated(false);
    }
  }, [walletGroupId, isWalletGroup]);

  const handleAuthenticate = useCallback(async () => {
    setAuthenticating(true);
    setAuthError(null);
    try {
      await authenticateWallet(walletGroupId, (nonce) => setPowProgress(nonce));
      setAuthenticated(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthenticating(false);
    }
  }, [walletGroupId]);

  return (
    <div className={s.page}>
      <div className={s.pageHeader}>
        <div className={s.pageLabel}>Portfolio</div>
        <div className={s.pageTitle}>Strategies</div>
        <div className={s.pageSub}>Rule-based automation for your DeFi positions</div>
      </div>

      <div className={s.typeRow}>
        {TYPES.map(t => {
          const count = counts[t.type] ?? 0;
          return (
            <button
              key={t.type}
              className={`${s.typeBtn} ${activeType === t.type ? s.typeBtnActive : ''}`}
              onClick={() => setActiveType(t.type)}
            >
              <div className={s.typeIcon}>{t.icon}</div>
              <div className={s.typeMeta}>
                <div className={s.typeName}>{t.label}</div>
                <div className={s.typeDesc}>{t.desc}</div>
              </div>
              <div className={`${s.typeBadge} ${count === 0 ? s.typeBadgeEmpty : ''}`}>
                {count > 0 ? `${count} active` : '0'}
              </div>
            </button>
          );
        })}
      </div>

      {!authenticated && !isWalletGroup && !authError && (
        <div className={s.authGate}>
          <div className={s.authIcon}>🔐</div>
          <div className={s.authTitle}>Authentication Required</div>
          <div className={s.authSub}>
            Strategies require authentication. A short proof-of-work challenge will run in your browser{' '}
            <span className={s.powTime}>({estimateSolveTime(5)})</span>.
          </div>
          <button
            className={s.authBtn}
            onClick={handleAuthenticate}
            disabled={authenticating}
          >
            {authenticating
              ? `Solving… (${powProgress.toLocaleString()} hashes)`
              : 'Authenticate Wallet'}
          </button>
        </div>
      )}

      {authError && (
        <ErrorScreen
          error={authError}
          onRetry={() => { setAuthError(null); handleAuthenticate(); }}
        />
      )}

      {authenticated && (
        <AllocationStrategySection
          walletGroupId={walletGroupId}
          portfolio={portfolio}
          activeType={activeType}
          onCountsChange={setCounts}
        />
      )}
    </div>
  );
};

export default StrategiesPage;
