import axios from 'axios';

const getOmniBaseUrl = (): string => {
  const env = (key: string): string | undefined => {
    try {
      const meta: any = import.meta as any;
      if (meta?.env?.[key]) return meta.env[key];
    } catch {}
    if (typeof process !== 'undefined' && process.env) {
      return (process.env as Record<string, string | undefined>)[key];
    }
    return undefined;
  };

  const explicit = env('VITE_OMNI_API_URL');
  if (explicit) return explicit.replace(/\/+$/, '');

  try {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (/^(localhost|127\.0\.0\.1)$/.test(host)) return 'http://localhost:8080';
    }
  } catch {}

  return 'https://omni-api.onrender.com';
};

const OMNI_BASE = getOmniBaseUrl();

export interface PoolScoreRequest {
  token0: string;
  token1: string;
  protocol?: string;
  chain?: string;
  fee_tier?: string;
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
  yourPool: PoolScoreSuggestion | null;
  score: number | null;
  totalComparable: number;
  normalizedPair: string;
  token0Category: string;
  token1Category: string;
  suggestions: PoolScoreSuggestion[];
}

export interface LendingScoreRequest {
  supply: string[];
  borrow: string[];
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
  liquidity: number;
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
  const res = await axios.post(`${OMNI_BASE}/api/v1/score/pool`, req);
  return res.data;
}

export async function scoreLending(req: LendingScoreRequest): Promise<LendingScoreResponse> {
  const res = await axios.post(`${OMNI_BASE}/api/v1/score/lending`, req);
  return res.data;
}
