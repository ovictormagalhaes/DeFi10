import React from 'react';

import { useMaskValues } from '../../context/MaskValuesContext';
import { useTheme } from '../../context/ThemeProvider';
import { formatPrice, formatTokenAmount, calculatePercentage, getTotalPortfolioValue } from '../../utils/walletUtils';

import TokenDisplay from '../TokenDisplay';
import StandardHeader from '../table/StandardHeader';
import MiniMetric from '../MiniMetric';

// Generate a stable unique key for a token row, combining address + chain when available.
function deriveTokenKey(token, index) {
	if (!token) return `tok-${index}`;
	const addr = (token.contractAddress || token.tokenAddress || token.address || '').toLowerCase();
	const chain = (
		token.chainId ||
		token.chainID ||
		token.chain ||
		token.networkId ||
		token.network ||
		token.chainName ||
		''
	)
		.toString()
		.toLowerCase();
	if (addr) return `${addr}${chain ? `-${chain}` : ''}`;
	// Some native tokens may share the placeholder (e.g., 0xeeee...) so disambiguate by symbol+index
	const symbol = (token.symbol || '').toLowerCase();
	const name = (token.name || '').toLowerCase();
	return `${symbol || name || 'token'}-${index}`;
}

// Wallet tokens table styled similar to PoolTables (Uniswap style)
export default function WalletTokensTable({
	tokens = [],
	showBalanceColumn = true,
	showUnitPriceColumn = true,
	showMetrics = true,
}) {
	const { theme } = useTheme();
	const { maskValue } = useMaskValues();
	if (!tokens || tokens.length === 0) return null;

	const totalValue = tokens.reduce((s, tData) => {
		const tok = tData.token || tData;
		const v = parseFloat(tok.totalPrice) || 0;
		return s + (isFinite(v) ? v : 0);
	}, 0);
	const count = tokens.length;
	const portfolioTotal = getTotalPortfolioValue ? getTotalPortfolioValue() : 0;
	const portfolioPercent = portfolioTotal > 0 ? calculatePercentage(totalValue, portfolioTotal) : '0%';

	return (
		<div className="wallet-tokens-table-wrapper flex-col gap-12">
			{showMetrics && (
				<div className="mini-metrics">
					<MiniMetric label="Positions" value={count} />
					<MiniMetric label="Portfolio %" value={portfolioPercent} />
				</div>
			)}
			<table className="table-unified text-primary">
				<StandardHeader
					columnDefs={[
						{ key: 'price', label: 'Price', align: 'right' },
						{ key: 'amount', label: 'Amount', align: 'right' },
						{ key: 'value', label: 'Value', align: 'right' },
					]}
				/>
				<tbody>
					{tokens.map((tokenData, index) => {
						const token = tokenData.token || tokenData;
						const key = deriveTokenKey(token, index);
						const unitPrice = parseFloat(token.priceUsd || token.price || token.priceUSD || 0) || 0;
						return (
							<tr
								key={key}
								className={`table-row table-row-hover ${index === tokens.length - 1 ? '' : 'tbody-divider'}`}
							>
								<td className="td text-primary col-name">
									<TokenDisplay tokens={[token]} size={22} showChain={true} />
								</td>
								<td className="td td-right td-mono tabular-nums text-primary col-price">
									{maskValue(formatPrice(unitPrice))}
								</td>
								<td className="td td-right td-mono tabular-nums text-primary col-amount">
									{maskValue(formatTokenAmount(token), { short: true })}
								</td>
								<td className="td td-right td-mono tabular-nums td-mono-strong text-primary col-value">
									{maskValue(formatPrice(token.totalPrice))}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
