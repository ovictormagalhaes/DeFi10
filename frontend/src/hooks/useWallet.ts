import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';

import { api } from '../config/api';
import { SUPPORTED_CHAINS } from '../constants/chains';
import { STORAGE_KEY, EXPIRY_HOURS } from '../constants/config';
import {
  detectAvailableWallets,
  hasAnyWallet,
  getWalletNames,
  getWalletById,
} from '../constants/wallets';
import type { WalletConfig } from '../constants/wallets';

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  [key: string]: any;
}

interface SolanaProvider {
  isPhantom?: boolean;
  isConnected?: boolean;
  connect: (opts?: {
    onlyIfTrusted?: boolean;
  }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  [key: string]: any;
}

interface PendingConnection {
  walletName: string;
  walletIcon: string;
  walletColor: string;
}

interface TooltipPosition {
  x: number;
  y: number;
}

interface StoredAccount {
  account: string;
  timestamp: number;
}

interface UseWalletConnectionReturn {
  account: string | null;
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  supportedChains: any[];
  chainsLoading: boolean;
  refreshSupportedChains: (force?: boolean) => void;
  connectWallet: () => Promise<void>;
  connectToWallet: (walletType: string) => Promise<void>;
  showWalletSelector: boolean;
  setShowWalletSelector: Dispatch<SetStateAction<boolean>>;
  availableWallets: Record<string, boolean>;
  pendingConnection: PendingConnection | null;
  setPendingConnection: Dispatch<SetStateAction<PendingConnection | null>>;
  copyAddress: () => Promise<void>;
  disconnect: () => Promise<void>;
  getRebalances: (accountId: string) => Promise<any | null>;
}

interface UseTooltipReturn {
  tooltipVisible: string | null;
  tooltipPosition: TooltipPosition;
  showTooltip: (event: React.MouseEvent, content: string, tokenIndex: number) => void;
  hideTooltip: () => void;
  setTooltipPosition: Dispatch<SetStateAction<TooltipPosition>>;
}

export function useWalletConnection(): UseWalletConnectionReturn {
  const [account, setAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supportedChains = SUPPORTED_CHAINS;
  const chainsLoading = false;
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<Record<string, boolean>>({});
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);

  const refreshSupportedChains = useCallback(() => {}, []);

  function saveAccount(addr: string): void {
    const data: StoredAccount = {
      account: addr,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setAccount(addr);
  }

  function loadAccount(): string | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    try {
      const data: StoredAccount = JSON.parse(stored);
      const elapsed = Date.now() - data.timestamp;
      const maxAge = EXPIRY_HOURS * 60 * 60 * 1000;

      if (elapsed > maxAge) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return data.account;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  async function connectWallet(): Promise<void> {
    if (!hasAnyWallet()) {
      alert(`No wallet found. Please install ${getWalletNames()}.`);
      return;
    }

    setAvailableWallets(detectAvailableWallets());
    setShowWalletSelector(true);
  }

  async function connectToWallet(walletType: string): Promise<void> {
    setShowWalletSelector(false);

    const wallet = getWalletById(walletType);
    if (!wallet) {
      console.error(`Unknown wallet type: ${walletType}`);
      return;
    }

    const startTime = Date.now();
    setPendingConnection({
      walletName: wallet.name,
      walletIcon: wallet.icon,
      walletColor: wallet.color,
    });

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    try {
      if (wallet.type === 'solana') {
        const response = await window.solana.connect({ onlyIfTrusted: false });
        const publicKey = response.publicKey.toString();
        saveAccount(publicKey);
      } else if (wallet.type === 'evm') {
        const provider = walletType === 'rabby' && window.rabby ? window.rabby : window.ethereum;
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        const acc = accounts[0];
        saveAccount(acc);
      }

      const elapsed = Date.now() - startTime;
      const minDelay = Math.max(0, 500 - elapsed);
      if (minDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, minDelay));
      }

      setPendingConnection(null);
    } catch (error: any) {
      console.error(`[Connect] Error connecting ${wallet.name}:`, error);
      setPendingConnection(null);

      const isUserRejection = error.code === 4001 || error.message?.includes('User rejected');
      if (!isUserRejection) {
        alert(`Failed to connect ${wallet.name}. Please try again.`);
      }
    }
  }

  async function copyAddress(): Promise<void> {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      alert('Address copied!');
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }

  async function disconnect(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
    setAccount(null);

    if (window.solana && window.solana.isPhantom && window.solana.isConnected) {
      try {
        await window.solana.disconnect();
      } catch (error) {
        console.error('Error disconnecting Phantom:', error);
      }
    }
  }

  useEffect(() => {
    const savedAccount = loadAccount();
    if (savedAccount) {
      setAccount(savedAccount);
    }
  }, []);

  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        saveAccount(accounts[0]);
      }
    };

    const handlePhantomAccountChanged = (publicKey: any) => {
      if (publicKey) {
        saveAccount(publicKey.toString());
      } else {
        disconnect();
      }
    };

    if (window.ethereum) {
      window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    }

    if (window.solana && window.solana.isPhantom) {
      window.solana.on?.('accountChanged', handlePhantomAccountChanged);
      window.solana.on?.('disconnect', disconnect);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      }

      if (window.solana && window.solana.isPhantom) {
        window.solana.removeListener?.('accountChanged', handlePhantomAccountChanged);
        window.solana.removeListener?.('disconnect', disconnect);
      }
    };
  }, []);

  const getRebalances = useCallback(async (accountId: string): Promise<any | null> => {
    if (!accountId) return null;
    try {
      const res = await fetch(api.getRebalances(accountId));
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('getRebalances failed', e);
      return null;
    }
  }, []);

  return {
    account,
    loading,
    setLoading,
    supportedChains,
    chainsLoading,
    refreshSupportedChains,
    connectWallet,
    connectToWallet,
    showWalletSelector,
    setShowWalletSelector,
    availableWallets,
    pendingConnection,
    setPendingConnection,
    copyAddress,
    disconnect,
    getRebalances,
  };
}

export function useTooltip(): UseTooltipReturn {
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ x: 0, y: 0 });

  function showTooltip(event: React.MouseEvent, content: string, tokenIndex: number): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
    setTooltipVisible(`${content}-${tokenIndex}`);
  }

  function hideTooltip(): void {
    setTooltipVisible(null);
  }

  return {
    tooltipVisible,
    tooltipPosition,
    showTooltip,
    hideTooltip,
    setTooltipPosition,
  };
}
