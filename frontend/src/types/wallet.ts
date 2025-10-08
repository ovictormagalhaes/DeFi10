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
  tickSpacing?: number;
  createdAt?: number; // Unix timestamp da criação da pool
  
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
  // Verificar primeiro nos dados tipados
  if (item.type === "LiquidityPool" && item.additionalData?.range != null) {
    return item.additionalData.range;
  }
  
  // Verificar nos dados raw da API (baseado nos logs)
  const rawData = (item as any).raw;
  if (rawData?.additionalData?.range) {
    return rawData.additionalData.range;
  }
  
  return null;
}

export function extractPoolCreatedAt(item: WalletItem): Date | null {
  if (item.type === "LiquidityPool" && item.additionalData?.createdAt != null) {
    return new Date(item.additionalData.createdAt * 1000); // Convert Unix timestamp to Date
  }
  return null;
}

export function formatPoolAge(createdAt: Date | number | null): string {
  if (!createdAt) return '—';
  
  const createdDate = createdAt instanceof Date ? createdAt : new Date(createdAt * 1000);
  const diffMs = Date.now() - createdDate.getTime();
  
  if (diffMs <= 0) return '—';
  
  const diffH = diffMs / 3600000; // hours
  if (diffH < 1) {
    const diffMin = diffMs / 60000; // minutes
    return `${Math.floor(diffMin)}min`;
  }
  if (diffH < 24) return `${Math.floor(diffH)}h`;
  
  const diffD = diffH / 24; // days
  if (diffD < 14) return `${Math.floor(diffD)}d`;
  
  const diffW = diffD / 7; // weeks
  if (diffW < 8) return `${Math.floor(diffW)}w`;
  
  const diffM = diffD / 30.4375; // months (average)
  if (diffM < 12) return `${Math.floor(diffM)}m`;
  
  const diffY = diffD / 365.25; // years
  return `${Math.floor(diffY)}y`;
}

/**
 * Extrai o valor total das taxas não coletadas para um token específico
 */
export function extractUncollectedFeesForToken(
  item: WalletItem, 
  tokenSymbol: string
): number {
  if (item.type !== "LiquidityPool") {
    return 0;
  }
  
  // Get tokens from position
  const tokens = item.position?.tokens;
  if (!tokens || tokens.length === 0) {
    return 0;
  }
  
  // Filter for uncollected fee tokens that match the symbol
  const uncollectedTokens = tokens.filter((token: any) => {
    return token.type === "LiquidityUncollectedFee" && 
           token.symbol === tokenSymbol && 
           token.totalPrice && token.totalPrice > 0;
  });
  
  if (uncollectedTokens.length === 0) {
    return 0;
  }
  
  // Sum the total prices of all matching uncollected fee tokens
  const totalValue = uncollectedTokens.reduce((sum: number, token: any) => {
    return sum + (token.totalPrice || 0);
  }, 0);
  
  return totalValue;
}