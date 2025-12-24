import { useState, useEffect, useCallback, useRef } from 'react';

import { api } from '../config/api';
import { STORAGE_KEY, EXPIRY_HOURS, API_BASE } from '../constants/config';
import { WALLETS, detectAvailableWallets, hasAnyWallet, getWalletNames, getWalletById } from '../constants/wallets';

// Custom hook for wallet connection and account management
export function useWalletConnection() {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [supportedChains, setSupportedChains] = useState([]);
  const [chainsLoading, setChainsLoading] = useState(false);
  const chainsFetchedRef = useRef(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [availableWallets, setAvailableWallets] = useState({});
  const [pendingConnection, setPendingConnection] = useState(null); // { walletName, walletIcon, walletColor }

  const fetchSupportedChains = useCallback(async ({ force } = {}) => {
    if (chainsFetchedRef.current && !force) return;
    if (!chainsFetchedRef.current) chainsFetchedRef.current = true;
    try {
      setChainsLoading(true);
      const res = await fetch(`${API_BASE}/wallets/supported-chains`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSupportedChains(data);
        } else if (data) {
          if (Array.isArray(data.supportedChains)) setSupportedChains(data.supportedChains);
          else if (Array.isArray(data.chains)) setSupportedChains(data.chains);
          else if (Array.isArray(data.data)) setSupportedChains(data.data);
        }
      } else {
        console.error('Failed to fetch supported chains', res.status);
      }
    } catch (err) {
      console.error('Error fetching supported chains', err);
    } finally {
      setChainsLoading(false);
    }
  }, []);

  // Stable wrapper so components can depend on a memoized function (prevents effect loops)
  const refreshSupportedChains = useCallback(
    (force = false) => fetchSupportedChains({ force }),
    [fetchSupportedChains]
  );

  // Save account with expiry
  function saveAccount(addr) {
    const data = {
      account: addr,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setAccount(addr);
  }

  // Load account from storage
  function loadAccount() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    try {
      const data = JSON.parse(stored);
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

  // Connect to wallet - opens dialog for user to choose
  async function connectWallet() {
    // No wallet installed
    if (!hasAnyWallet()) {
      alert(`No wallet found. Please install ${getWalletNames()}.`);
      return;
    }

    // Set available wallets and show selector
    setAvailableWallets(detectAvailableWallets());
    setShowWalletSelector(true);
  }

  // Connect to specific wallet
  async function connectToWallet(walletType) {
    setShowWalletSelector(false);

    const wallet = getWalletById(walletType);
    if (!wallet) {
      console.error(`Unknown wallet type: ${walletType}`);
      return;
    }

    console.log(`[Connect] Starting connection to ${wallet.name}`);
    
    // Show pending connection screen
    const startTime = Date.now();
    setPendingConnection({
      walletName: wallet.name,
      walletIcon: wallet.icon,
      walletColor: wallet.color,
    });

    try {
      if (wallet.type === 'solana') {
        console.log('[Connect] Requesting Solana connection...');
        const response = await window.solana.connect({ onlyIfTrusted: false });
        const publicKey = response.publicKey.toString();
        console.log('[Connect] Solana connected:', publicKey);
        saveAccount(publicKey);
      } else if (wallet.type === 'evm') {
        const provider = walletType === 'rabby' && window.rabby ? window.rabby : window.ethereum;
        console.log(`[Connect] Requesting EVM accounts from ${walletType}...`);
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        const acc = accounts[0];
        console.log('[Connect] EVM connected:', acc);
        saveAccount(acc);
      }
      
      // Minimum display time of 500ms so user sees the screen
      const elapsed = Date.now() - startTime;
      const minDelay = Math.max(0, 500 - elapsed);
      if (minDelay > 0) {
        console.log(`[Connect] Waiting ${minDelay}ms before closing...`);
        await new Promise(resolve => setTimeout(resolve, minDelay));
      }
      
      console.log('[Connect] Success - closing pending screen');
      setPendingConnection(null);
    } catch (error) {
      console.error(`[Connect] Error connecting ${wallet.name}:`, error);
      setPendingConnection(null);
      
      const isUserRejection = error.code === 4001 || error.message?.includes('User rejected');
      if (!isUserRejection) {
        alert(`Failed to connect ${wallet.name}. Please try again.`);
      } else {
        console.log('[Connect] User rejected the connection');
      }
    }
  }

  // Copy address to clipboard
  async function copyAddress() {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      alert('Address copied!');
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }

  // Disconnect wallet (both MetaMask and Phantom)
  async function disconnect() {
    localStorage.removeItem(STORAGE_KEY);
    setAccount(null);

    // Disconnect Phantom if connected
    if (window.solana && window.solana.isPhantom && window.solana.isConnected) {
      try {
        await window.solana.disconnect();
      } catch (error) {
        console.error('Error disconnecting Phantom:', error);
      }
    }
  }

  // Load account on mount (only from localStorage, no auto-reconnect)
  useEffect(() => {
    const savedAccount = loadAccount();
    if (savedAccount) {
      setAccount(savedAccount);
    }
    // Note: We don't auto-reconnect to wallet extensions here
    // User must explicitly click "Connect Wallet" button
  }, []);

  // Listen for account changes (both MetaMask and Phantom)
  useEffect(() => {
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        saveAccount(accounts[0]);
      }
    };

    const handlePhantomAccountChanged = (publicKey) => {
      if (publicKey) {
        saveAccount(publicKey.toString());
      } else {
        disconnect();
      }
    };

    // MetaMask listener
    if (window.ethereum) {
      window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    }

    // Phantom listener
    if (window.solana && window.solana.isPhantom) {
      window.solana.on?.('accountChanged', handlePhantomAccountChanged);
      window.solana.on?.('disconnect', disconnect);
    }

    return () => {
      // Cleanup MetaMask listeners
      if (window.ethereum) {
        window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      }

      // Cleanup Phantom listeners
      if (window.solana && window.solana.isPhantom) {
        window.solana.removeListener?.('accountChanged', handlePhantomAccountChanged);
        window.solana.removeListener?.('disconnect', disconnect);
      }
    };
  }, []);

  const getRebalances = useCallback(async (accountId) => {
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

// useWalletData removed: legacy /wallets/accounts API deprecated in favor of aggregation jobs.

// Custom hook for tooltip management
export function useTooltip() {
  const [tooltipVisible, setTooltipVisible] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Tooltip handlers
  function showTooltip(event, content, tokenIndex) {
    const rect = event.target.getBoundingClientRect();
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
    setTooltipVisible(`${content}-${tokenIndex}`);
  }

  function hideTooltip() {
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
