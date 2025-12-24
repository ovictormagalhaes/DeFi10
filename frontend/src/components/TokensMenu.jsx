import React from 'react';

import { useMaskValues } from '../context/MaskValuesContext.tsx';
import { useTheme } from '../context/ThemeProvider.tsx';
import { formatBalance, formatPrice, getFilteredTokens } from '../utils/walletUtils';

import Chip from './Chip';
import CollapsibleMenu from './CollapsibleMenu';

const TokensMenu = ({
  title,
  tokens,
  isExpanded,
  onToggle,
  getTotalPortfolioValue,
  calculatePercentage,
  showOptionsMenu = false,
  optionsExpanded,
  toggleOptionsExpanded,
  searchTerm,
  setSearchTerm,
  selectedChains,
  setSelectedChains,
  selectedTokenTypes,
  setSelectedTokenTypes,
}) => {
  // Hooks must run before any early returns
  const filteredTokens = getFilteredTokens(
    tokens || [],
    searchTerm,
    selectedChains,
    selectedTokenTypes
  );
  const { maskValue } = useMaskValues();
  if (!tokens || tokens.length === 0) return null;

  const totalValue = filteredTokens.reduce((sum, token) => {
    const price = parseFloat(token.totalPrice) || 0;
    return sum + (isNaN(price) ? 0 : price);
  }, 0);

  const getTokenColumns = () => ({
    tokens: {
      label: 'Tokens',
      value: filteredTokens.length,
      flex: 1,
    },
    balance: {
      label: 'Balance',
      value: maskValue(formatPrice(totalValue)),
      flex: 2,
      highlight: true,
    },
    percentage: {
      label: '%',
      value: calculatePercentage(totalValue, getTotalPortfolioValue()),
      flex: 0.8,
    },
  });

  return (
    <CollapsibleMenu
      title={title}
      isExpanded={isExpanded}
      onToggle={onToggle}
      columns={getTokenColumns()}
      showOptionsMenu={showOptionsMenu}
      optionsExpanded={optionsExpanded}
      toggleOptionsExpanded={toggleOptionsExpanded}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      selectedChains={selectedChains}
      setSelectedChains={setSelectedChains}
      selectedTokenTypes={selectedTokenTypes}
      setSelectedTokenTypes={setSelectedTokenTypes}
      tokens={tokens}
    >
      <TokenTable tokens={filteredTokens} />
    </CollapsibleMenu>
  );
};

const TokenTable = ({ tokens }) => {
  const { theme } = useTheme(); // theme retained for potential future styling via vars
  const { maskValue } = useMaskValues();
  return (
    <table className="w-full table-fixed collapse">
      <thead>
        <tr className="table-header-row">
          {['TOKEN', 'BALANCE', 'PRICE', 'VALUE'].map((h, i) => (
            <th
              key={h}
              className={`px-4 py-3 text-xs tracking-wide uppercase text-secondary ${
                i === 0 ? 'text-left' : 'text-right'
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tokens.map((token, index) => (
          <TokenRow key={index} token={token} index={index} />
        ))}
      </tbody>
    </table>
  );
};

const TokenRow = ({ token, index }) => {
  // Extract token data based on structure (nested or direct)
  const tokenData = token.tokenData?.token || token;
  const logo = tokenData.logo || tokenData.logoURI || token.logo || token.logoURI;
  const symbol = tokenData.symbol || token.symbol;
  const name = tokenData.name || token.name;
  const chain = token.chain;
  const balance = token.balance || token.tokenData?.balance;
  const price = token.price || token.tokenData?.price;
  const totalPrice = token.totalPrice;

  const { theme } = useTheme();
  const { maskValue } = useMaskValues();
  return (
    <tr className="token-row row-hover">
      <td className="cell-lg">
        <div className="flex items-center">
          {logo && (
            <img
              src={logo}
              alt={symbol}
              className="token-logo mr-3"
              onError={(e) => (e.target.className += ' is-hidden')}
            />
          )}
          <div>
            <div className="token-symbol text-primary">{symbol}</div>
            <div className="token-name text-secondary flex items-center gap-8">
              <span>{name}</span>
              {chain && (
                <Chip variant="muted" size="xs" minimal>
                  {chain}
                </Chip>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="cell-lg text-right font-mono text-sm text-primary">
        {balance ? maskValue(formatBalance(balance), { short: true }) : 'N/A'}
      </td>
      <td className="cell-lg text-right font-mono text-sm text-primary">
        {price ? maskValue(formatPrice(price), { short: true }) : 'N/A'}
      </td>
      <td className="cell-lg text-right font-mono text-base font-semibold text-primary">
        {maskValue(formatPrice(totalPrice))}
      </td>
    </tr>
  );
};

export default TokensMenu;
