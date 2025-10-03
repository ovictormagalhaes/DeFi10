/**
 * Tipos TypeScript para a estrutura de dados da carteira
 * Baseado na estrutura real dos dados JSON retornados pela API
 */

export interface Financials {
  amount: number;
  decimalPlaces: number;
  amountFormatted: number;
  balanceFormatted: number;
  price: number;
  totalPrice: number;
}

export interface Token {
  type: string | null;
  name: string;
  chain: string;
  symbol: string;
  contractAddress: string;
  logo: string | null;
  thumbnail: string | null;
  financials: Financials;
  native: boolean | null;
  possibleSpam: boolean | null;
}

export interface Position {
  label: string;
  tokens: Token[];
  // Propriedades adicionais para pools
  name?: string;
  id?: string;
  poolId?: string;
  address?: string;
  contractAddress?: string;
}

export interface Protocol {
  name: string;
  chain: string;
  id: string;
  url: string;
  logo: string;
}

export interface Range {
  upper: number;
  lower: number;
  current: number;
  inRange: boolean;
}

export interface AdditionalData {
  // Liquidity Pool fields
  sqrtPriceX96?: string;
  range?: Range;
  priceUnavailable?: boolean;
  fees24h?: number;
  
  // Lending fields
  healthFactor?: number;
  isCollateral?: boolean;
  canBeCollateral?: boolean;
}

export interface WalletItem {
  type: "Wallet" | "LiquidityPool" | "LendingAndBorrowing" | "Staking";
  protocol: Protocol;
  position: Position;
  additionalData: AdditionalData | null;
  // Propriedades adicionais para compatibilidade
  tokens?: Token[];
  totalPrice?: number;
  totalValueUsd?: number;
}

export interface ProcessedProvider {
  provider: string;
  chain: string;
  status: "Success" | "Failed";
  error: string | null;
}

export interface Summary {
  totalTokens: number;
  totalAaveSupplies: number;
  totalAaveBorrows: number;
  totalUniswapPositions: number;
  aaveHealthReceived: boolean;
  providersCompleted: string[];
}

export interface WalletDataResponse {
  jobId: string;
  account: string;
  chains: string;
  status: "Completed" | "Processing" | "Failed";
  expected: number;
  succeeded: number;
  failed: number;
  timedOut: number;
  pending: string[];
  processed: ProcessedProvider[];
  processedCount: number;
  isCompleted: boolean;
  progress: number;
  jobStartedAt: string;
  summary: Summary;
  items: WalletItem[];
  itemCount: number;
}

// Type guards para verificar o tipo de item
export function isLiquidityPoolData(item: WalletItem): boolean {
  return item.type === "LiquidityPool" && item.additionalData !== null;
}

export function isLendingData(item: WalletItem): boolean {
  return item.type === "LendingAndBorrowing" && item.additionalData !== null;
}

// Funções utilitárias tipadas
export function extractHealthFactor(item: WalletItem): number | null {
  // First check if we have the healthFactor data regardless of type
  if (item.additionalData?.healthFactor != null) {
    const healthFactor = Number(item.additionalData.healthFactor);
    if (!isNaN(healthFactor) && healthFactor > 0) {
      return healthFactor;
    }
  }
  
  // Fallback to strict type checking
  if (item.type === "LendingAndBorrowing" && item.additionalData?.healthFactor != null) {
    return Number(item.additionalData.healthFactor);
  }
  
  return null;
}

export function extractPoolFees24h(item: WalletItem): number | null {
  if (item.type === "LiquidityPool" && item.additionalData?.fees24h != null) {
    return Number(item.additionalData.fees24h);
  }
  return null;
}

export function extractPoolRange(item: WalletItem): Range | null {
  if (item.type === "LiquidityPool" && item.additionalData?.range != null) {
    return item.additionalData.range;
  }
  return null;
}