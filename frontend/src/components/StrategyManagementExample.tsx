/**
 * Strategy Management Example
 * Complete example of how to use the Strategy Type 1 (Allocation by Weight) functionality
 * Version: 2.0 - Updated to use new factory-based architecture
 */

import React, { useState, useEffect } from 'react';
import { useAllocationStrategy } from '../hooks/strategies/useAllocationStrategy';
import { StrategyAllocationView } from '../components/StrategyAllocationView';
import { AllocationChart } from '../components/charts/AllocationChart';
import type { WalletItem } from '../types/wallet';
import type { AllocationDelta } from '../types/strategy';
import type { AllocationByWeightConfig } from '../types/strategies/allocationByWeight';

interface StrategyManagementExampleProps {
  walletGroupId: string;
  portfolio: WalletItem[];
}

export const StrategyManagementExample: React.FC<StrategyManagementExampleProps> = ({
  walletGroupId,
  portfolio
}) => {
  const {
    strategy,
    loading,
    error,
    saving,
    loadStrategy,
    saveAllocationStrategy,
    calculateDeltas
  } = useAllocationStrategy();

  const [showChart, setShowChart] = useState(true);
  const [deltas, setDeltas] = useState<AllocationDelta[]>([]);

  // Load existing strategy on mount
  useEffect(() => {
    if (walletGroupId) {
      loadStrategy(walletGroupId);
    }
  }, [walletGroupId, loadStrategy]);

  // Calculate deltas when strategy or portfolio changes
  useEffect(() => {
    if (strategy && portfolio.length > 0) {
      const calculatedDeltas = calculateDeltas(portfolio);
      setDeltas(calculatedDeltas);
    }
  }, [strategy, portfolio, calculateDeltas]);

  // Example: Create a new allocation strategy
  const handleCreateStrategy = async () => {
    try {
      // Define target allocations using new config format
      const config: AllocationByWeightConfig = {
        allocations: [
          { assetKey: 'cbBTC', group: 'Lending', weight: 50 },
          { assetKey: 'WETH', group: 'Lending', weight: 30 },
          { assetKey: 'SOL', group: 'Lending', weight: 20 }
        ],
        name: 'Conservative DeFi',
        description: '70% stable lending, 30% ETH/BTC pools'
      };

      // Save strategy with new API
      const response = await saveAllocationStrategy(
        walletGroupId,
        config,
        portfolio
      );

      console.log('Strategy saved:', response);
      alert(`Strategy saved successfully! Items: ${response.itemsCount}`);
    } catch (err) {
      console.error('Failed to create strategy:', err);
      alert(`Failed to create strategy: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Handle rebalance action
  const handleRebalance = (delta: AllocationDelta) => {
    console.log('Rebalance requested for:', delta);
    
    // In a real app, this would:
    // 1. Calculate exact swap amounts
    // 2. Find best routes across DEXs
    // 3. Prepare transaction(s)
    // 4. Show confirmation dialog
    // 5. Execute rebalance
    
    alert(
      `Rebalance ${delta.assetKey} in ${delta.group}\n` +
      `Action: ${delta.deltaWeight > 0 ? 'SELL' : 'BUY'}\n` +
      `Amount: $${Math.abs(delta.deltaValueUsd).toFixed(2)}`
    );
  };

  if (loading) {
    return <div className="loading">Loading strategy...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>Error: {error}</p>
        <button onClick={() => loadStrategy(walletGroupId)}>Retry</button>
      </div>
    );
  }

  return (
    <div className="strategy-management-example">
      <div className="header">
        <h1>Strategy Management</h1>
        <div className="actions">
          {!strategy && (
            <button 
              onClick={handleCreateStrategy}
              disabled={saving || portfolio.length === 0}
              className="button-primary"
            >
              {saving ? 'Creating...' : 'Create Example Strategy'}
            </button>
          )}
          <button 
            onClick={() => setShowChart(!showChart)}
            className="button-secondary"
          >
            {showChart ? 'Hide Chart' : 'Show Chart'}
          </button>
        </div>
      </div>

      {!strategy && (
        <div className="empty-state">
          <p>No strategy configured for this wallet group.</p>
          <p>Create a strategy to track your target asset allocations.</p>
        </div>
      )}

      {strategy && (
        <>
          {/* Chart View */}
          {showChart && deltas.length > 0 && (
            <div className="chart-section">
              <h2>Allocation Comparison</h2>
              <AllocationChart deltas={deltas} height={400} />
            </div>
          )}

          {/* Table View */}
          <div className="table-section">
            <StrategyAllocationView
              strategy={strategy}
              portfolio={portfolio}
              onRebalance={handleRebalance}
            />
          </div>

          {/* Strategy Info */}
          <div className="info-section">
            <h3>Strategy Details</h3>
            <dl>
              <dt>Type:</dt>
              <dd>Allocation by Weight (Type 1)</dd>
              
              <dt>Wallet Group:</dt>
              <dd>{strategy.walletGroupId}</dd>
              
              <dt>Accounts:</dt>
              <dd>{strategy.accounts.join(', ')}</dd>
              
              <dt>Items:</dt>
              <dd>{strategy.count}</dd>
              
              {strategy.createdAt && (
                <>
                  <dt>Created:</dt>
                  <dd>{new Date(strategy.createdAt).toLocaleString()}</dd>
                </>
              )}
              
              {strategy.updatedAt && (
                <>
                  <dt>Updated:</dt>
                  <dd>{new Date(strategy.updatedAt).toLocaleString()}</dd>
                </>
              )}
            </dl>
          </div>
        </>
      )}

      <style jsx>{`
        .strategy-management-example {
          max-width: 1400px;
          margin: 0 auto;
          padding: 24px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .header h1 {
          margin: 0;
          font-size: 32px;
          font-weight: 600;
        }

        .actions {
          display: flex;
          gap: 12px;
        }

        .button-primary,
        .button-secondary {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .button-primary {
          background: #007bff;
          color: white;
        }

        .button-primary:hover:not(:disabled) {
          background: #0056b3;
        }

        .button-primary:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .button-secondary {
          background: #6c757d;
          color: white;
        }

        .button-secondary:hover {
          background: #5a6268;
        }

        .loading,
        .error,
        .empty-state {
          padding: 48px;
          text-align: center;
          background: var(--color-surface);
          border-radius: 8px;
          border: 1px solid var(--color-border);
        }

        .error {
          color: var(--color-danger);
        }

        .empty-state {
          color: var(--color-text-secondary);
        }

        .chart-section,
        .table-section {
          margin-bottom: 32px;
        }

        .chart-section h2 {
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 600;
        }

        .info-section {
          padding: 24px;
          background: var(--color-surface);
          border-radius: 8px;
          border: 1px solid var(--color-border);
        }

        .info-section h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
        }

        .info-section dl {
          display: grid;
          grid-template-columns: 150px 1fr;
          gap: 12px;
          margin: 0;
        }

        .info-section dt {
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .info-section dd {
          margin: 0;
          color: var(--color-text-primary);
        }
      `}</style>
    </div>
  );
};

export default StrategyManagementExample;
