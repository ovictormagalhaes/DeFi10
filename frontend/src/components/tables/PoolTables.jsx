import React, { useState, useMemo, useEffect } from 'react';
import StandardHeader from '../table/StandardHeader';
import TokenDisplay from '../TokenDisplay';
import MiniMetric from '../MiniMetric';
import RangeChip from '../RangeChip';
import { useMaskValues } from '../../context/MaskValuesContext';
import { useTheme } from '../../context/ThemeProvider';
import { formatPrice, formatTokenAmount, calculatePercentage, getTotalPortfolioValue, extractPoolRange } from '../../utils/walletUtils';
import { 
  extractAllRewards, 
  normalizeTokenPrice, 
  calculateTokensValue,
  filterUncollectedFeeTokens
} from '../../utils/tokenFilters';

function sum(values) {
	return values.reduce((a, b) => a + (parseFloat(b) || 0), 0);
}

function derivePoolKey(pool, index) {
	if (!pool) return `pool-${index}`;
	const addr = (pool.address || pool.poolAddress || '').toLowerCase();
	if (addr) return addr;
	const name = (pool.name || '').toLowerCase();
	if (name) return `${name}-${index}`;
	return `pool-${index}`;
}

function aggregatePools(pools = []) {
  return pools.map((p) => {
    const tokens = p.tokens || p.assets || p.position?.tokens || [];
    
    const rawValue =
      p.totalValueUsd ?? p.totalValueUSD ?? p.totalValue ?? p.tvlUsd ?? p.tvlUSD ?? p.tvl ?? p.liquidityUsd ?? p.liquidityUSD ?? p.liquidity ?? 0;
    const valueNum = parseFloat(rawValue) || 0;
    
    // Extract all rewards using the unified utility
    const allRewards = extractAllRewards(p);
    
    // Normalize all reward tokens to have consistent totalPrice field
    const normalizedRewards = allRewards.map(normalizeTokenPrice);
    
    // Deduplicate by symbol+rounded totalPrice to avoid double counting
    const seen = new Set();
    const deduplicatedRewards = normalizedRewards.filter(item => {
      const keySig = `${(item.symbol || '').toLowerCase()}|${Math.round((item.totalPrice || 0) * 1e6)}`;
      if (seen.has(keySig)) return false;
      seen.add(keySig);
      return true;
    });

    return { ...p, tokens, value: valueNum, rewards: deduplicatedRewards };
  });
}

export default function PoolTables({ pools = [], showMetrics = true }) {
  const { maskValue } = useMaskValues();
  const { theme } = useTheme();
  const [openPools, setOpenPools] = useState({});

	// Viewport width for responsive column hiding (restored legacy behavior)
	const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
	const [vw, setVw] = useState(initialWidth);
	useEffect(() => {
		function onResize() { setVw(typeof window !== 'undefined' ? window.innerWidth : initialWidth); }
		if (typeof window !== 'undefined') window.addEventListener('resize', onResize);
		return () => { if (typeof window !== 'undefined') window.removeEventListener('resize', onResize); };
	}, []);
  // Breakpoints aligned to original (legacy) variant you preferred (950 / 800 / 600)
  const hideRange = vw < 950;
  const hideRewards = vw < 800;
  const hideAmount = vw < 600;

	// Normalize input: accept array, object map, or falsy
	const poolsArray = useMemo(() => {
		if (Array.isArray(pools)) return pools;
		if (pools && typeof pools === 'object') return Object.values(pools);
		return [];
	}, [pools]);

	if (!poolsArray || poolsArray.length === 0) return null;

  const aggregated = useMemo(() => aggregatePools(poolsArray), [poolsArray]);
  const totalValue = sum(aggregated.map((p) => p.value));
  const rewardsValue = sum(
    aggregated.flatMap((p) => p.rewards.map((r) => r.totalValueUsd || r.totalValueUSD || r.totalValue || r.valueUsd || r.totalPrice || 0))
  );
  const positionsCount = aggregated.length;
  const portfolioTotal = getTotalPortfolioValue ? getTotalPortfolioValue() : 0;
  const portfolioPercent = portfolioTotal > 0 ? calculatePercentage(totalValue, portfolioTotal) : '0%';

  function togglePool(key) { setOpenPools((prev) => ({ ...prev, [key]: !prev[key] })); }

  const keyList = aggregated.map((p, i) => derivePoolKey(p, i));
  const allOpen = keyList.every((k) => openPools[k]);
  const anyOpen = keyList.some((k) => openPools[k]);
  function expandAll() { setOpenPools(keyList.reduce((acc, k) => { acc[k] = true; return acc; }, {})); }
  function collapseAll() { setOpenPools({}); }

	return (
		<div className="pool-tables-wrapper flex-col gap-12">
			{showMetrics && (
				<div className="mini-metrics">
					<MiniMetric label="Positions" value={positionsCount} />
					<MiniMetric label="Portfolio %" value={portfolioPercent} />
				</div>
			)}
			{aggregated.length > 3 && (
				<div className="expand-controls flex gap-8">
					<button type="button" className="btn btn-sm" disabled={allOpen} onClick={expandAll}>Expand All</button>
					<button type="button" className="btn btn-sm" disabled={!anyOpen} onClick={collapseAll}>Collapse All</button>
				</div>
			)}

			<table className="table-unified text-primary">
				<StandardHeader
					title="Pools"
					columnDefs={[
						!hideRange && { key: 'range', label: 'Range', align: 'center' },
						!hideAmount && { key: 'amount', label: 'Amount', align: 'right' },
						!hideRewards && { key: 'uncollected', label: 'Uncollected', align: 'right' },
						{ key: 'value', label: 'Value', align: 'right' },
					].filter(Boolean)}
				/>
				<tbody>
					{aggregated.map((pool, idx) => {
						const key = derivePoolKey(pool, idx);
						const isOpen = !!openPools[key];
						const poolRange = extractPoolRange(pool);
						
						const totalRewardsValue = pool.rewards?.reduce((s, r) => s + (parseFloat(
							r.totalValueUsd || r.totalValueUSD || r.totalValue || r.valueUsd || r.totalPrice || (r.financials && (r.financials.totalPrice || r.financials.totalValue || r.financials.price))
						) || 0), 0) || 0;
						return (
							<React.Fragment key={key}>
								<tr
									className="table-row table-row-hover tbody-divider cursor-pointer"
									onClick={() => togglePool(key)}
								>
									<td className="td text-primary col-name">
										<span className="flex align-center gap-8">
											<span className="collapse-toggle" aria-label={isOpen ? 'Collapse pool' : 'Expand pool'}>
												{isOpen ? '−' : '+'}
											</span>
											{Array.isArray(pool.tokens) && pool.tokens.length > 0 && (
												<TokenDisplay tokens={pool.tokens.slice(0, 2)} size={24} showChain={false} />
											)}
										</span>
									</td>
									{!hideRange && (
										<td className="td td-center col-range">
											{poolRange ? (
												<RangeChip range={poolRange} />
											) : (
												// Try to show "Full Range" for standard pools without specific range
												<span className="td-placeholder" style={{ fontSize: '11px', color: '#888' }}>
													Full Range
												</span>
											)}
										</td>
									)}
									{!hideAmount && (
										<td className="td td-right td-mono text-primary col-amount">-</td>
									)}
									{!hideRewards && (
										<td className="td td-right td-mono text-primary col-uncollected">
											{maskValue(formatPrice(totalRewardsValue))}
										</td>
									)}
									<td className="td td-right td-mono td-mono-strong text-primary col-value">
										{maskValue(formatPrice(pool.value))}
									</td>
								</tr>
								{isOpen && pool.tokens && (
									<>
										{pool.tokens.map((t, tIdx) => {
									const tokenValue = parseFloat(t.totalValueUsd || t.totalValueUSD || t.totalValue || t.totalPrice || 0) || 0;
									const tokenRewardsRaw = (pool.rewards || []).filter(r => (r.symbol || '').toLowerCase() === (t.symbol || '').toLowerCase());
									const tokenRewardsValue = tokenRewardsRaw.reduce((s, r) => s + (parseFloat(
										r.totalValueUsd || r.totalValueUSD || r.totalValue || r.valueUsd || r.totalPrice || (r.financials && (r.financials.totalPrice || r.financials.totalValue || r.financials.price))
									) || 0), 0);
									return (
										<tr key={`${key}-tok-${tIdx}`} className="table-row tbody-divider pool-token-rows-enter">
											<td className="td-small text-secondary col-name" style={{ paddingLeft: 34 }}>
												<span className="flex align-center">
													<TokenDisplay tokens={[t]} size={18} showChain={false} />
												</span>
											</td>
											{!hideRange && <td className="td-small td-center col-range" />}
											{!hideAmount && (
												<td className="td-small td-right td-mono text-primary col-amount">
													{maskValue(formatTokenAmount(t, { digits: 4 }))}
												</td>
											)}
											{!hideRewards && (
														<td className="td-small td-right td-mono text-primary col-uncollected">
													{tokenRewardsValue ? maskValue(formatPrice(tokenRewardsValue)) : '-'}
												</td>
											)}
											<td className="td-small td-right td-mono td-mono-strong text-primary col-value">
												{maskValue(formatPrice(tokenValue))}
											</td>
										</tr>
									);
										})}
									</>
								)}
							</React.Fragment>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
