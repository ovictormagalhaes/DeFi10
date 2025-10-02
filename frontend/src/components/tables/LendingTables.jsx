import React, { useMemo, useState } from 'react';
import StandardHeader from '../table/StandardHeader';
import TokenDisplay from '../TokenDisplay';
import MiniMetric from '../MiniMetric';
import { useMaskValues } from '../../context/MaskValuesContext';
import { useTheme } from '../../context/ThemeProvider';
import { formatPrice, formatTokenAmount, extractRewards, calculatePercentage, getTotalPortfolioValue } from '../../utils/walletUtils';

function groupBy(arr, keyFn) {
	return arr.reduce((acc, item) => {
		const k = keyFn(item);
		if (!acc[k]) acc[k] = [];
		acc[k].push(item);
		return acc;
	}, {});
}

function sum(values) {
	return values.reduce((a, b) => a + (parseFloat(b) || 0), 0);
}

function derivePositionKey(p, index) {
	const pos = p.position || p;
	const token = pos.token || pos.asset || {};
	const addr = (token.address || token.contract || '').toLowerCase();
	const symbol = (token.symbol || '').toLowerCase();
	if (addr) return `${addr}-${index}`;
	return `${symbol || 'asset'}-${index}`;
}

function aggregatePositions(positions = []) {
	const grouped = groupBy(positions, (p) => {
		const pos = p.position || p;
		const token = pos.token || pos.asset || {};
		return (
			(token.address || token.contractAddress || token.contract || '').toLowerCase() || token.symbol || `g-${Math.random()}`
		);
	});

	return Object.values(grouped).map((group) => {
		const base = group[0];
		const pos = base.position || base;
		const token = pos.token || pos.asset || {};
		const totalSupplied = sum(
			group.map((g) => {
				const gp = g.position || g;
				return (
					gp.suppliedUsd || gp.suppliedUSD || gp.suppliedValueUsd || gp.suppliedValue || gp.supplied || gp.depositedUsd || gp.depositUsd || 0
				);
			})
		);
		const totalBorrowed = sum(
			group.map((g) => {
				const gp = g.position || g;
				return (
					gp.borrowedUsd || gp.borrowedUSD || gp.borrowedValueUsd || gp.borrowedValue || gp.borrowed || gp.debtUsd || gp.debt || 0
				);
			})
		);
		const netValue = sum(
			group.map((g) => {
				const gp = g.position || g;
				return gp.netValueUsd || gp.netValueUSD || gp.netValue || gp.positionValueUsd || 0;
			})
		);

		const rewards = extractRewards(group.flatMap((g) => (g.rewards || g.rewardTokens || [])));
		const rewardsValue = sum(
			rewards.map((r) => r.totalValueUsd || r.totalValueUSD || r.totalValue || r.valueUsd || r.valueUSD || r.value || 0)
		);

		return {
			token,
			supplied: totalSupplied,
			borrowed: totalBorrowed,
			netValue,
			rewards,
			rewardsValue,
		};
	});
}

export default function LendingTables({
	positions = [],
	supplied = [],
	borrowed = [],
	rewards = [],
	showMetrics = true,
}) {
	const { maskValue } = useMaskValues();
	const { theme } = useTheme();
	const [expanded, setExpanded] = useState({});

	// Legacy mode detection: if explicit supplied/borrowed/rewards arrays provided and positions empty
	const legacyMode = (!positions || (Array.isArray(positions) && positions.length === 0)) &&
		( (supplied && supplied.length) || (borrowed && borrowed.length) || (rewards && rewards.length) );

	// Normalize positions input (array or object map) for new aggregated mode
	const positionsArray = useMemo(() => {
		if (legacyMode) return [];
		if (Array.isArray(positions)) return positions;
		if (positions && typeof positions === 'object') return Object.values(positions);
		return [];
	}, [positions, legacyMode]);

	// ---------- Legacy Rendering Path (Aave style flat tables) ----------
	if (legacyMode) {
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		const hideAmount = vw < 600; // keep for potential future use if needed
		// Calculate legacy net = (Total Supplied - Total Borrowed) and derive portfolio percent from net
		const totalPortfolio = getTotalPortfolioValue ? getTotalPortfolioValue() : 0;
		const suppliedValueLegacy = (supplied || []).reduce((s, t) => s + (parseFloat(t.totalPrice || t.totalValueUsd || t.totalValue || t.valueUsd || 0) || 0), 0);
		const borrowedValueLegacy = (borrowed || []).reduce((s, t) => s + (parseFloat(t.totalPrice || t.totalValueUsd || t.totalValue || t.valueUsd || 0) || 0), 0);
		const netLegacy = suppliedValueLegacy - borrowedValueLegacy;
		const portfolioPercent = totalPortfolio > 0 ? calculatePercentage(netLegacy, totalPortfolio) : '0%';

		const Section = ({ title, tokens, negative }) => {
			if (!tokens || tokens.length === 0) return null;
			const isSupplied = title === 'Supplied';
			const isBorrowed = title === 'Borrowed';
			return (
				<div className="table-wrapper">
					<table className="table-unified text-primary">
						<StandardHeader
							columnDefs={[
								{ key: 'collateral', label: isSupplied ? 'Collateral' : (isBorrowed ? '' : 'Collateral'), align: 'center', className: 'col-collateral' },
								{ key: 'price', label: 'Price', align: 'right', className: 'col-price' },
								{ key: 'amount', label: 'Amount', align: 'right', className: 'col-amount' },
								{ key: 'value', label: 'Value', align: 'right', className: 'col-value' },
							]}
							labels={{ token: title === 'Supplied' ? 'Supply' : title === 'Borrowed' ? 'Borrow' : 'Token' }}
						/>
						<tbody>
							{tokens.map((t, idx) => {
								const valueRaw = parseFloat(t.totalPrice || t.totalValueUsd || t.totalValue || t.valueUsd || 0) || 0;
								const value = negative ? -Math.abs(valueRaw) : valueRaw;
								const unitPrice = parseFloat(t.priceUsd || t.priceUSD || t.price || 0) || 0;
								const tokenObj = t?.token ? t.token : t;
								const isCollateral = [
									tokenObj?.isCollateral,
									tokenObj?.IsCollateral,
									tokenObj?.additionalData?.isCollateral,
									tokenObj?.additionalData?.IsCollateral,
									tokenObj?.AdditionalData?.IsCollateral,
									tokenObj?.additionalInfo?.IsCollateral,
									tokenObj?.additional_info?.is_collateral,
									t?.position?.additionalData?.IsCollateral,
									t?.position?.additionalData?.isCollateral,
								].some(v => v === true);
								return (
									<tr key={idx} className={`table-row table-row-hover ${idx === tokens.length - 1 ? '' : 'tbody-divider'}`}>
										<td className="td text-primary col-name">
											<TokenDisplay tokens={[t]} size={22} showChain={false} />
										</td>
										<td className="td th-center col-collateral">
											{isSupplied && (
												isCollateral ? (
													<span className="toggle-pill on" aria-label="Collateral" role="switch" aria-checked="true" />
												) : (
													<span className="toggle-pill" aria-label="Not collateral" role="switch" aria-checked="false" />
												)
											)}
											{isBorrowed && null}
										</td>
										<td className="td td-right td-mono text-primary col-price">{maskValue(formatPrice(unitPrice))}</td>
										<td className="td td-right td-mono text-primary col-amount">{maskValue(formatTokenAmount(t), { short: true })}</td>
										<td className="td td-right td-mono td-mono-strong text-primary col-value">{maskValue(formatPrice(value))}</td>
									</tr>
								);
							})}
							{tokens.length > 1 && (
								<tr className="table-summary">
									<td className="td text-primary col-name">Subtotal</td>
									<td className="td th-center col-collateral">{title === 'Supplied' ? '-' : ''}</td>
									<td className="td td-right td-mono text-primary col-price">-</td>
									<td className="td td-right td-mono text-primary col-amount">
										{maskValue(formatTokenAmount({ 
											balance: tokens.reduce((s, t) => {
												const tokenBalance = parseFloat(t.balance || t.amount || 0);
												const tokenPrice = parseFloat(t.priceUsd || t.priceUSD || t.price || 0);
												const tokenValue = parseFloat(t.totalPrice || t.totalValue || t.totalValueUsd || 0);
												// Se temos price e value, calculate balance: value / price
												if (tokenPrice > 0 && tokenValue > 0 && !tokenBalance) {
													return s + (tokenValue / tokenPrice);
												}
												return s + tokenBalance;
											}, 0)
										}))}
									</td>
									<td className="td td-right td-mono td-mono-strong text-primary col-value">
										{maskValue(formatPrice(tokens.reduce((s, t) => s + (parseFloat(t.totalPrice||t.totalValue||t.totalValueUsd||0)||0), 0)))}
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			);
		};

		return (
			<div className="lending-tables-wrapper flex-col gap-12">
				{showMetrics && (
					<div className="mini-metrics">
						<MiniMetric label="Positions" value={(supplied?.length||0)+(borrowed?.length||0)+(rewards?.length||0)} />
						<MiniMetric label="Portfolio %" value={portfolioPercent} />
					</div>
				)}
				<Section title="Supplied" tokens={supplied} negative={false} />
				{supplied.length > 0 && borrowed.length > 0 && <div className="spacer-6" />}
				<Section title="Borrowed" tokens={borrowed} negative={true} />
				{(supplied.length > 0 || borrowed.length > 0) && rewards.length > 0 && <div className="spacer-6" />}
				<Section title="Rewards" tokens={rewards} negative={false} />
			</div>
		);
	}

	// ---------- Aggregated (new) mode path ----------
	if (!positionsArray || positionsArray.length === 0) return null;

	const aggregated = useMemo(() => aggregatePositions(positionsArray), [positionsArray]);

	const suppliedList = aggregated.filter((p) => parseFloat(p.supplied) > 0);
	const borrowedList = aggregated.filter((p) => parseFloat(p.borrowed) > 0);
	const rewardsList = aggregated.filter((p) => p.rewards && p.rewards.length > 0 && p.rewardsValue > 0);

	function toggle(idx, type) {
		setExpanded((prev) => ({ ...prev, [`${type}-${idx}`]: !prev[`${type}-${idx}`] }));
	}

	const totalSuppliedValue = sum(suppliedList.map((p) => p.supplied));
	const totalBorrowedValue = sum(borrowedList.map((p) => p.borrowed));
	const totalRewardsValue = sum(rewardsList.map((p) => p.rewardsValue));
	const positionsCount = aggregated.length;
	const portfolioTotal = getTotalPortfolioValue ? getTotalPortfolioValue() : 0;
	const netValueAll = totalSuppliedValue - totalBorrowedValue; // requested logic: net = supply - borrow
	const portfolioPercent = portfolioTotal > 0 ? calculatePercentage(netValueAll, portfolioTotal) : '0%';
	const suppliedPortfolioPercent = portfolioTotal > 0 ? calculatePercentage(totalSuppliedValue, portfolioTotal) : '0%';
	const borrowedPortfolioPercent = portfolioTotal > 0 ? calculatePercentage(totalBorrowedValue, portfolioTotal) : '0%';
	const rewardsPortfolioPercent = portfolioTotal > 0 ? calculatePercentage(totalRewardsValue, portfolioTotal) : '0%';

	return (
		<div className="lending-tables-wrapper flex-col gap-12">
			{showMetrics && (
				<div className="mini-metrics">
					<MiniMetric label="Positions" value={positionsCount} />
					<MiniMetric label="Portfolio %" value={portfolioPercent} />
				</div>
			)}

			{suppliedList.length > 0 && (
				<table className="table-unified text-primary">
					<StandardHeader
						title="Supplied"
						columnDefs={[
							{ key: 'supplied', label: 'Supplied', align: 'right' },
							{ key: 'net', label: 'Net Value', align: 'right' },
						]}
					/>
					<tbody>
						{suppliedList.map((p, i) => {
							const key = derivePositionKey(p, i);
							const suppliedValue = parseFloat(p.supplied) || 0;
							const netValue = parseFloat(p.netValue) || 0;
							const isOpen = expanded[`sup-${i}`];
							return (
								<React.Fragment key={`sup-${key}`}>
									<tr
										className={`table-row table-row-hover ${i === suppliedList.length - 1 && !isOpen ? '' : 'tbody-divider'}`}
									>
										<td className="td text-primary col-name" onClick={() => toggle(i, 'sup')} style={{ cursor: 'pointer' }}>
											<div className="flex items-center gap-8">
												<span className={`disclosure ${isOpen ? 'open' : ''}`} />
												<TokenDisplay tokens={[p.token]} size={22} showChain={true} />
											</div>
										</td>
										<td className="td td-right td-mono tabular-nums text-primary col-supplied">
											{maskValue(formatPrice(suppliedValue))}
										</td>
										<td className="td td-right td-mono tabular-nums td-mono-strong text-primary col-net">
											{maskValue(formatPrice(netValue))}
										</td>
									</tr>
									{isOpen && (
										<tr className={`table-row table-row-nested ${i === suppliedList.length - 1 ? '' : 'tbody-divider'}`}>
											<td colSpan={3} className="td td-nested-bg">
												<div className="text-secondary text-sm">No deeper breakdown available (restored expandable row placeholder).</div>
											</td>
										</tr>
									)}
								</React.Fragment>
							);
						})}
					</tbody>
				</table>
			)}

			{borrowedList.length > 0 && (
				<table className="table-unified text-primary">
					<StandardHeader
						title="Borrowed"
						columnDefs={[
							{ key: 'borrowed', label: 'Borrowed', align: 'right' },
							{ key: 'net', label: 'Net Value', align: 'right' },
						]}
					/>
					<tbody>
						{borrowedList.map((p, i) => {
							const key = derivePositionKey(p, i);
							const borrowedValue = parseFloat(p.borrowed) || 0;
							const netValue = parseFloat(p.netValue) || 0;
							const isOpen = expanded[`bor-${i}`];
							return (
								<React.Fragment key={`bor-${key}`}>
									<tr
										className={`table-row table-row-hover ${i === borrowedList.length - 1 && !isOpen ? '' : 'tbody-divider'}`}
									>
										<td className="td text-primary col-name" onClick={() => toggle(i, 'bor')} style={{ cursor: 'pointer' }}>
											<div className="flex items-center gap-8">
												<span className={`disclosure ${isOpen ? 'open' : ''}`} />
												<TokenDisplay tokens={[p.token]} size={22} showChain={true} />
											</div>
										</td>
										<td className="td td-right td-mono tabular-nums text-primary col-borrowed">
											{maskValue(formatPrice(-Math.abs(borrowedValue)))}
										</td>
										<td className="td td-right td-mono tabular-nums td-mono-strong text-primary col-net">
											{maskValue(formatPrice(netValue))}
										</td>
									</tr>
									{isOpen && (
										<tr className={`table-row table-row-nested ${i === borrowedList.length - 1 ? '' : 'tbody-divider'}`}>
											<td colSpan={3} className="td td-nested-bg">
												<div className="text-secondary text-sm">No deeper breakdown available (restored expandable row placeholder).</div>
											</td>
										</tr>
									)}
								</React.Fragment>
							);
						})}
					</tbody>
				</table>
			)}

			{rewardsList.length > 0 && (
				<table className="table-unified text-primary">
					<StandardHeader
						title="Rewards"
						columnDefs={[
							{ key: 'rewards', label: 'Rewards Value', align: 'right' },
						]}
					/>
					<tbody>
						{rewardsList.map((p, i) => {
							const key = derivePositionKey(p, i);
							const rewardsValue = parseFloat(p.rewardsValue) || 0;
							const isOpen = expanded[`rew-${i}`];
							return (
								<React.Fragment key={`rew-${key}`}>
									<tr
										className={`table-row table-row-hover ${i === rewardsList.length - 1 && !isOpen ? '' : 'tbody-divider'}`}
									>
										<td className="td text-primary col-name" onClick={() => toggle(i, 'rew')} style={{ cursor: 'pointer' }}>
											<div className="flex items-center gap-8">
												<span className={`disclosure ${isOpen ? 'open' : ''}`} />
												<TokenDisplay tokens={[p.token]} size={22} showChain={true} />
											</div>
										</td>
										<td className="td td-right td-mono tabular-nums td-mono-strong text-primary col-rewards">
											{maskValue(formatPrice(rewardsValue))}
										</td>
									</tr>
									{isOpen && (
										<tr className={`table-row table-row-nested ${i === rewardsList.length - 1 ? '' : 'tbody-divider'}`}>
											<td colSpan={2} className="td td-nested-bg">
												<div className="text-secondary text-sm">Rewards detail placeholder.</div>
											</td>
										</tr>
									)}
								</React.Fragment>
							);
						})}
					</tbody>
				</table>
			)}
		</div>
	);
}
