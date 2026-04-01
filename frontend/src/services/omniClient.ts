import axios from 'axios';

const OMNI_BASE = (import.meta.env.VITE_OMNI_API_URL || 'http://localhost:8080').replace(
  /\/+$/,
  ''
);

const PROTOCOL_KEY_MAP: Record<string, string> = {
  'aave v3': 'aave-v3',
  'uniswap v3': 'uniswap-v3',
  'uniswap v4': 'uniswap-v4',
  'compound v3': 'compound-v3',
};

function normalizeProtocol(name?: string): string | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase().trim();
  return PROTOCOL_KEY_MAP[lower] || lower;
}

export interface PoolScoreRequest {
  token0: string;
  token1: string;
  protocol?: string;
  chain?: string;
  fee_tier?: number;
  min_tvl?: number;
}

export interface PoolScoreSuggestion {
  rank: number;
  protocol: string;
  chain: string;
  token0: string;
  token1: string;
  pair: string;
  normalizedPair: string;
  feeTier: string;
  feeRateBps: number;
  tvlUsd: number;
  volume24h: number;
  turnoverRatio24h: number;
  feeApr24h: number;
  feeApr7d: number;
  totalApr: number;
  poolType: string;
  url: string;
  poolVaultId: string;
}

export interface PoolScoreResponse {
  success: boolean;
  timestamp: string;
  current: PoolScoreSuggestion | null;
  score: number | null;
  totalComparable: number;
  normalizedPair: string;
  token0Category: string;
  token1Category: string;
  suggestions: PoolScoreSuggestion[];
}

export interface ScoreAsset {
  token: string;
  value: number;
}

export interface LendingScoreRequest {
  supplies: ScoreAsset[];
  borrows: ScoreAsset[];
  protocol?: string;
  chain?: string;
  min_liquidity?: number;
}

export interface LendingAssetRate {
  asset: string;
  assetCategory: string;
  action: string;
  apy: number;
  rewards: number;
  netApy: number;
  effectiveApy?: number;
  liquidity: number;
  valueUsd?: number;
  url?: string;
}

export interface LendingScoreSuggestion {
  rank: number;
  protocol: string;
  chain: string;
  supplyRates: LendingAssetRate[];
  borrowRates: LendingAssetRate[];
  combinedNetApy: number;
  assetsMatched: number;
  assetsTotal: number;
}

export interface LendingScoreResponse {
  success: boolean;
  timestamp: string;
  yourPosition: LendingScoreSuggestion | null;
  score: number | null;
  totalComparable: number;
  assetCategories: Record<string, string>;
  suggestions: LendingScoreSuggestion[];
}

export async function scorePool(req: PoolScoreRequest): Promise<PoolScoreResponse> {
  const res = await axios.post(`${OMNI_BASE}/api/v1/pools/score`, {
    ...req,
    protocol: normalizeProtocol(req.protocol),
  });
  return res.data;
}

export async function scoreLending(req: LendingScoreRequest): Promise<LendingScoreResponse> {
  const res = await axios.post(`${OMNI_BASE}/api/v1/lending/score`, {
    ...req,
    protocol: normalizeProtocol(req.protocol),
  });
  return res.data;
}
