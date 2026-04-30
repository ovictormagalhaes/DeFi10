/**
 * Types for Backend Strategy API
 * Version: 4.0 - Clean Structure with Multiple Strategy Types
 * Date: 02/03/2026
 *
 * Type 1: Allocation by Weight ✅
 * Type 2: Health Factor Target ✅
 * Type 3: Liquidity Range Monitor (Future)
 */

/**
 * Strategy Type enum matching backend implementation
 */
export enum StrategyType {
  AllocationByWeight = 1, // ✅ Implemented
  HealthFactorTarget = 2, // ✅ Implemented
  LiquidityRangeMonitor = 3, // 🔜 Future
  YieldThreshold = 4, // 🔜 Future
  ProtocolDiversification = 5, // 🔜 Future
  ChainAllocation = 6, // 🔜 Future
  AssetTypeAllocation = 7, // 🔜 Future
  BestPurchaseWindow = 8, // ✅ Implemented
}

export type WindowPeriod = 'h1' | 'h24' | 'd7' | 'd14' | 'd30' | 'd90' | 'd200' | 'y1' | 'ytd';
export type WindowDirection = 'min' | 'max';
export type PriceDirection = 'above' | 'below';

export type PurchaseTrigger =
  | { type: 'window'; window: WindowPeriod; direction: WindowDirection }
  | { type: 'price'; target: number; direction: PriceDirection };

export interface BestPurchaseWindowEntry {
  assetKey: string;
  symbol: string;
  coingeckoId: string;
  protocol: ProtocolInfo;
  chain: ChainInfo;
  token: TokenInfo;
  /** @deprecated use `triggers` */
  trigger?: PurchaseTrigger;
  triggers?: PurchaseTrigger[];
}

export interface TriggerEvaluation {
  trigger: PurchaseTrigger;
  referencePrice: number;
  referenceLabel: string;
  signal: boolean;
}

export interface TokenMarketData {
  image?: string;
  currentPrice?: number;
  lastUpdated?: string;
  marketCap?: number;
  marketCapRank?: number;
  fullyDilutedValuation?: number;
  totalVolume?: number;
  high24h?: number;
  low24h?: number;
  priceChange24h?: number;
  priceChangePercentage1h?: number;
  priceChangePercentage24h?: number;
  priceChangePercentage7d?: number;
  priceChangePercentage14d?: number;
  priceChangePercentage30d?: number;
  priceChangePercentage200d?: number;
  priceChangePercentage1y?: number;
  priceChangePercentageYtd?: number;
  marketCapChange24h?: number;
  marketCapChangePercentage24h?: number;
  circulatingSupply?: number;
  totalSupply?: number;
  maxSupply?: number;
  ath?: number;
  athChangePercentage?: number;
  athDate?: string;
  atl?: number;
  atlChangePercentage?: number;
  atlDate?: string;
}

export interface PurchaseWindowEvalResult {
  assetKey: string;
  symbol: string;
  currentPriceUsd: number;
  /** @deprecated use `evaluations` */
  trigger?: PurchaseTrigger;
  signal: boolean;
  referencePrice: number;
  referenceLabel: string;
  evaluations?: TriggerEvaluation[];
  fetchedAt: string;
  marketData?: TokenMarketData;
  dataUnavailable?: boolean;
  errorMessage?: string;
}

/**
 * Protocol information in strategy
 */
export interface ProtocolInfo {
  id: string;
  name: string;
}

/**
 * Chain information in strategy
 */
export interface ChainInfo {
  id: string;
  name: string;
}

/**
 * Token information in strategy
 */
export interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  logo: string | null;
}

/**
 * Allocation item in Type 1 strategy
 */
export interface AllocationItem {
  assetKey: string;
  protocol: ProtocolInfo;
  chain: ChainInfo;
  token: TokenInfo;
  group: string; // "Lending Supply", "Lending Borrow", etc.
  groupType: number; // 10, 11, etc.
  targetWeight: number; // 0-100 (STATIC: user defined)
  positionType: number; // 3 = Supplied, 4 = Borrowed
  displayOrder?: number; // Display order in UI
}

/**
 * Health Factor target in Type 2 strategy
 */
export interface HealthFactorTarget {
  assetKey: string;
  protocol: ProtocolInfo;
  chain: ChainInfo;
  targetHealthFactor: number; // STATIC: user defined (e.g., 2.5)
  criticalThreshold: number; // STATIC: user defined (e.g., 1.5)
  displayOrder?: number; // Display order in UI
}

/**
 * Base strategy interface (common fields)
 */
export interface BaseStrategy {
  id: string;
  walletGroupId: string;
  strategyType: number;
  name: string;
  description?: string | null;
  displayOrder?: number; // Display order in UI
  createdAt: string;
  updatedAt: string;
}

/**
 * Type 1: Allocation by Weight Strategy
 */
export interface AllocationStrategy extends BaseStrategy {
  strategyType: 1;
  allocations: AllocationItem[];
}

/**
 * Type 2: Health Factor Target Strategy
 */
export interface HealthFactorStrategy extends BaseStrategy {
  strategyType: 2;
  targets: HealthFactorTarget[];
}

/**
 * Type 8: Best Purchase Window Strategy
 */
export interface BestPurchaseWindowStrategy extends BaseStrategy {
  strategyType: 8;
  purchaseWindowEntries: BestPurchaseWindowEntry[];
  purchaseWindowResults?: PurchaseWindowEvalResult[];
}

/**
 * Union type for all strategy types
 */
export type Strategy = AllocationStrategy | HealthFactorStrategy | BestPurchaseWindowStrategy;

/**
 * Response from GET /api/strategies/:walletGroupId
 */
export interface GetStrategiesResponse {
  walletGroupId: string;
  strategies: Strategy[];
}

/**
 * @deprecated Use SaveAllocationStrategyRequest | SaveHealthFactorStrategyRequest instead
 */
export interface LegacySaveStrategyRequest {
  walletGroupId: string;
  strategyId?: string;
  strategyType: number;
  name?: string | null;
  description?: string | null;
  allocations: Array<{
    assetKey: string;
    protocol: string;
    chain: string;
    group: string;
    targetWeight: number;
  }>;
}

/**
 * Response from creating/updating a strategy
 */
export interface SaveStrategyResponse {
  key: string;
  itemsCount: number;
  wallets: string[];
  savedAt: string;
}

/**
 * Allocation delta calculation result
 * Shows the difference between target and current allocation
 */
export interface AllocationDelta {
  assetKey: string;
  group: string;
  targetWeight: number;
  currentWeight: number;
  deltaWeight: number; // currentWeight - targetWeight
  targetValueUsd: number;
  currentValueUsd: number;
  deltaValueUsd: number; // currentValueUsd - targetValueUsd
  needsRebalance: boolean; // true if |deltaWeight| > threshold (e.g., 5%)
}

/**
 * Group normalization mapping
 */
export const GroupTypeMapping = {
  Lending: 'LendingAndBorrowing',
  Liquidity: 'LiquidityPool',
  Staking: 'Staking',
  Wallet: 'Wallet',
  All: null,
} as const;

export type GroupType = keyof typeof GroupTypeMapping;

// ============================================
// TYPE 2: HEALTH FACTOR TARGET
// ============================================

/**
 * Configuration for Health Factor Target strategy (Type 2)
 */
export interface HealthFactorTargetConfig {
  targetHealthFactor: number; // Desired HF (e.g., 2.0)
  warningThreshold: number; // Warning level (e.g., 1.8)
  criticalThreshold: number; // Critical level (e.g., 1.5)
  autoSuggest: boolean; // Generate action suggestions
  protocols: string[]; // Protocol IDs to monitor
}

/**
 * Action suggestion for health factor management
 */
export interface HealthFactorAction {
  action: 'add_collateral' | 'reduce_debt' | 'close_position';
  protocol: string;
  assetKey: string;
  amountUsd: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Current health factor status
 */
export interface HealthFactorStatus {
  current: number; // Current HF value
  target: number; // Target HF value
  criticalThreshold?: number; // Critical threshold (alert level) for this position
  status: 'safe' | 'warning' | 'critical' | 'danger';
  needsAction: boolean;
  collateralValue: number; // Total collateral in USD
  debtValue: number; // Total debt in USD
  totalValue: number; // Total value (collateral + debt) in USD
  suggestions: HealthFactorAction[];
  protocol: string; // Protocol ID
  protocolName: string; // Protocol display name
  protocolLogo?: string; // Protocol logo URL
  chain: string; // Chain name
  chainLogo?: string; // Chain logo URL
}

/**save Type 1: Allocation Strategy
 */
export interface SaveAllocationStrategyRequest {
  id?: string; // For updates (if present, backend updates; if absent, creates)
  strategyType: 1;
  name: string;
  description?: string | null;
  allocations: Array<{
    assetKey: string;
    protocol: {
      id: string;
      name: string;
      logo: string;
    };
    chain: {
      id: string;
      name: string;
      logo: string;
    };
    token: {
      symbol: string;
      name: string;
      address: string;
      logo: string;
    };
    group: string; // "Lending Supply"
    groupType: number; // 10 = Lending, 20 = Liquidity, etc.
    targetWeight: number;
    positionType: number; // 0 = Default, 1 = Supplied, 2 = Borrowed
  }>;
}

/**
 * Request to save Type 2: Health Factor Strategy
 */
export interface SaveHealthFactorStrategyRequest {
  walletGroupId: string;
  strategyId?: string;
  strategyType: 2;
  name: string;
  description?: string | null;
  targets: Array<{
    assetKey: string;
    protocol: string;
    chain: string;
    targetHealthFactor: number;
    criticalThreshold: number;
  }>;
}

export interface SaveBestPurchaseWindowStrategyRequest {
  id?: string;
  strategyType: 8;
  name: string;
  description?: string | null;
  purchaseWindowEntries: BestPurchaseWindowEntry[];
}

/**
 * Union type for save requests
 */
export type SaveStrategyRequest =
  | SaveAllocationStrategyRequest
  | SaveHealthFactorStrategyRequest
  | SaveBestPurchaseWindowStrategyRequest;

/**
 * Legacy type alias for target allocation
 */
export interface TargetAllocation {
  assetKey: string;
  group: string;
  targetWeight: number;
  protocol?: string;
  chain?: string;
}

/**
 * Legacy type alias for strategy item
 */
export type StrategyItem = AllocationItem | HealthFactorTarget;

/**
 * Token metadata for strategy assets
 */
export interface TokenMetadata {
  type: number | null;
  symbol: string;
  name: string;
  address: string | null;
  logo: string | null;
  chain: string;
}

/**
 * Protocol metadata for strategy assets
 */
export interface ProtocolMetadata {
  id: string;
  name: string;
  chain: string;
  url: string | null;
  logo: string | null;
}

/**
 * Complete metadata for a strategy asset
 */
export interface StrategyAssetMetadata {
  symbol: string | null;
  name: string | null;
  address: string | null;
  chainId: string | null;
  chain: string | null;
  protocol: ProtocolMetadata | null;
  positionLabel: string | null;
  positionType: number;
  tokens: TokenMetadata[];
}

/**
 * Legacy type alias for strategy asset
 */
export type StrategyAsset = AllocationItem;

/**
 * Strategy data in multi-strategy response
 */
export interface StrategyData {
  id: string;
  strategyType: number;
  name: string;
  description?: string | null;
  allocations?: AllocationItem[];
  targets?: HealthFactorTarget[];
  purchaseWindowEntries?: BestPurchaseWindowEntry[];
  purchaseWindowResults?: PurchaseWindowEvalResult[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Request to save multiple strategies
 */
export interface SaveStrategiesRequest {
  walletGroupId: string;
  strategies: Array<{
    id?: string;
    strategyType: number;
    name: string;
    description?: string | null;
    allocations?: unknown[];
    targets?: unknown[];
    purchaseWindowEntries?: BestPurchaseWindowEntry[];
  }>;
}

/**
 * Response from GET/POST multi-strategy endpoint
 */
export interface SaveStrategiesResponse {
  walletGroupId: string;
  strategies: StrategyData[];
  wallets: string[];
  count: number;
}
