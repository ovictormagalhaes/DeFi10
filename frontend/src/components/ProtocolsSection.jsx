import React from 'react';

import { useChainIcons } from '../context/ChainIconsProvider';
import {
  formatPrice,
  groupDefiByProtocol,
  groupTokensByType,
  groupStakingTokensByType,
} from '../utils/walletUtils';
import { isRewardToken, calculateTokensValue } from '../utils/tokenFilters';
import { extractHealthFactor } from '../types/wallet';

import { PoolTables, LendingTables, WalletTokensTable, LockingTables, DepositTables } from './tables';
import ProtocolTables from './ProtocolTables';
import SectionTable from './SectionTable';
import MiniMetric from './MiniMetric';

const ProtocolsSection = ({
  getLiquidityPoolsData,
  getLendingAndBorrowingData,
  getStakingData,
  getLockingData,
  getDepositingData,
  selectedChains,
  isAllChainsSelected,
  getCanonicalFromObj,
  filterLendingDefiTokens,
  filterStakingDefiTokens,
  showLendingDefiTokens,
  showStakingDefiTokens,
  setShowLendingDefiTokens,
  setShowStakingDefiTokens,
  protocolExpansions,
  toggleProtocolExpansion,
  calculatePercentage,
  getTotalPortfolioValue,
  maskValue,
  theme,
}) => {
  // Responsive breakpoints to align summary columns with tables
  const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const [vw, setVw] = React.useState(initialWidth);
  React.useEffect(() => {
    const onResize = () => setVw(typeof window !== 'undefined' ? window.innerWidth : initialWidth);
    if (typeof window !== 'undefined') window.addEventListener('resize', onResize);
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('resize', onResize);
    };
  }, []);
  const poolsHideRange = vw < 950;
  const poolsHideRewards = vw < 800;
  const poolsHideAmount = vw < 600;
  // Hide rewards chip in header metrics on small screens
  const hideHeaderRewards = vw < 700;
  const { getIcon } = useChainIcons();
  const stakingData = getStakingData();
  const lockingData = getLockingData();
  const depositingData = (typeof getDepositingData === 'function') ? getDepositingData() : [];

  console.log('ProtocolsSection - depositingData:', depositingData);

  const allDefi = [
    ...getLiquidityPoolsData(),
    ...getLendingAndBorrowingData(),
    ...stakingData,
    ...lockingData,
    ...depositingData,
  ];

  if (allDefi.length === 0) return null;
  const protocolGroups = groupDefiByProtocol(allDefi);

  return (
    <div>
      {protocolGroups.map((protocolGroup, pgIdx) => {
        console.log('Processing protocolGroup:', protocolGroup.protocol.name, 'positions:', protocolGroup.positions);
        
        // Classify positions by type using label/name heuristics
        const liqPositionsOriginal = protocolGroup.positions.filter((p) => {
          const lbl = (p.position?.label || p.position?.name || p.label || '')
            .toString()
            .toLowerCase();
          return lbl.includes('liquidity');
        });
        const stakingPositionsOriginal = protocolGroup.positions.filter((p) => {
          const lbl = (p.position?.label || p.position?.name || p.label || '')
            .toString()
            .toLowerCase();
          return lbl.includes('staking');
        });
        const lockingPositionsOriginal = protocolGroup.positions.filter((p) => {
          // Check type first for explicit categorization
          if (p.type === 'Locking') return true;
          
          const lbl = (p.position?.label || p.position?.name || p.label || '')
            .toString()
            .toLowerCase();
          
          // Only check label if contains "lock" but NOT "deposit" (to avoid ambiguity)
          const hasLock = lbl.includes('lock') || lbl.includes('vesting');
          const hasDeposit = lbl.includes('deposit');
          
          // If has both lock and deposit, it's NOT a locking position (it's depositing)
          if (hasLock && hasDeposit) return false;
          
          return hasLock;
        });
        const depositingPositionsOriginal = protocolGroup.positions.filter((p) => {
          // Only use explicit type, do NOT use label heuristics
          return p.type === 'Depositing';
        });
        
        console.log('Protocol:', protocolGroup.protocol.name, 'depositingPositionsOriginal:', depositingPositionsOriginal);
        const lendingPositionsOriginal = protocolGroup.positions.filter((p) => {
          const lbl = (p.position?.label || p.position?.name || p.label || '')
            .toString()
            .toLowerCase();
          return !lbl.includes('liquidity') && !lbl.includes('staking') && !lbl.includes('lock') && !lbl.includes('vesting') && !lbl.includes('deposit') && p.type !== 'Locking' && p.type !== 'Depositing';
        });

        // Helper to filter tokens inside a position according to selected chains.
        // A position matches selection if its own chain OR any token chain is selected
        const positionMatchesSelection = (pos) => {
          if (!selectedChains || isAllChainsSelected) return true;
          const container = pos.position || pos;
          const chainSelf = getCanonicalFromObj(container) || getCanonicalFromObj(pos);
          if (chainSelf && selectedChains.has(chainSelf)) return true;
          const toks = Array.isArray(container.tokens) ? container.tokens : [];
          for (let i = 0; i < toks.length; i++) {
            const tc = getCanonicalFromObj(toks[i]) || chainSelf;
            if (tc && selectedChains.has(tc)) return true;
          }
          return false;
        };

        // Filter tokens within positions but keep the position if it still matches selection
        const filterPositionArray = (positions) => {
          if (!positions || positions.length === 0) return [];
          return positions
            .filter((p) => positionMatchesSelection(p))
            .map((p) => {
              if (!selectedChains || isAllChainsSelected) {
                return p;
              }
              const cloned = p.position ? { ...p, position: { ...p.position } } : { ...p };
              const container = cloned.position || cloned;
              const tokensArr = Array.isArray(container.tokens) ? container.tokens : [];
              const filteredTokens = tokensArr.filter((t) => {
                const canon =
                  getCanonicalFromObj(t) ||
                  getCanonicalFromObj(container) ||
                  getCanonicalFromObj(p);
                return canon && selectedChains.has(canon);
              });
              if (container.tokens) container.tokens = filteredTokens;
              return cloned;
            });
        };

        // If selection active and protocol has no positions matching, skip early
        if (selectedChains && !isAllChainsSelected) {
          const anyMatch = protocolGroup.positions.some((pos) => positionMatchesSelection(pos));
          if (!anyMatch) {
            return null;
          }
        }

        const liqPositions = filterPositionArray(liqPositionsOriginal);
        const stakingPositions = filterPositionArray(stakingPositionsOriginal);
        const lockingPositions = filterPositionArray(lockingPositionsOriginal);
        const depositingPositions = filterPositionArray(depositingPositionsOriginal);
        const lendingPositions = filterPositionArray(lendingPositionsOriginal);

        // If after filtering everything vanished (should be rare now), still skip.
        if (!liqPositions.length && !stakingPositions.length && !lockingPositions.length && !depositingPositions.length && !lendingPositions.length) {
          return null;
        }

        // (1) Compute raw liquidity & staking positive totals (staking counts only positive balances)
        const liquidityTotal = liqPositions.reduce((sum, pos) => {
          const container = pos.position || pos;
          return (
            sum + (container.tokens?.reduce((s, t) => s + (parseFloat(t.totalPrice) || 0), 0) || 0)
          );
        }, 0);
        const stakingTotal = stakingPositions.reduce((sum, pos) => {
          const tokens = Array.isArray(pos.tokens)
            ? filterStakingDefiTokens(pos.tokens, showStakingDefiTokens)
            : [];
            // Staking rarely has negatives, but guard anyway
          const v = tokens.reduce((s, t) => s + Math.max(parseFloat(t.totalPrice) || 0, 0), 0);
          return sum + v;
        }, 0);
        const lockingTotal = lockingPositions.reduce((sum, pos) => {
          const container = pos.position || pos;
          const tokens = container.tokens || [];
          return sum + tokens.reduce((s, t) => s + (parseFloat(t.financials?.totalPrice || t.totalPrice || 0) || 0), 0);
        }, 0);
        const depositingTotal = depositingPositions.reduce((sum, pos) => {
          const container = pos.position || pos;
          const tokens = container.tokens || [];
          return sum + tokens.reduce((s, t) => s + (parseFloat(t.financials?.totalPrice || t.totalPrice || 0) || 0), 0);
        }, 0);
        // (2) Lending net: supplied positive, borrowed negative
        const lendingNetProvisional = lendingPositions.reduce((sum, pos) => {
          const tokens = Array.isArray(pos.tokens)
            ? filterLendingDefiTokens(pos.tokens, showLendingDefiTokens)
            : [];
          const net = tokens.reduce((s, t) => {
            const ty = (t.type || '').toLowerCase();
            const val = Math.abs(parseFloat(t.totalPrice) || 0);
            if (ty === 'borrowed' || ty === 'borrow' || ty === 'debt') return s - val;
            if (!ty) {
              const lbl = (pos?.position?.label || pos?.label || '').toLowerCase();
              if (lbl.includes('borrow') || lbl.includes('debt')) return s - val;
            }
            return s + val;
          }, 0);
          return sum + net;
        }, 0);
        // We'll override lendingNet later with values from grouped tables (more faithful) if available.

        // Build tables for this protocol
        const tables = [];

        let liquidityRewardsValue = 0;
        if (liqPositions.length > 0) {
          // Calculate total rewards value from liquidity positions using unified utility
          liqPositions.forEach((pos) => {
            if (pos.tokens && Array.isArray(pos.tokens)) {
              const rewardTokens = pos.tokens.filter(isRewardToken);
              liquidityRewardsValue += calculateTokensValue(rewardTokens);
            }
          });
        }

        let lendingGroup = null;
        let lendingRewardsValue = 0;
        let lendingHealthFactor = null;
        
        if (lendingPositions.length > 0) {
          // EXTRAIR HEALTH FACTOR ANTES DE QUEBRAR A ESTRUTURA - usando função TypeScript
          lendingHealthFactor = lendingPositions
            .map(pos => extractHealthFactor(pos))
            .find(hf => hf != null && isFinite(hf)) || null;
          
          const filtered = lendingPositions.map((p) => ({
            ...p,
            tokens: Array.isArray(p.tokens)
              ? filterLendingDefiTokens(p.tokens, showLendingDefiTokens).map(tok => {
                  // If token itself lacks collateral flags, inherit from position.additionalData
                  const add = p.additionalData || p.AdditionalData;
                  if (add && (add.isCollateral === true || add.IsCollateral === true)) {
                    if (tok.isCollateral !== true && tok.IsCollateral !== true) {
                      return { ...tok, isCollateral: true };
                    }
                  }
                  return tok;
                })
              : [],
          }));
          const grouped = groupTokensByType(filtered);
          lendingGroup = {
            supplied: grouped.supplied || [],
            borrowed: grouped.borrowed || [],
            rewards: grouped.rewards || [],
            healthFactor: lendingHealthFactor, // Preservar o Health Factor
          };
          // Calculate total rewards value from lending positions
          lendingRewardsValue = lendingGroup.rewards.reduce(
            (sum, token) => sum + (parseFloat(token.totalPrice) || 0),
            0
          );
        }

        let stakingGroup = null;
        let stakingRewardsValue = 0;
        if (stakingPositions.length > 0) {
          const filtered = stakingPositions.map((p) => ({
            ...p,
            tokens: Array.isArray(p.tokens)
              ? filterStakingDefiTokens(p.tokens, showStakingDefiTokens)
              : [],
          }));
          const grouped = groupStakingTokensByType(filtered);
          stakingGroup = {
            staked: grouped.staked || [],
            rewards: grouped.rewards || [],
          };
          // Calculate total rewards value from staking positions
          stakingRewardsValue = stakingGroup.rewards.reduce(
            (sum, token) => sum + (parseFloat(token.totalPrice) || 0),
            0
          );
        }

        // Resolve chain icon to overlay
        const resolveChainRaw = (obj) => {
          if (!obj || typeof obj !== 'object') return undefined;
          const direct =
            obj.chainId ||
            obj.chainID ||
            obj.chain_id ||
            obj.chain ||
            obj.networkId ||
            obj.network ||
            obj.chainName;
          if (direct) return direct;
          const p = obj.protocol;
          if (p && typeof p === 'object') {
            return p.chainId || p.chainID || p.chain || p.networkId || p.network || p.chainName;
          }
          for (const k in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
            if (/(chain|network)/i.test(k)) {
              const v = obj[k];
              if (v && (typeof v === 'string' || typeof v === 'number')) return v;
            }
          }
          return undefined;
        };
        const firstPos = protocolGroup?.positions?.[0] || null;
        const basePos = firstPos && (firstPos.position || firstPos);
        let chainRaw = resolveChainRaw(protocolGroup?.protocol) || resolveChainRaw(basePos);
        if (!chainRaw && basePos && Array.isArray(basePos?.tokens)) {
          for (let i = 0; i < basePos.tokens.length; i++) {
            const c = resolveChainRaw(basePos.tokens[i]);
            if (c) {
              chainRaw = c;
              break;
            }
          }
        }
        const chainIcon = chainRaw ? getIcon(chainRaw) : undefined;

        const icon =
          protocolGroup.protocol.logoURI || protocolGroup.protocol.logo ? (
            <div style={{ position: 'relative', width: 22, height: 22 }}>
              <img
                src={protocolGroup.protocol.logoURI || protocolGroup.protocol.logo}
                alt={protocolGroup.protocol.name}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: `1px solid ${theme.border}`,
                  display: 'block',
                }}
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
              {chainIcon && (
                <img
                  src={chainIcon}
                  alt="chain"
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    border: `1px solid ${theme.border}`,
                    background: theme.bgPanel,
                  }}
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              )}
            </div>
          ) : null;

        // Recompute lending net using grouped data (ensures alignment with what is actually displayed)
        const lendingNet = lendingGroup
          ? lendingGroup.supplied.reduce((s, t) => s + (parseFloat(t.totalPrice) || 0), 0) -
            lendingGroup.borrowed.reduce((s, t) => s + (parseFloat(t.totalPrice) || 0), 0)
          : lendingNetProvisional;

        const protocolTotal = liquidityTotal + stakingTotal + lockingTotal + depositingTotal + lendingNet;
        // Positive contribution (used for %): ignore pure debt (negative net)
        const protocolPositive = liquidityTotal + stakingTotal + lockingTotal + depositingTotal + Math.max(lendingNet, 0);
        const totalPortfolio = getTotalPortfolioValue();
        const protocolPercent = protocolPositive <= 0
          ? '0%'
          : calculatePercentage(protocolPositive, totalPortfolio);
        const totalRewardsValue = liquidityRewardsValue + lendingRewardsValue + stakingRewardsValue;
        const infoBadges = [
          liqPositions.length > 0 ? `Pools: ${liqPositions.length}` : null,
          lendingPositions.length > 0 ? `Lending: ${lendingPositions.length}` : null,
          stakingPositions.length > 0 ? `Staking: ${stakingPositions.length}` : null,
          lockingPositions.length > 0 ? `Locking: ${lockingPositions.length}` : null,
          depositingPositions.length > 0 ? `Depositing: ${depositingPositions.length}` : null,
        ]
          .filter(Boolean)
          .join('  •  ');
        const optionsMenu = (
          <div style={{ padding: '6px 0' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={showLendingDefiTokens}
                onChange={(e) => setShowLendingDefiTokens(e.target.checked)}
              />
              Show internal lending tokens
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={showStakingDefiTokens}
                onChange={(e) => setShowStakingDefiTokens(e.target.checked)}
              />
              Show internal staking tokens
            </label>
          </div>
        );
        // Decide layout AFTER we know which table(s) will render
        const hasPools = liqPositions.length > 0;
        const hasLending = !!(
          lendingGroup &&
          (lendingGroup.supplied.length > 0 ||
            lendingGroup.borrowed.length > 0 ||
            lendingGroup.rewards.length > 0)
        );
        const hasStaking = !!(
          stakingGroup &&
          (stakingGroup.staked.length > 0 || stakingGroup.rewards.length > 0)
        );
        const hasLocking = lockingPositions.length > 0;
        const hasDepositing = depositingPositions.length > 0;
        

        // Pools: 5 cols (Pool|Range|Amount|Rewards|Value), Lending/Staking: 3 cols ([2,1,1])
        const metricsRatio = hasPools ? [2, 1, 1, 1, 1] : [2, 1, 1];

        // Summary row schema mirrors the visible table for pools
        const poolSummaryColumns = hasPools
          ? [
              { key: 'pool', label: 'Pool', align: 'left', width: '33.333%' },
              ...(!poolsHideRange
                ? [{ key: 'range', label: 'Range', align: 'center', width: '16.667%' }]
                : []),
              ...(!poolsHideAmount
                ? [{ key: 'amount', label: 'Amount', align: 'right', width: '16.667%' }]
                : []),
              ...(!poolsHideRewards
                ? [{ key: 'rewards', label: 'Rewards', align: 'right', width: '16.667%' }]
                : []),
              { key: 'value', label: 'Value', align: 'right', width: '16.667%' },
            ]
          : null;
        const renderPoolSummaryCell = (col) => {
          if (col.key === 'pool') {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    border: `1px solid ${theme.border}`,
                    padding: '2px 6px',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  {protocolPercent}
                </span>
                {infoBadges && (
                  <span
                    style={{
                      border: `1px solid ${theme.border}`,
                      padding: '2px 6px',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    {infoBadges}
                  </span>
                )}
              </div>
            );
          }
          if (col.key === 'rewards') {
            return totalRewardsValue > 0 ? maskValue(formatPrice(totalRewardsValue)) : null;
          }
          if (col.key === 'value') {
            return maskValue(formatPrice(protocolTotal));
          }
          return null;
        };

        // Lending/Staking summary (no Rewards column): [2,1,1]
        const lendingSummaryColumns =
          !hasPools && (hasLending || hasStaking)
            ? [
                { key: 'title', label: 'Title', align: 'left', width: '66.667%' },
                { key: 'amount', label: 'Amount', align: 'right', width: '16.667%' },
                { key: 'value', label: 'Value', align: 'right', width: '16.667%' },
              ]
            : null;
        const renderLendingSummaryCell = (col) => {
          if (col.key === 'title') {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    border: `1px solid ${theme.border}`,
                    padding: '2px 6px',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  {protocolPercent}
                </span>
                {infoBadges && (
                  <span
                    style={{
                      border: `1px solid ${theme.border}`,
                      padding: '2px 6px',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  >
                    {infoBadges}
                  </span>
                )}
              </div>
            );
          }
          if (col.key === 'value') {
            return maskValue(formatPrice(protocolTotal));
          }
          return null;
        };

        // UI display adjustment: hide chain suffix for Uniswap V3 groups (e.g. "Uniswap V3 (Base)" -> "Uniswap V3")
        const displayTitle = (() => {
          const n = protocolGroup.protocol.name || '';
          if (/^Uniswap V3 \(/i.test(n)) return 'Uniswap V3';
          return n;
        })();

        return (
          <SectionTable
            key={protocolGroup.protocol.name}
            icon={icon}
            title={displayTitle}
            transparentBody={true}
            // Custom header metrics: Percent | Rewards | Value (| Fees 24h se pools)
            renderHeaderMetrics={() => {
              const cells = [];
              // Coluna 1: percent + info badges agrupadas
              cells.push(
                <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                  <MiniMetric label="Percent" value={protocolPercent || '—'} />
                  {infoBadges && <div className="mini-metric-pill">{infoBadges}</div>}
                </div>
              );
              // Coluna 2: Rewards (se houver)
              cells.push(
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  {totalRewardsValue > 0 && (
                    <MiniMetric label="Rewards" value={maskValue(formatPrice(totalRewardsValue))} />
                  )}
                </div>
              );
              // Coluna 3: Value total
              cells.push(
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <MiniMetric label="Value" value={maskValue(formatPrice(protocolTotal))} />
                </div>
              );
              // Se pools presentes e quiser mostrar Fees 24h agregadas futuras (placeholder)
              if (hasPools) {
                cells.push(
                  <div style={{ display:'flex', justifyContent:'flex-end' }}>
                    <MiniMetric label="Fees 24h" value={totalRewardsValue > 0 ? '—' : '—'} />
                  </div>
                );
              }
              const ratio = hasPools ? [2,1,1,1] : [2,1,1];
              return { ratio, cells };
            }}
            metricsRatio={hasPools ? [2,1,1,1] : [2,1,1]}
            summaryColumns={null}
            renderSummaryCell={undefined}
            isExpanded={
              protocolExpansions[protocolGroup.protocol.name] !== undefined
                ? protocolExpansions[protocolGroup.protocol.name]
                : true
            }
            onToggle={() => toggleProtocolExpansion(protocolGroup.protocol.name)}
            optionsMenu={optionsMenu}
            customContent={
              <>
                {liqPositions && liqPositions.length > 0 && (
                  <PoolTables items={liqPositions} />
                )}
                {lendingGroup &&
                  (lendingGroup.supplied.length > 0 ||
                    lendingGroup.borrowed.length > 0 ||
                    lendingGroup.rewards.length > 0) && (
                    <LendingTables
                      supplied={lendingGroup.supplied}
                      borrowed={lendingGroup.borrowed}
                      rewards={lendingGroup.rewards}
                      healthFactor={lendingGroup.healthFactor}
                    />
                  )}
                {stakingGroup &&
                  (stakingGroup.staked.length > 0 || stakingGroup.rewards.length > 0) && (
                    <StakingTables staked={stakingGroup.staked} rewards={stakingGroup.rewards} />
                  )}
                {hasLocking && <LockingTables items={lockingPositions} />}
                {hasDepositing && <DepositTables items={depositingPositions} />}
                {tables.length > 0 && (
                  <ProtocolTables
                    icon={null}
                    title={null}
                    rightValue={null}
                    tables={tables.filter(
                      (t) => !['Supplied', 'Borrowed', 'Rewards'].includes(t.subtitle)
                    )}
                  />
                )}
              </>
            }
          />
        );
      })}
    </div>
  );
};

export default ProtocolsSection;
