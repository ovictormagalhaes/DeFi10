import { useState, useMemo, Dispatch, SetStateAction } from 'react';

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
import type { WalletItem } from '../types/wallet';

interface WalletData {
  items?: WalletItem[];
  data?: WalletItem[];
  tokens?: WalletItem[];
  liquidityPools?: WalletItem[];
  lendingAndBorrowing?: WalletItem[];
  staking?: WalletItem[];
}

interface UseWalletMenusReturn {
  getWalletTokensData: () => WalletItem[];
  getLiquidityPoolsData: () => WalletItem[];
  getLendingAndBorrowingData: () => WalletItem[];
  getStakingData: () => WalletItem[];

  tokensExpanded: boolean;
  setTokensExpanded: Dispatch<SetStateAction<boolean>>;
  liquidityPoolsExpanded: boolean;
  setLiquidityPoolsExpanded: Dispatch<SetStateAction<boolean>>;
  lendingAndBorrowingExpanded: boolean;
  setLendingAndBorrowingExpanded: Dispatch<SetStateAction<boolean>>;
  stakingExpanded: boolean;
  setStakingExpanded: Dispatch<SetStateAction<boolean>>;

  tokensOptionsExpanded: boolean;
  setTokensOptionsExpanded: Dispatch<SetStateAction<boolean>>;
  liquidityOptionsExpanded: boolean;
  setLiquidityOptionsExpanded: Dispatch<SetStateAction<boolean>>;
  lendingOptionsExpanded: boolean;
  setLendingOptionsExpanded: Dispatch<SetStateAction<boolean>>;
  stakingOptionsExpanded: boolean;
  setStakingOptionsExpanded: Dispatch<SetStateAction<boolean>>;

  protocolExpansions: Record<string, boolean>;
  toggleProtocolExpansion: (protocolName: string) => void;

  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  selectedChains: string[];
  setSelectedChains: Dispatch<SetStateAction<string[]>>;
  selectedTokenTypes: string[];
  setSelectedTokenTypes: Dispatch<SetStateAction<string[]>>;

  getTotalPortfolioValue: number;
  calculatePercentage: (value: number, total: number) => string;
}

export const useWalletMenus = (walletData: WalletData): UseWalletMenusReturn => {
  const [tokensExpanded, setTokensExpanded] = useState(true);
  const [liquidityPoolsExpanded, setLiquidityPoolsExpanded] = useState(false);
  const [lendingAndBorrowingExpanded, setLendingAndBorrowingExpanded] = useState(false);
  const [stakingExpanded, setStakingExpanded] = useState(false);

  const [tokensOptionsExpanded, setTokensOptionsExpanded] = useState(false);
  const [liquidityOptionsExpanded, setLiquidityOptionsExpanded] = useState(false);
  const [lendingOptionsExpanded, setLendingOptionsExpanded] = useState(false);
  const [stakingOptionsExpanded, setStakingOptionsExpanded] = useState(false);

  const [protocolExpansions, setProtocolExpansions] = useState<Record<string, boolean>>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChains, setSelectedChains] = useState<string[]>([]);
  const [selectedTokenTypes, setSelectedTokenTypes] = useState<string[]>([]);

  const getWalletTokensData = (): WalletItem[] => {
    if (walletData.items && Array.isArray(walletData.items)) {
      return filterItemsByType(walletData.items, ITEM_TYPES.WALLET);
    }
    if (walletData.data && Array.isArray(walletData.data)) {
      return getWalletTokens(walletData.data);
    }
    return walletData.tokens || [];
  };

  const getLiquidityPoolsData = (): WalletItem[] => {
    if (walletData.items && Array.isArray(walletData.items)) {
      return getLiquidityPoolItems(walletData.items);
    }
    if (walletData.data && Array.isArray(walletData.data)) {
      return filterItemsByType(walletData.data, ITEM_TYPES.LIQUIDITY_POOL);
    }
    return walletData.liquidityPools || [];
  };

  const getLendingAndBorrowingData = (): WalletItem[] => {
    if (walletData.items && Array.isArray(walletData.items)) {
      return getLendingItems(walletData.items);
    }
    if (walletData.data && Array.isArray(walletData.data)) {
      return filterItemsByType(walletData.data, ITEM_TYPES.LENDING_AND_BORROWING);
    }
    return walletData.lendingAndBorrowing || [];
  };

  const getStakingData = (): WalletItem[] => {
    if (walletData.items && Array.isArray(walletData.items)) {
      return getStakingItems(walletData.items);
    }
    if (walletData.data && Array.isArray(walletData.data)) {
      return filterItemsByType(walletData.data, ITEM_TYPES.STAKING);
    }
    return walletData.staking || [];
  };

  const toggleProtocolExpansion = (protocolName: string): void => {
    setProtocolExpansions((prev) => ({
      ...prev,
      [protocolName]: !prev[protocolName],
    }));
  };

  const getTotalPortfolioValue = useMemo(() => {
    if (!walletData) return 0;

    const tokensValue = getWalletTokensData().reduce((sum: number, token: any) => {
      const price = parseFloat(token.totalPrice) || 0;
      return sum + (isNaN(price) ? 0 : price);
    }, 0);

    const liquidityValue = getLiquidityPoolsData().reduce((sum: number, position: any) => {
      const balance = parseFloat(position.balance) || 0;
      return sum + (isNaN(balance) ? 0 : balance);
    }, 0);

    const lendingValue = getLendingAndBorrowingData().reduce((sum: number, position: any) => {
      const balance = parseFloat(position.balance) || 0;
      return sum + (isNaN(balance) ? 0 : balance);
    }, 0);

    const stakingValue = getStakingData().reduce((sum: number, position: any) => {
      const balance = parseFloat(position.balance) || 0;
      return sum + (isNaN(balance) ? 0 : balance);
    }, 0);

    return tokensValue + liquidityValue + lendingValue + stakingValue;
  }, [walletData]);

  const calculatePercentage = (value: number, total: number): string => {
    if (!total || total === 0) return '0.00%';
    const percentage = (value / total) * 100;
    return `${percentage.toFixed(2)}%`;
  };

  return {
    getWalletTokensData,
    getLiquidityPoolsData,
    getLendingAndBorrowingData,
    getStakingData,

    tokensExpanded,
    setTokensExpanded,
    liquidityPoolsExpanded,
    setLiquidityPoolsExpanded,
    lendingAndBorrowingExpanded,
    setLendingAndBorrowingExpanded,
    stakingExpanded,
    setStakingExpanded,

    tokensOptionsExpanded,
    setTokensOptionsExpanded,
    liquidityOptionsExpanded,
    setLiquidityOptionsExpanded,
    lendingOptionsExpanded,
    setLendingOptionsExpanded,
    stakingOptionsExpanded,
    setStakingOptionsExpanded,

    protocolExpansions,
    toggleProtocolExpansion,

    searchTerm,
    setSearchTerm,
    selectedChains,
    setSelectedChains,
    selectedTokenTypes,
    setSelectedTokenTypes,

    getTotalPortfolioValue,
    calculatePercentage,
  };
};

export default useWalletMenus;
