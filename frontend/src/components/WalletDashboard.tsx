import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { api } from '../config/api';
import { useMaskValues } from '../context/MaskValuesContext';

interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
  environment: string;
}

interface SupportedChain {
  name: string;
  id: string;
  chainId: number;
  displayName: string;
  iconUrl: string;
}

interface WalletData {
  account: string;
  network: string;
  items: any[];
  lastUpdated: string;
}

const WalletDashboard: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [chains, setChains] = useState<SupportedChain[]>([]);
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedChains, setSelectedChains] = useState<string[]>(['Base']);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { maskValues } = useMaskValues();

  // Check API health on component mount
  useEffect(() => {
    checkApiHealth();
    loadSupportedChains();
  }, []);

  const checkApiHealth = async () => {
    try {
      const response = await axios.get(api.health());
      setHealth(response.data);
    } catch (err) {
      console.error('Failed to check API health:', err);
      setError('Failed to connect to API');
    }
  };

  const loadSupportedChains = async () => {
    try {
      const response = await axios.get(api.getSupportedChains());
      setChains(response.data.chains || []);
    } catch (err) {
      console.error('Failed to load supported chains:', err);
    }
  };

  const loadWalletData = async () => {
    if (!walletAddress) {
      setError('Please enter a wallet address');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(api.getWallet(walletAddress, selectedChains));
      setWalletData(response.data);
    } catch (err: any) {
      console.error('Failed to load wallet data:', err);
      setError(err.response?.data?.error || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleChainToggle = (chainName: string) => {
    setSelectedChains(prev => 
      prev.includes(chainName) 
        ? prev.filter(c => c !== chainName)
        : [...prev, chainName]
    );
  };

  // Helper to mask address
  // Always return a fixed number of dots for mask mode
  const maskAddress = (_addr: string) => '••••••••••••••••••••••••••••••••••••••••';

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>?? Defi10 - DeFi Portfolio Dashboard</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Multi-chain DeFi portfolio tracking with real-time data from Base and BNB chains
      </p>
      
      {/* API Health Status */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h3>?? API Status</h3>
        {health ? (
          <div>
            <p><strong>Status:</strong> <span style={{ color: health.status === 'healthy' ? 'green' : 'red' }}>{health.status}</span></p>
            <p><strong>Environment:</strong> {health.environment}</p>
            <p><strong>Version:</strong> {health.version}</p>
            <p><strong>Last Check:</strong> {new Date(health.timestamp).toLocaleString()}</p>
          </div>
        ) : (
          <p style={{ color: 'red' }}>API not responding</p>
        )}
      </div>

      {/* Chain Selection */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <h3>?? Supported Blockchains</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {chains.map(chain => (
            <label key={chain.id} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input
                type="checkbox"
                checked={selectedChains.includes(chain.name)}
                onChange={() => handleChainToggle(chain.name)}
              />
              {chain.iconUrl && (
                <img 
                  src={chain.iconUrl} 
                  alt={chain.name} 
                  style={{ width: '20px', height: '20px' }}
                />
              )}
              <span>{chain.displayName}</span>
              <small>({chain.chainId})</small>
            </label>
          ))}
        </div>
      </div>

      {/* Wallet Input */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>?? Load DeFi Portfolio</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Enter wallet address (0x...)"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            style={{ 
              flex: 1, 
              padding: '10px', 
              border: '1px solid #ccc', 
              borderRadius: '4px',
              fontFamily: 'monospace'
            }}
          />
          <button
            onClick={loadWalletData}
            disabled={loading || !walletAddress}
            style={{
              padding: '10px 20px',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loading...' : '?? Load Portfolio'}
          </button>
        </div>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          Selected chains: {selectedChains.join(', ')} | Protocols: Aave, Uniswap V3, Moralis
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          border: '1px solid #f5c6cb', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Wallet Data Display */}
      {walletData && (
        <div style={{ padding: '15px', backgroundColor: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '8px' }}>
          <h3>?? Portfolio Summary</h3>
          <p><strong>Account:</strong> {
            maskValues ? (
              <span style={{ fontSize: 13, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', flex: '1 1 0%' }}>
                {maskAddress(walletData.account)}
              </span>
            ) : (
              <span style={{ fontSize: 13, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', flex: '1 1 0%' }}>
                {walletData.account}
              </span>
            )
          }</p>
          <p><strong>Network:</strong> {walletData.network}</p>
          <p><strong>Positions:</strong> {walletData.items.length}</p>
          <p><strong>Last Updated:</strong> {new Date(walletData.lastUpdated).toLocaleString()}</p>
          
          {walletData.items.length > 0 && (
            <details style={{ marginTop: '10px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                ?? View Detailed Data ({walletData.items.length} positions)
              </summary>
              <pre style={{ 
                backgroundColor: '#f8f9fa', 
                padding: '10px', 
                marginTop: '10px',
                overflow: 'auto',
                fontSize: '12px',
                borderRadius: '4px'
              }}>
                {JSON.stringify(walletData, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '40px', textAlign: 'center', color: '#666', fontSize: '14px' }}>
        <p>Defi10 - Multi-chain DeFi Portfolio Tracker | Powered by Moralis, Aave, Uniswap V3</p>
      </div>
    </div>
  );
};

export default WalletDashboard;