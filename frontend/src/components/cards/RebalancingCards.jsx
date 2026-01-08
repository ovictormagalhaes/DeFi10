import React from 'react';
import { useTheme } from '../../context/ThemeProvider.tsx';
import { useMaskValues } from '../../context/MaskValuesContext.tsx';
import { formatPercent, formatUsd } from '../../utils/formatting';
import TokenDisplay from '../TokenDisplay.tsx';
import IconButton from '../IconButton';
import { RebalanceAssetType } from '../../constants/rebalanceEnums';

/**
 * RebalancingCards - Card view for strategy entries
 * @param {Array} entries - Strategy entries
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
  const [expandedAssets, setExpandedAssets] = React.useState({});

  const toggleAssets = (rowId) => {
    setExpandedAssets(prev => ({
      ...prev,
      [rowId]: !prev[rowId]
    }));
  };

  if (!entries || entries.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px 20px',
        color: theme.textSecondary,
        fontSize: 14,
      }}>
        No strategy entries
      </div>
    );
  }

  const fmtPct = (n) => formatPercent(n, { decimals: 2 });
  const fmtUSD = (n) => maskValue(formatUsd(n, { decimals: 2 }));

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
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
            {/* Assets List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(() => {
                const firstAsset = assetsWithType[0];
                const remainingAssets = assetsWithType.slice(1);
                const hasMultiple = assetsWithType.length > 1;
                const isExpanded = expandedAssets[row.id];
                
                const renderAsset = (asset, assetIdx) => {
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
                      
                      // Check position label/key first
                      const positionLabel = pos.label?.toLowerCase() || pos.key?.toLowerCase() || pos.name?.toLowerCase() || '';
                      const isBorrowPosition = positionLabel.includes('borrow') || positionLabel.includes('debt');
                      
                      // Check all tokens to find if any is borrowed
                      const hasBorrowedToken = pos.tokens.some(t => {
                        const tokenType = t?.type?.toLowerCase();
                        const tokenLabel = t?.label?.toLowerCase() || t?.name?.toLowerCase() || '';
                        const hasDebt = t?.debt === true || t?.debt > 0;
                        const negativeBalance = t?.balance && t.balance < 0;
                        const negativePrice = (t?.totalPrice || t?.financials?.totalPrice || 0) < 0;
                        
                        const isBorrowed = tokenType === 'borrowed' || 
                               tokenType === 'borrow' || 
                               tokenType === 'debt' ||
                               tokenLabel.includes('borrow') ||
                               tokenLabel.includes('debt') ||
                               hasDebt || 
                               negativeBalance ||
                               negativePrice;
                        
                        return isBorrowed;
                      });
                      
                      if (isBorrowPosition || hasBorrowedToken) {
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
                  
                  const isFirstAsset = assetIdx === 0;
                  
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
                      {/* Type icon - monocromático e à direita */}
                      <span 
                        style={{ 
                          fontSize: 16, 
                          opacity: 0.5,
                          filter: 'grayscale(1)',
                          display: 'flex',
                          alignItems: 'center',
                        }} 
                        title={
                          assetType === 1 ? 'Wallet' :
                          assetType === 2 ? 'Liquidity Pool' :
                          assetType === 3 ? 'Lending Position' :
                          assetType === 4 ? 'Staking Position' : 
                          assetType === 8 ? 'Depositing Position' : 
                          assetType === 9 ? 'Locking Position' : 'Asset'
                        }
                      >
                        {assetType === 1 ? '💼' : 
                         assetType === 2 ? '💧' : 
                         assetType === 3 ? '🏦' : 
                         assetType === 4 ? '🔒' : 
                         assetType === 8 ? '💰' : 
                         assetType === 9 ? '🔐' : '📦'}
                      </span>
                    </div>
                  );
                };
                
                return (
                  <>
                    {/* First asset - always visible */}
                    {firstAsset && renderAsset(firstAsset, 0)}
                    
                    {/* Toggle button quando não está expandido - colado ao card */}
                    {!isExpanded && hasMultiple && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginTop: -4, // Colado ao card superior
                        minHeight: 20,
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAssets(row.id);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '3px 12px',
                            background: theme.bgInteractive,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '0 0 8px 8px',
                            borderTop: 'none',
                            fontSize: 11,
                            color: theme.textSecondary,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontWeight: 600,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = theme.bgInteractiveHover;
                            e.currentTarget.style.borderColor = theme.accent;
                            e.currentTarget.style.color = theme.accent;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = theme.bgInteractive;
                            e.currentTarget.style.borderColor = theme.border;
                            e.currentTarget.style.color = theme.textSecondary;
                          }}
                        >
                          <span style={{ fontSize: 10 }}>▼</span>
                          <span>Show more</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Remaining assets - shown when expanded */}
                    {hasMultiple && isExpanded && remainingAssets.map((asset, idx) => renderAsset(asset, idx + 1))}
                    
                    {/* Toggle button quando expandido - depois do último card */}
                    {isExpanded && hasMultiple && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginTop: -4, // Colado ao último card
                        minHeight: 20,
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAssets(row.id);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '3px 12px',
                            background: theme.bgInteractive,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '0 0 8px 8px',
                            borderTop: 'none',
                            fontSize: 11,
                            color: theme.textSecondary,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontWeight: 600,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = theme.bgInteractiveHover;
                            e.currentTarget.style.borderColor = theme.accent;
                            e.currentTarget.style.color = theme.accent;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = theme.bgInteractive;
                            e.currentTarget.style.borderColor = theme.border;
                            e.currentTarget.style.color = theme.textSecondary;
                          }}
                        >
                          <span style={{ fontSize: 10 }}>▲</span>
                          <span>Hide</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Espaço reservado quando não há múltiplos assets */}
                    {!hasMultiple && <div style={{ minHeight: 20 }} />}
                  </>
                );
              })()}
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
            {(row.note !== null && row.note !== undefined) && (
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
