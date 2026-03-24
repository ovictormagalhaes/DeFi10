import React, { useState, useEffect, useCallback } from 'react';

import { useMaskValues } from '../context/MaskValuesContext';
import { getHealth, getSupportedChains } from '../services/apiClient';
import { HealthStatus, SupportedChain } from '../types/api';

import AggregationPanel from './AggregationPanel';
import Panel from './Panel';
import StatusBadge from './StatusBadge';

const WalletDashboard: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [chains, setChains] = useState<SupportedChain[]>([]);
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedChains, setSelectedChains] = useState<string[]>(['Base']);
  // loading state removed (aggregation panel manages async state)
  const [error, setError] = useState<string | null>(null);
  const { maskValues } = useMaskValues();

  // Check API health on component mount
  useEffect(() => {
    checkApiHealth();
    loadSupportedChains();
  }, []);

  const checkApiHealth = useCallback(async () => {
    try {
      const data = await getHealth();
      setHealth(data);
    } catch (err) {
      console.error('Failed to check API health:', err);
      setError('Failed to connect to API');
    }
  }, []);

  const loadSupportedChains = useCallback(async () => {
    try {
      const data = await getSupportedChains();
      setChains(data);
    } catch (err) {
      console.error('Failed to load supported chains:', err);
    }
  }, []);

  interface ApiErrorLike {
    response?: { data?: { error?: string; title?: string } };
    message?: string;
  }

  const getErrorMessage = (err: unknown): string => {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const e = err as ApiErrorLike;
      return (
        e.response?.data?.error ||
        e.response?.data?.title ||
        e.message ||
        'Failed to load wallet data'
      );
    }
    return 'Failed to load wallet data';
  };

  const loadWalletData = useCallback(() => {
    if (!walletAddress) {
      setError('Please enter a wallet address');
      return;
    }
    setError(null); // AggregationPanel will auto ensure job; no direct API call here
  }, [walletAddress]);

  const handleChainToggle = useCallback((chainName: string) => {
    setSelectedChains((prev) =>
      prev.includes(chainName) ? prev.filter((c) => c !== chainName) : [...prev, chainName]
    );
  }, []);

  // Helper to mask address
  // Always return a fixed number of dots for mask mode
  const maskAddress = (_addr: string) => '••••••••••••••••••••••••••••••••••••••••';

  return (
    <div className="page-container">
      <h1>Defi10 - DeFi Portfolio Dashboard</h1>
      <p className="muted mb-30">
        Multi-chain DeFi portfolio tracking with real-time data from Base and BNB chains
      </p>

      {/* API Health Status */}
      <Panel variant="neutral-light" className="mb-5">
        <h3>API Status</h3>
        {health ? (
          <div>
            <p>
              <strong>Status:</strong>{' '}
              <StatusBadge status={health.status === 'healthy' ? 'healthy' : 'unhealthy'} />
            </p>
            <p>
              <strong>Environment:</strong> {health.environment}
            </p>
            <p>
              <strong>Version:</strong> {health.version}
            </p>
            <p>
              <strong>Last Check:</strong> {new Date(health.timestamp).toLocaleString()}
            </p>
          </div>
        ) : (
          <div>
            {!error && <StatusBadge status="loading" />}
            {error && <StatusBadge status="unhealthy" label="API not responding" />}
          </div>
        )}
      </Panel>

      {/* Chain Selection */}
      <Panel variant="neutral-lighter" className="mb-5">
        <h3>Supported Blockchains</h3>
        <div className="chain-pill-bar" role="listbox" aria-label="Select blockchains">
          {chains.map((chain) => {
            const displayName = chain.displayName || chain.name || chain.id;
            const chainKey = chain.name || chain.displayName || chain.id;
            const active = chainKey ? selectedChains.includes(chainKey) : false;
            return (
              <button
                type="button"
                key={chain.id}
                role="option"
                aria-selected={active}
                className={`chain-pill ${active ? 'is-active' : ''}`}
                onClick={() => chainKey && handleChainToggle(chainKey)}
                title={active ? 'Click to remove chain' : 'Click to add chain'}
              >
                {chain.iconUrl && (
                  <img
                    src={chain.iconUrl}
                    alt=""
                    aria-hidden="true"
                    className="icon-14"
                    style={{ width: 14, height: 14, borderRadius: '50%' }}
                  />
                )}
                {displayName}
              </button>
            );
          })}
        </div>
        <p className="small muted mt-1">
          Tip: Click a pill to {`add/remove`} a chain. Active chains are highlighted.
        </p>
      </Panel>

      {/* Wallet Input */}
      <Panel className="mb-5 panel--surface-alt">
        <h3>🔍 Load DeFi Portfolio</h3>
        <div className="flex gap-10 align-center">
          <input
            type="text"
            placeholder="Enter wallet address (0x...)"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="input"
            aria-label="Wallet address"
          />
          <button
            type="button"
            className="btn-copy"
            onClick={() => {
              if (!walletAddress) return;
              navigator.clipboard
                .writeText(walletAddress)
                .then(() => {
                  const el = document.querySelector('.btn-copy');
                  if (el) {
                    el.classList.add('is-success');
                    setTimeout(() => el.classList.remove('is-success'), 1400);
                  }
                })
                .catch(() => {});
            }}
            disabled={!walletAddress}
            aria-disabled={!walletAddress}
            title={walletAddress ? 'Copy address to clipboard' : 'Enter an address first'}
          >
            Copy
          </button>
          <button onClick={loadWalletData} disabled={!walletAddress} className="btn">
            🚀 Load Portfolio
          </button>
        </div>
        <p className="small muted mt-1">
          Selected chains: {selectedChains.join(', ')} | Protocols: Aave, Uniswap V3, Moralis
        </p>
        <p className="small muted mt-1">
          💡 Tip: Use the <strong>wallet dropdown</strong> in the top-right header to manage{' '}
          <strong>Wallet Groups</strong> (up to 3 wallets)
        </p>
      </Panel>

      {/* Error Display */}
      {error && (
        <Panel variant="error" className="mb-5">
          <strong>Error:</strong> {error}
        </Panel>
      )}

      {/* Aggregation-based Panel */}
      {walletAddress && (
        <AggregationPanel account={walletAddress} chain={selectedChains[0] || 'Base'} />
      )}

      {/* Footer */}
      <div className="mt-40 footer">
        <p>Defi10 - Multi-chain DeFi Portfolio Tracker | Powered by Moralis, Aave, Uniswap V3</p>
      </div>
    </div>
  );
};

export default WalletDashboard;
