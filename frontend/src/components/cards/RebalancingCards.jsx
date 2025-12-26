import React from 'react';
import { useTheme } from '../../context/ThemeProvider.tsx';
import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import { formatPercent, formatUsd } from '../../utils/formatting';
import TokenDisplay from '../TokenDisplay.tsx';
import IconButton from '../IconButton';
import { RebalanceAssetType } from '../../constants/rebalanceEnums';

/**
 * RebalancingCards - Card view for rebalancing entries
 * @param {Array} entries - Rebalancing entries
 * @param {Function} onEdit - Edit callback
 * @param {Function} onDelete - Delete callback
 * @param {Object} entryCurrentValues - Map of entry ID to current value
 * @param {Object} bucketCurrentSums - Map of bucket key to current sum
 * @param {Object} bucketNoteSums - Map of bucket key to note sum
 * @param {Function} bucketKey - Function to generate bucket key
 * @param {Array} tokensList - List of available tokens
 * @param {Array} poolsList - List of available pools
 * @param {Array} lendingList - List of available lending positions
 * @param {Array} stakingList - List of available staking positions
 */
const RebalancingCards = ({ 
  entries = [], 
  onEdit, 
  onDelete,
  entryCurrentValues,
  bucketCurrentSums,
  bucketNoteSums,
  bucketKey,
  tokensList,
  poolsList,
  lendingList,
  stakingList,
}) => {
  const { theme } = useTheme();
  const { maskValue } = useMaskValues();

  if (!entries || entries.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 20px',
        color: theme.textSecondary,
        fontSize: 14,
      }}>
        No rebalancing entries
      </div>
    );
  }

  const fmtPct = (n) => formatPercent(n, { decimals: 2 });
  const fmtUSD = (n) => maskValue(formatUsd(n, { decimals: 2 }));

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 16,
      padding: '8px 0',
      maxWidth: '100%',
    }}>
      {entries.map((row) => {
        // Support both assetIds with {type, id} format and legacy assetId (single)
        const assetsWithType = row.assetIds || [{ type: row.assetType, id: row.assetId }];
        const bucket = bucketKey(row);
        const curSum = bucketCurrentSums.get(bucket) || 0;
        const noteSum = bucketNoteSums.get(bucket) || 0;
        const curVal = entryCurrentValues.get(row.id) || 0;
        const pctCurrent = curSum > 0 ? (curVal / curSum) * 100 : 0;
        const pctTarget = noteSum > 0 ? ((Number(row.note) || 0) / noteSum) * 100 : 0;
        const targetVal = noteSum > 0 ? ((Number(row.note) || 0) / noteSum) * curSum : 0;
        const diffVal = targetVal - curVal;
        const diffPct = pctTarget - pctCurrent;

        return (
          <div
            key={row.id}
            style={{
              backgroundColor: theme.bgPanel,
              border: `1px solid ${theme.border}`,
              borderRadius: 12,
              padding: 16,
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.accent;
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.border;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Header: Reference Label */}
            <div style={{ 
              fontSize: 11,
              fontWeight: 600,
              color: theme.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {row.referenceLabel}
            </div>

            {/* Assets List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {assetsWithType.slice(0, 10).map((asset, assetIdx) => {
                const assetId = asset.id || asset;
                const assetType = typeof asset.type === 'number' ? asset.type : (asset.type || row.assetType);
                let opt = null;
                
                if (assetType === RebalanceAssetType.Wallet)
                  opt = tokensList.find(o => o.id === assetId);
                else if (assetType === RebalanceAssetType.LiquidityPool)
                  opt = poolsList.find(o => o.id === assetId);
                else if (assetType === RebalanceAssetType.LendingAndBorrowing)
                  opt = lendingList.find(o => o.id === assetId);
                else if (assetType === RebalanceAssetType.Staking)
                  opt = stakingList.find(o => o.id === assetId);
                
                if (!opt) return null;
                
                const label = opt.label || assetId;
                let tokens = [];
                let lendingType = null;
                
                // Extract tokens for TokenDisplay
                if (assetType === RebalanceAssetType.Wallet) {
                  tokens = [opt.raw];
                } else if (assetType === RebalanceAssetType.LendingAndBorrowing) {
                  const pos = opt.raw?.position || opt.raw;
                  if (Array.isArray(pos?.tokens) && pos.tokens.length) {
                    tokens = pos.tokens.slice(0, 2).map((x) => (x && x.token ? x.token : x)).filter(Boolean);
                    const firstToken = pos.tokens[0];
                    if (firstToken?.type === 'borrowed' || firstToken?.type === 'borrow' || firstToken?.type === 'debt') {
                      lendingType = 'borrow';
                    } else {
                      lendingType = 'supply';
                    }
                  }
                } else {
                  const pos = opt.raw?.position || opt.raw;
                  if (Array.isArray(pos?.tokens) && pos.tokens.length) {
                    tokens = pos.tokens.slice(0, 2).map((x) => (x && x.token ? x.token : x)).filter(Boolean);
                  } else if (Array.isArray(pos?.pool?.tokens) && pos.pool.tokens.length) {
                    tokens = pos.pool.tokens.slice(0, 2).map((x) => (x && x.token ? x.token : x)).filter(Boolean);
                  } else {
                    const t0 = pos?.token0 || pos?.tokenA || pos?.baseToken || pos?.primaryToken;
                    const t1 = pos?.token1 || pos?.tokenB || pos?.quoteToken || pos?.secondaryToken;
                    if (t0) tokens.push(t0 && t0.token ? t0.token : t0);
                    if (t1) tokens.push(t1 && t1.token ? t1.token : t1);
                    tokens = tokens.filter(Boolean);
                  }
                }
                
                return (
                  <div
                    key={`${assetType}-${assetId}-${assetIdx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      background: theme.bgCard || theme.bgSecondary,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  >
                    {/* Type icon */}
                    <span style={{ fontSize: 16, opacity: 0.7 }} title={
                      assetType === 1 ? 'Wallet' :
                      assetType === 2 ? 'Liquidity Pool' :
                      assetType === 3 ? 'Lending Position' :
                      assetType === 4 ? 'Staking Position' : 
                      assetType === 8 ? 'Depositing Position' : 
                      assetType === 9 ? 'Locking Position' : 'Asset'
                    }>
                      {assetType === 1 ? '💼' : 
                       assetType === 2 ? '💧' : 
                       assetType === 3 ? '🏦' : 
                       assetType === 4 ? '🔒' : 
                       assetType === 8 ? '💰' : 
                       assetType === 9 ? '🔐' : '📦'}
                    </span>
                    {tokens.length > 0 && TokenDisplay && (
                      <TokenDisplay
                        tokens={tokens}
                        showName={false}
                        showText={false}
                        size={20}
                        gap={6}
                        showChain={true}
                      />
                    )}
                    <span style={{ 
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: theme.textPrimary,
                      fontWeight: 500,
                    }}>
                      {label}
                    </span>
                    {lendingType && (
                      <span style={{
                        fontSize: 9,
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 700,
                        background: lendingType === 'borrow' 
                          ? 'rgba(239, 68, 68, 0.15)' 
                          : 'rgba(34, 197, 94, 0.15)',
                        color: lendingType === 'borrow' 
                          ? 'rgb(239, 68, 68)' 
                          : 'rgb(34, 197, 94)',
                      }}>
                        {lendingType === 'borrow' ? 'BORROW' : 'SUPPLY'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Metrics Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
              marginTop: 8,
            }}>
              {/* Current */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}>
                <span style={{ 
                  fontSize: 11, 
                  color: theme.textSecondary,
                  fontWeight: 500,
                }}>
                  Current
                </span>
                <span style={{ 
                  fontSize: 16, 
                  fontWeight: 600,
                  color: theme.textPrimary,
                  fontFamily: 'monospace',
                }}>
                  {fmtPct(Math.max(0, pctCurrent))}
                </span>
                <span style={{ 
                  fontSize: 11, 
                  color: theme.textSecondary,
                  fontFamily: 'monospace',
                }}>
                  {fmtUSD(curVal)}
                </span>
              </div>

              {/* Target */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}>
                <span style={{ 
                  fontSize: 11, 
                  color: theme.textSecondary,
                  fontWeight: 500,
                }}>
                  Target
                </span>
                <span style={{ 
                  fontSize: 16, 
                  fontWeight: 600,
                  color: theme.textPrimary,
                  fontFamily: 'monospace',
                }}>
                  {fmtPct(Math.max(0, pctTarget))}
                </span>
                <span style={{ 
                  fontSize: 11, 
                  color: theme.textSecondary,
                  fontFamily: 'monospace',
                }}>
                  {fmtUSD(targetVal)}
                </span>
              </div>
            </div>

            {/* Diff Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 12px',
              borderRadius: 8,
              background: diffPct > 0 
                ? 'rgba(34, 197, 94, 0.1)' 
                : diffPct < 0 
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(156, 163, 175, 0.1)',
            }}>
              <span style={{
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'monospace',
                color: diffPct > 0 
                  ? theme.success || '#22c55e'
                  : diffPct < 0 
                    ? theme.danger || '#ef4444'
                    : theme.textSecondary,
              }}>
                {diffPct > 0 ? '▲' : diffPct < 0 ? '▼' : '•'} {formatPercent(diffPct, { decimals: 2, sign: true })}
              </span>
              <span style={{
                fontSize: 11,
                marginLeft: 8,
                color: theme.textSecondary,
                fontFamily: 'monospace',
              }}>
                ({fmtUSD(diffVal)})
              </span>
            </div>

            {/* Note */}
            {row.note && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(59, 130, 246, 0.1)',
              }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: theme.textPrimary,
                }}>
                  📝 {row.note}
                </span>
              </div>
            )}

            {/* Actions - Bottom Right */}
            <div style={{
              display: 'flex',
              gap: 4,
              justifyContent: 'flex-end',
              marginTop: 'auto',
              paddingTop: 8,
            }}>
              <IconButton
                label="Edit"
                size={32}
                onClick={() => onEdit(row)}
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                }
              />
              <IconButton
                label="Delete"
                size={32}
                variant="danger"
                onClick={() => onDelete(row.id)}
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RebalancingCards;
