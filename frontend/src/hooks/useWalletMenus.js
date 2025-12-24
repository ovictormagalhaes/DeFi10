import { useState, useMemo } from 'react';

import {
  getLiquidityPoolItems,
  getLendingItems,
  getStakingItems,
  getWalletTokenItems,
} from '../types/filters';
import {
  ITEM_TYPES,
  filterItemsByType,
  getWalletTokens,
} from '../utils/walletUtils';

export const useWalletMenus = (walletData) => {
  // Expansion states
  const [tokensExpanded, setTokensExpanded] = useState(true);
  const [liquidityPoolsExpanded, setLiquidityPoolsExpanded] = useState(false);
  const [lendingAndBorrowingExpanded, setLendingAndBorrowingExpanded] = useState(false);
  const [stakingExpanded, setStakingExpanded] = useState(false);

  // Options menu states
  const [tokensOptionsExpanded, setTokensOptionsExpanded] = useState(false);
  const [liquidityOptionsExpanded, setLiquidityOptionsExpanded] = useState(false);
  const [lendingOptionsExpanded, setLendingOptionsExpanded] = useState(false);
  const [stakingOptionsExpanded, setStakingOptionsExpanded] = useState(false);

  // Protocol expansion states
  const [protocolExpansions, setProtocolExpansions] = useState({});

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChains, setSelectedChains] = useState([]);
  const [selectedTokenTypes, setSelectedTokenTypes] = useState([]);

  // Helper functions to get data based on structure
  const getWalletTokensData = () => {
    // New unified structure with items array
    if (walletData.items && Array.isArray(walletData.items)) {
      return filterItemsByType(walletData.items, ITEM_TYPES.WALLET);
    }
    // Legacy structure support
    if (walletData.data && Array.isArray(walletData.data)) {
      return getWalletTokens(walletData.data);
    }
    return walletData.tokens || [];
  };

  const getLiquidityPoolsData = () => {
    // New unified structure with items array
    if (walletData.items && Array.isArray(walletData.items)) {
      return getLiquidityPoolItems(walletData.items);
    }
    // Legacy structure support
    if (walletData.data && Array.isArray(walletData.data)) {
      return filterItemsByType(walletData.data, ITEM_TYPES.LIQUIDITY_POOL);
    }
    return walletData.liquidityPools || [];
  };

  const getLendingAndBorrowingData = () => {
    // New unified structure with items array
    if (walletData.items && Array.isArray(walletData.items)) {
      return getLendingItems(walletData.items);
    }
    // Legacy structure support
    if (walletData.data && Array.isArray(walletData.data)) {
      return filterItemsByType(walletData.data, ITEM_TYPES.LENDING_AND_BORROWING);
    }
    return walletData.lendingAndBorrowing || [];
  };

  const getStakingData = () => {
    // New unified structure with items array
    if (walletData.items && Array.isArray(walletData.items)) {
      return getStakingItems(walletData.items);
    }
    // Legacy structure support
    if (walletData.data && Array.isArray(walletData.data)) {
      return filterItemsByType(walletData.data, ITEM_TYPES.STAKING);
    }
    return walletData.staking || [];
  };

  // Protocol expansion toggle
  const toggleProtocolExpansion = (protocolName) => {
    setProtocolExpansions((prev) => ({
      ...prev,
      [protocolName]: !prev[protocolName],
    }));
  };

  // Calculate total portfolio value
  const getTotalPortfolioValue = useMemo(() => {
    if (!walletData) return 0;

    const tokensValue = getWalletTokensData().reduce((sum, token) => {
      const price = parseFloat(token.totalPrice) || 0;
      return sum + (isNaN(price) ? 0 : price);
    }, 0);

    const liquidityValue = getLiquidityPoolsData().reduce((sum, position) => {
      const balance = parseFloat(position.balance) || 0;
      return sum + (isNaN(balance) ? 0 : balance);
    }, 0);

    const lendingValue = getLendingAndBorrowingData().reduce((sum, position) => {
      const balance = parseFloat(position.balance) || 0;
      return sum + (isNaN(balance) ? 0 : balance);
    }, 0);

    const stakingValue = getStakingData().reduce((sum, position) => {
      const balance = parseFloat(position.balance) || 0;
      return sum + (isNaN(balance) ? 0 : balance);
    }, 0);

    return tokensValue + liquidityValue + lendingValue + stakingValue;
  }, [walletData]);

  // Calculate percentage helper
  const calculatePercentage = (value, total) => {
    if (!total || total === 0) return '0.00%';
    const percentage = (value / total) * 100;
    return `${percentage.toFixed(2)}%`;
  };

  return {
    // Data getters
    getWalletTokensData,
    getLiquidityPoolsData,
    getLendingAndBorrowingData,
    getStakingData,

    // Expansion states
    tokensExpanded,
    setTokensExpanded,
    liquidityPoolsExpanded,
    setLiquidityPoolsExpanded,
    lendingAndBorrowingExpanded,
    setLendingAndBorrowingExpanded,
    stakingExpanded,
    setStakingExpanded,

    // Options states
    tokensOptionsExpanded,
    setTokensOptionsExpanded,
    liquidityOptionsExpanded,
    setLiquidityOptionsExpanded,
    lendingOptionsExpanded,
    setLendingOptionsExpanded,
    stakingOptionsExpanded,
    setStakingOptionsExpanded,

    // Protocol states
    protocolExpansions,
    toggleProtocolExpansion,

    // Filter states
    searchTerm,
    setSearchTerm,
    selectedChains,
    setSelectedChains,
    selectedTokenTypes,
    setSelectedTokenTypes,

    // Calculations
    getTotalPortfolioValue,
    calculatePercentage,
  };
};

export default useWalletMenus;
