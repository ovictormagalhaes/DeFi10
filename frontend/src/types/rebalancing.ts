/**
 * Types para sistema de Rebalancing
 */

import type { WalletItem } from './wallet';

// Enum de tipos de asset (espelhado do backend)
export enum RebalanceAssetType {
  Wallet = 0,
  LiquidityPool = 1,
  LendingAndBorrowing = 2,
  Staking = 3,
  Group = 4,
}

// Enum de tipos de referência (espelhado do backend)
export enum RebalanceReferenceType {
  Token = 'Token',
  Protocol = 'Protocol',
  Group = 'Group',
  TotalWallet = 'TotalWallet',
}

// Interface para item de rebalanceamento
export interface RebalanceItem {
  id: string;
  name: string;
  assetType: RebalanceAssetType;
  referenceType: RebalanceReferenceType;
  targetPercentage: number;
  currentPercentage: number;
  currentValue: number;
  targetValue: number;
  difference: number;
  differencePercentage: number;
  tokens: RebalanceToken[];
  isGroup?: boolean;
  groupItems?: RebalanceItem[];
}

// Interface para token no contexto de rebalancing
export interface RebalanceToken {
  symbol: string;
  name: string;
  contractAddress: string;
  chain: string;
  logo?: string;
  balance: number;
  balanceFormatted: string;
  price: number;
  value: number;
  percentage: number;
  decimals?: number;
}

// Interface para request de rebalancing
export interface RebalanceRequest {
  account: string;
  items: RebalanceRequestItem[];
  totalValue: number;
  saveKey?: string;
}

// Interface para item individual do request
export interface RebalanceRequestItem {
  name: string;
  assetType: RebalanceAssetType;
  referenceType: RebalanceReferenceType;
  targetPercentage: number;
  tokens?: string[]; // Contract addresses
  protocolIds?: string[];
  groupType?: RebalanceAssetType;
}

// Interface para response de rebalancing
export interface RebalanceResponse {
  success: boolean;
  data?: RebalanceCalculation;
  error?: string;
  message?: string;
}

// Interface para cálculo de rebalanceamento
export interface RebalanceCalculation {
  totalValue: number;
  items: RebalanceCalculationItem[];
  summary: RebalanceSummary;
}

// Interface para item calculado
export interface RebalanceCalculationItem {
  name: string;
  currentValue: number;
  currentPercentage: number;
  targetValue: number;
  targetPercentage: number;
  difference: number;
  differencePercentage: number;
  action: 'buy' | 'sell' | 'hold';
  actionAmount: number;
  tokens: RebalanceToken[];
}

// Interface para resumo do rebalanceamento
export interface RebalanceSummary {
  totalRebalanceNeeded: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  itemsToRebalance: number;
  largestDeviation: number;
  averageDeviation: number;
  efficiency: number; // 0-100%
}

// Interface para configuração salva
export interface SavedRebalanceConfig {
  key: string;
  name: string;
  items: RebalanceRequestItem[];
  createdAt: string;
  updatedAt: string;
  account: string;
  totalPercentage: number;
}

// Interface para opções de asset type
export interface AssetTypeOption {
  value: RebalanceAssetType;
  label: string;
  description?: string;
}

// Interface para opções de grupo
export interface GroupOption {
  value: RebalanceAssetType;
  label: string;
  count: number;
  totalValue: number;
}

// Interface para estatísticas do portfolio
export interface PortfolioStats {
  totalValue: number;
  itemCounts: Record<RebalanceAssetType, number>;
  protocolDistribution: Record<string, number>;
  chainDistribution: Record<string, number>;
  topTokens: Array<{
    symbol: string;
    value: number;
    percentage: number;
  }>;
}

// Interface para validação de rebalancing
export interface RebalanceValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  totalPercentage: number;
  duplicateNames: string[];
  emptyItems: number;
}

// Interface para props do componente principal
export interface RebalancingViewProps {
  walletTokens?: WalletItem[];
  getLiquidityPoolsData?: () => WalletItem[];
  getLendingAndBorrowingData?: () => WalletItem[];
  getStakingData?: () => WalletItem[];
  theme?: any;
  account?: string;
  initialSavedKey?: string;
  initialSavedCount?: number;
  initialSavedItems?: RebalanceRequestItem[];
}

// Interface para props do dialog de item
export interface RebalanceItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: RebalanceRequestItem) => void;
  editItem?: RebalanceRequestItem;
  portfolioData: PortfolioStats;
  availableTokens: RebalanceToken[];
  availableProtocols: string[];
}

// Interface para hook de rebalancing
export interface UseRebalancingResult {
  items: RebalanceItem[];
  addItem: (item: RebalanceRequestItem) => void;
  updateItem: (index: number, item: RebalanceRequestItem) => void;
  removeItem: (index: number) => void;
  calculate: () => Promise<RebalanceCalculation | null>;
  save: (key: string, name: string) => Promise<boolean>;
  load: (key: string) => Promise<boolean>;
  validation: RebalanceValidation;
  isCalculating: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
}

// Tipos utilitários
export type RebalanceAction = 'buy' | 'sell' | 'hold';
export type ChainKey = 'eth' | 'polygon' | 'avalanche' | 'optimism' | 'bsc' | 'fantom' | 'base' | 'unknown';

// Constants tipados
export const ASSET_TYPE_OPTIONS: AssetTypeOption[] = [
  { value: RebalanceAssetType.Wallet, label: 'Wallet', description: 'Individual wallet tokens' },
  { value: RebalanceAssetType.LiquidityPool, label: 'Liquidity Pools', description: 'LP positions and pools' },
  { value: RebalanceAssetType.LendingAndBorrowing, label: 'Lending Position', description: 'Lending and borrowing positions' },
  { value: RebalanceAssetType.Staking, label: 'Staking Position', description: 'Staking rewards and positions' },
  { value: RebalanceAssetType.Group, label: 'Group', description: 'Grouped assets by type' },
];

export const GROUP_OPTIONS: GroupOption[] = [
  { value: RebalanceAssetType.Wallet, label: 'Wallet', count: 0, totalValue: 0 },
  { value: RebalanceAssetType.LiquidityPool, label: 'Liquidity Pools', count: 0, totalValue: 0 },
  { value: RebalanceAssetType.LendingAndBorrowing, label: 'Lending Position', count: 0, totalValue: 0 },
  { value: RebalanceAssetType.Staking, label: 'Staking Position', count: 0, totalValue: 0 },
  { value: RebalanceAssetType.Group, label: 'Group', count: 0, totalValue: 0 },
];

export const REBALANCE_REFERENCE_TYPES = {
  Token: RebalanceReferenceType.Token,
  Protocol: RebalanceReferenceType.Protocol,
  Group: RebalanceReferenceType.Group,
  TotalWallet: RebalanceReferenceType.TotalWallet,
} as const;

export const CHAIN_MAPPINGS: Record<string, ChainKey> = {
  '1': 'eth',
  'eth': 'eth',
  'ethereum': 'eth',
  'mainnet': 'eth',
  'erc20': 'eth',
  '137': 'polygon',
  'polygon': 'polygon',
  'matic': 'polygon',
  'avalanche': 'avalanche',
  '43114': 'avalanche',
  'avax': 'avalanche',
  '10': 'optimism',
  'optimism': 'optimism',
  'op': 'optimism',
  '56': 'bsc',
  'bsc': 'bsc',
  'bnb': 'bsc',
  'binance': 'bsc',
  '250': 'fantom',
  'fantom': 'fantom',
  'ftm': 'fantom',
  'base': 'base',
  '84531': 'base',
};

export default {
  RebalanceAssetType,
  RebalanceReferenceType,
  ASSET_TYPE_OPTIONS,
  GROUP_OPTIONS,
  REBALANCE_REFERENCE_TYPES,
  CHAIN_MAPPINGS
};