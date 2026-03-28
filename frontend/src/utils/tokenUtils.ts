interface TokenLike {
  symbol?: string;
  name?: string;
  logo?: string;
  thumbnail?: string;
  chain?: string;
  network?: string;
  chainName?: string;
  financials?: Record<string, number | undefined>;
  priceUsd?: number;
  price?: number;
  priceUSD?: number;
  [key: string]: unknown;
}

export interface NormalizedTokenData {
  symbol: string;
  name: string;
  logo: string | null;
  chain: string;
  price: number;
}

export function normalizeTokenData(token: TokenLike): NormalizedTokenData {
  const symbol = token.symbol || 'Unknown';
  return {
    symbol,
    name: token.name || symbol,
    logo: token.logo || token.thumbnail || null,
    chain: token.chain || token.network || token.chainName || 'unknown',
    price: token.financials?.price || token.priceUsd || token.price || token.priceUSD || 0,
  };
}
