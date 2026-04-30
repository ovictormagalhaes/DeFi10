import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';

import { V2Provider, useV2 } from './context/V2Context';
import V2Header from './components/layout/V2Header';
import DashboardPage from './pages/DashboardPage';
import StrategiesPage from './pages/StrategiesPage';
import ConnectWalletScreen from '../components/ConnectWalletScreen';
import WalletSelectorDialog from '../components/WalletSelectorDialog';
import WalletGroupModal from './components/dialogs/WalletGroupModal';
import WalletConnectionPending from '../components/WalletConnectionPending';
import { useWalletConnection } from '../hooks/useWallet';
import { useTheme } from '../context/ThemeProvider';
import { onTokenExpired, hasValidToken, connectWalletGroup } from '../services/apiClient';
import { WALLET_GROUPS_KEY } from '../constants/storageKeys';
import type { WalletGroup } from '../types/wallet-groups';

import './v2.css';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function useUrlGroupId() {
  const params = useParams<{ groupId?: string }>();
  return params.groupId && UUID_RE.test(params.groupId) ? params.groupId : null;
}

function resolveGroupId(groupId: string): 'ok' | 'needs-auth' {
  try {
    const groups = JSON.parse(localStorage.getItem(WALLET_GROUPS_KEY) ?? '[]') as { id: string }[];
    const exists = groups.some(g => g.id === groupId);
    const tokenValid = hasValidToken(groupId);
    return exists && tokenValid ? 'ok' : 'needs-auth';
  } catch {
    return 'needs-auth';
  }
}

const V2Inner: React.FC = () => {
  const {
    account,
    connectWallet,
    connectToWallet,
    showWalletSelector,
    setShowWalletSelector,
    availableWallets,
    pendingConnection,
    setPendingConnection,
    supportedChains: walletSupportedChains,
  } = useWalletConnection();

  const {
    account: ctxAccount,
    setAccount,
    selectedWalletGroupId,
    setSelectedWalletGroupId,
    setSupportedChains,
  } = useV2();

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);

  const urlGroupId = useUrlGroupId();
  const [resolvingUrlGroup, setResolvingUrlGroup] = useState<boolean>(!!urlGroupId);
  const navigate = useNavigate();
  const { theme } = useTheme();

  useEffect(() => { setAccount(account); }, [account, setAccount]);

  useEffect(() => {
    if (walletSupportedChains.length) setSupportedChains(walletSupportedChains);
  }, [walletSupportedChains, setSupportedChains]);

  useEffect(() => {
    return onTokenExpired((expiredGroupId) => {
      if (expiredGroupId === selectedWalletGroupId) {
        setPendingGroupId(expiredGroupId);
        setIsGroupModalOpen(true);
      }
    });
  }, [selectedWalletGroupId]);

  useEffect(() => {
    if (!urlGroupId) {
      setResolvingUrlGroup(false);
      return;
    }
    const status = resolveGroupId(urlGroupId);
    if (status === 'ok') {
      setSelectedWalletGroupId(urlGroupId);
      setResolvingUrlGroup(false);
      return;
    }

    let cancelled = false;
    setResolvingUrlGroup(true);
    (async () => {
      try {
        const response = await connectWalletGroup(urlGroupId, {});
        if (cancelled) return;
        const group: WalletGroup = {
          id: response.walletGroupId,
          wallets: response.wallets,
          displayName: response.displayName,
          createdAt: response.createdAt,
        };
        try {
          const stored = localStorage.getItem(WALLET_GROUPS_KEY);
          const existing: WalletGroup[] = stored ? JSON.parse(stored) : [];
          const idx = existing.findIndex((g) => g.id === group.id);
          if (idx >= 0) existing[idx] = group;
          else existing.push(group);
          localStorage.setItem(WALLET_GROUPS_KEY, JSON.stringify(existing));
        } catch {}
        setSelectedWalletGroupId(urlGroupId);
      } catch {
        if (cancelled) return;
        setPendingGroupId(urlGroupId);
        setIsGroupModalOpen(true);
      } finally {
        if (!cancelled) setResolvingUrlGroup(false);
      }
    })();

    return () => { cancelled = true; };
  }, [urlGroupId, setSelectedWalletGroupId]);

  const handleGroupSelected = (groupId: string) => {
    setSelectedWalletGroupId(groupId);
    setIsGroupModalOpen(false);
    setPendingGroupId(null);
    navigate(`/portfolio/${groupId}`);
  };

  const handleGroupModalClose = () => {
    setIsGroupModalOpen(false);
    setPendingGroupId(null);
  };

  const isConnected = !!(ctxAccount || selectedWalletGroupId);

  if (resolvingUrlGroup && !isConnected) {
    return (
      <div
        className="v2"
        style={{ minHeight: '100vh', background: 'var(--v2-bg)' }}
      />
    );
  }

  if (!isConnected) {
    return (
      <div className="v2" style={{ minHeight: '100vh', background: 'var(--v2-bg)' }}>
        <ConnectWalletScreen
          theme={theme}
          onConnect={connectWallet}
          onManageGroups={() => setIsGroupModalOpen(true)}
        />

        <WalletSelectorDialog
          isOpen={showWalletSelector}
          onClose={() => setShowWalletSelector(false)}
          onSelectWallet={connectToWallet}
          availableWallets={availableWallets}
        />

        <WalletConnectionPending
          isOpen={!!pendingConnection}
          onClose={() => setPendingConnection(null)}
          walletName={pendingConnection?.walletName}
          walletIcon={pendingConnection?.walletIcon}
          walletColor={pendingConnection?.walletColor}
        />

        <WalletGroupModal
          isOpen={isGroupModalOpen}
          onClose={handleGroupModalClose}
          onGroupSelected={handleGroupSelected}
          currentWalletAddress={account}
          initialGroupId={pendingGroupId}
        />
      </div>
    );
  }

  return (
    <div className="v2" style={{ minHeight: '100vh', background: 'var(--v2-bg)' }}>
      <V2Header onOpenWalletGroups={() => setIsGroupModalOpen(true)} />
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="strategies" element={<StrategiesPage />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Routes>

      <WalletGroupModal
        isOpen={isGroupModalOpen}
        onClose={handleGroupModalClose}
        onGroupSelected={handleGroupSelected}
        currentWalletAddress={account}
        initialGroupId={pendingGroupId}
      />
    </div>
  );
};

const V2App: React.FC = () => (
  <V2Provider>
    <V2Inner />
  </V2Provider>
);

export default V2App;
