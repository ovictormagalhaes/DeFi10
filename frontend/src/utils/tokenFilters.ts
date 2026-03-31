// Unified token filtering utilities
// Centralizes all token type detection and filtering logic used across the project

interface TokenBase {
  type?: string | number;
  symbol?: string;
  name?: string;
  totalPrice?: number | string;
  totalValueUsd?: number | string;
  totalValueUSD?: number | string;
  totalValue?: number | string;
  valueUsd?: number | string;
  price?: number | string;
  financials?: Record<string, unknown>;
  [key: string]: unknown;
}

interface PositionLike {
  rewards?: TokenBase[];
  rewardTokens?: TokenBase[];
  tokens?: TokenBase[];
  uncollectedFees?: TokenBase[];
  fees?: TokenBase[];
  uncollected?: TokenBase[];
  [key: string]: unknown;
}

interface NormalizedToken extends TokenBase {
  totalPrice: number;
}

export function normalizeTokenType(type: string | number | null | undefined): string {
  return (type || '').toString().toLowerCase();
}

export const TOKEN_TYPES = {
  SUPPLIED: 1,
  BORROWED: 2,
  LIQUIDITY_UNCOLLECTED_FEE: 3,
  LIQUIDITY_COLLECTED_FEE: 4,
  GOVERNANCE_POWER: 5,
} as const;

export function isSuppliedToken(token: TokenBase | null | undefined): boolean {
  if (!token) return false;

  const type = normalizeTokenType(token.type);
  return (
    type === 'supplied' ||
    type === 'supply' ||
    type === 'deposit' ||
    token.type === TOKEN_TYPES.SUPPLIED ||
    token.type === 'Supplied' ||
    !type
  );
}

export function isBorrowedToken(token: TokenBase | null | undefined): boolean {
  if (!token) return false;

  const type = normalizeTokenType(token.type);
  return (
    type === 'borrowed' ||
    type === 'borrow' ||
    type === 'debt' ||
    token.type === TOKEN_TYPES.BORROWED
  );
}

export function isUncollectedFeeToken(token: TokenBase | null | undefined): boolean {
  if (!token) return false;

  const type = normalizeTokenType(token.type);
  return type === 'liquidityuncollectedfee' || token.type === TOKEN_TYPES.LIQUIDITY_UNCOLLECTED_FEE;
}

export function isCollectedFeeToken(token: TokenBase | null | undefined): boolean {
  if (!token) return false;

  const type = normalizeTokenType(token.type);
  return type === 'liquiditycollectedfee' || token.type === TOKEN_TYPES.LIQUIDITY_COLLECTED_FEE;
}

export function isRewardToken(token: TokenBase | null | undefined): boolean {
  if (!token) return false;

  const type = normalizeTokenType(token.type);
  const symbol = (token.symbol || '').toLowerCase();
  const name = (token.name || '').toLowerCase();

  if (type === 'reward' || type === 'rewards') return true;

  if (isUncollectedFeeToken(token)) return true;

  const rewardPatterns = ['reward', 'comp', 'crv', 'cake', 'uni', 'ldo', 'bal', 'aura'];

  return rewardPatterns.some((pattern) => symbol.includes(pattern) || name.includes(pattern));
}

export function isGovernanceToken(token: TokenBase | null | undefined): boolean {
  if (!token) return false;

  const type = normalizeTokenType(token.type);
  const symbol = (token.symbol || '').toLowerCase();
  const name = (token.name || '').toLowerCase();

  return (
    type === 'governancepower' ||
    token.type === TOKEN_TYPES.GOVERNANCE_POWER ||
    token.type === 'GovernancePower' ||
    symbol.includes('ve') ||
    name.includes('governance') ||
    name.includes('voting power')
  );
}

export function filterSuppliedTokens(tokens: TokenBase[]): TokenBase[] {
  if (!Array.isArray(tokens)) return [];
  return tokens.filter((token) => isSuppliedToken(token));
}

export function filterBorrowedTokens(tokens: TokenBase[]): TokenBase[] {
  if (!Array.isArray(tokens)) return [];
  return tokens.filter(isBorrowedToken);
}

export function filterRewardTokens(tokens: TokenBase[]): TokenBase[] {
  if (!Array.isArray(tokens)) return [];
  return tokens.filter(isRewardToken);
}

export function filterUncollectedFeeTokens(tokens: TokenBase[]): TokenBase[] {
  if (!Array.isArray(tokens)) return [];
  return tokens.filter(isUncollectedFeeToken);
}

export function filterGovernanceTokens(tokens: TokenBase[]): TokenBase[] {
  if (!Array.isArray(tokens)) return [];
  return tokens.filter((token) => isGovernanceToken(token));
}

export function calculateTokensValue(
  tokens: TokenBase[],
  valueField: string = 'totalPrice'
): number {
  if (!Array.isArray(tokens)) return 0;

  return tokens.reduce((sum: number, token: TokenBase) => {
    const value = parseFloat(token[valueField] as string) || 0;
    return sum + value;
  }, 0);
}

export function extractAllRewards(position: PositionLike | null | undefined): TokenBase[] {
  if (!position) return [];

  const rewards: TokenBase[] = [];

  if (Array.isArray(position.rewards)) {
    rewards.push(...position.rewards);
  }

  if (Array.isArray(position.rewardTokens)) {
    rewards.push(...position.rewardTokens);
  }

  if (Array.isArray(position.tokens)) {
    const rewardTokensFromArray = filterRewardTokens(position.tokens);
    rewards.push(...rewardTokensFromArray);
  }

  const uncollectedSources = [position.uncollectedFees, position.fees, position.uncollected];

  uncollectedSources.forEach((source) => {
    if (Array.isArray(source)) {
      const uncollectedRewards = source.filter(
        (item) =>
          item && (isUncollectedFeeToken(item) || (item as Record<string, unknown>).financials)
      );
      rewards.push(...uncollectedRewards);
    }
  });

  return rewards;
}

export function normalizeTokenPrice(
  token: TokenBase | null | undefined
): NormalizedToken | null | undefined {
  if (!token) return token as null | undefined;

  const priceFields: string[] = [
    'totalPrice',
    'totalValueUsd',
    'totalValueUSD',
    'totalValue',
    'valueUsd',
    'price',
  ];

  let totalPrice = 0;

  for (const field of priceFields) {
    if (
      (token as Record<string, unknown>)[field] !== undefined &&
      (token as Record<string, unknown>)[field] !== null
    ) {
      totalPrice = parseFloat((token as Record<string, unknown>)[field] as string) || 0;
      break;
    }
  }

  if (!totalPrice && token.financials) {
    for (const field of priceFields) {
      if (token.financials[field] !== undefined && token.financials[field] !== null) {
        totalPrice = parseFloat(token.financials[field] as string) || 0;
        break;
      }
    }
  }

  return {
    ...token,
    totalPrice,
  };
}
