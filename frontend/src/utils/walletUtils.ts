// Utility functions for wallet data processing and formatting
import {
  filterSuppliedTokens,
  filterBorrowedTokens,
  filterRewardTokens,
  isRewardToken,
  isCollectedFeeToken,
  normalizeTokenPrice,
} from './tokenFilters';
import { capitalize } from './format';

export interface TokenFinancials {
  amount?: number;
  decimalPlaces?: number;
  amountFormatted?: number;
  balanceFormatted?: number;
  formattedAmount?: number;
  AmountFormatted?: number;
  price?: number;
  totalPrice?: number;
  [key: string]: number | undefined;
}

export interface TokenLike {
  type?: string | number;
  symbol?: string;
  name?: string;
  balance?: number | string;
  decimalPlaces?: number | string;
  balanceFormatted?: number | string;
  price?: number | string;
  totalPrice?: number | string;
  unitPrice?: number | string;
  financials?: TokenFinancials;
  AmountFormatted?: number | string;
  amountFormatted?: number | string;
  formattedAmount?: number | string;
  isInternal?: boolean;
  internal?: boolean;
  category?: string;
  range?: Range | null;
  [key: string]: unknown;
}

export interface ProtocolObj {
  id: string;
  name?: string;
  chain?: string;
  chainName?: string;
  [key: string]: unknown;
}

export interface PositionObj {
  label?: string;
  name?: string;
  tokens?: TokenLike[];
  rewards?: TokenLike[];
  position?: PositionObj;
  range?: Range | null;
  meta?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  additionalData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WalletItemLike {
  type?: string | number;
  protocol?: ProtocolObj;
  position?: PositionObj;
  token?: TokenLike;
  additionalData?: Record<string, unknown> | null;
  [key: string]: unknown;
}

interface Range {
  lower: number;
  upper: number;
  current: number;
  inRange?: boolean;
}

export interface ProtocolGroup {
  protocol: ProtocolObj;
  positions: PositionObj[];
}

interface PoolGroup {
  label: string;
  tokens: TokenLike[];
  rewards: TokenLike[];
  totalValue: number;
  totalRewards: number;
  range?: Range | null;
}

interface GroupedTokens {
  supplied: TokenLike[];
  borrowed: TokenLike[];
  rewards: TokenLike[];
}

interface GroupedStakingTokens {
  staked: TokenLike[];
  rewards: TokenLike[];
}

interface PortfolioBreakdownParams {
  walletTokens?: TokenLike[];
  liquidityGroups?: ProtocolGroup[];
  lendingGroups?: ProtocolGroup[];
  stakingPositions?: PositionObj[];
  lockingGroups?: ProtocolGroup[];
  filterLendingDefiTokens?: (toks: TokenLike[], show?: boolean) => TokenLike[];
  filterStakingDefiTokens?: (toks: TokenLike[], show?: boolean) => TokenLike[];
  showLendingDefiTokens?: boolean;
  showStakingDefiTokens?: boolean;
}

interface PortfolioBreakdown {
  walletValue: number;
  liquidityValue: number;
  lendingSupplied: number;
  lendingBorrowed: number;
  lendingNet: number;
  stakingValue: number;
  lockingValue: number;
  defiGross: number;
  defiNet: number;
  totalNet: number;
}

interface PercentageOptions {
  decimals?: number;
  minDisplay?: number;
}

// Normalize financials block into flat token fields (mutates the object for convenience)
export function normalizeFinancials(token: TokenLike | null | undefined): TokenLike | null | undefined {
  if (!token || typeof token !== 'object') return token;
  const fin = token.financials;
  if (fin && typeof fin === 'object') {
    if (token.balance === undefined && fin.amount !== undefined) token.balance = fin.amount;
    if (token.decimalPlaces === undefined && fin.decimalPlaces !== undefined)
      token.decimalPlaces = fin.decimalPlaces;
    if (token.balanceFormatted === undefined && fin.balanceFormatted !== undefined)
      token.balanceFormatted = fin.balanceFormatted;
    if (token.price === undefined && fin.price !== undefined) token.price = fin.price;
    if (token.totalPrice === undefined && fin.totalPrice !== undefined)
      token.totalPrice = fin.totalPrice;
  }
  return token;
}

// Constants for item types
export const ITEM_TYPES = {
  WALLET: 'Wallet',
  LIQUIDITY_POOL: 'LiquidityPool',
  LENDING_AND_BORROWING: 'LendingAndBorrowing',
  STAKING: 'Staking',
  DEPOSITING: 'Depositing',
  LOCKING: 'Locking',
  GROUP: 98,
} as const;

// Filter items by type from a unified data array
export function filterItemsByType(items: WalletItemLike[], type: string | number): WalletItemLike[] {
  if (!items || !Array.isArray(items)) return [];
  return items.filter((item) => item.type === type);
}

// Get wallet tokens from unified data
export function getWalletTokens(data: WalletItemLike[]): WalletItemLike[] {
  const items = filterItemsByType(data, ITEM_TYPES.WALLET);
  const collected: WalletItemLike[] = [];
  items.forEach((item) => {
    // Old shape: direct item.token
    if (item.token) {
      normalizeFinancials(item.token);
      collected.push({ ...item, token: item.token });
    }
    // New shape: tokens array inside position.tokens
    if (item.position && Array.isArray(item.position.tokens)) {
      item.position.tokens.forEach((tok) => {
        normalizeFinancials(tok);
        collected.push({ ...item, token: tok });
      });
    }
  });
  return collected;
}



// Format balance (use default decimals since not provided in response)
export function formatBalance(balance: number | string, isNative: boolean = false): string {
  const balanceNum = parseFloat(balance as string);
  // Use 18 decimals for native tokens (ETH), 6-8 for others
  const decimals = isNative ? 18 : 6;
  const divisor = Math.pow(10, decimals);
  const formatted = (balanceNum / divisor).toFixed(6);
  return parseFloat(formatted).toString(); // Remove trailing zeros
}

// Format native balance for tooltip
export function formatNativeBalance(token: TokenLike): string {
  // Normalize first (in case caller passed raw)
  normalizeFinancials(token);
  const totalPriceCandidate = token.totalPrice ?? token.financials?.totalPrice;
  const balanceFormattedCandidate = token.balanceFormatted ?? token.financials?.balanceFormatted;
  if (!balanceFormattedCandidate && (!token.balance || !totalPriceCandidate)) return 'N/A';

  const balanceNum = parseFloat(token.balance as string);
  const totalPriceNum = parseFloat(totalPriceCandidate as string);

  // Use decimalPlaces from API if available
  if (token.decimalPlaces !== null && token.decimalPlaces !== undefined) {
    const decimals = parseInt(token.decimalPlaces as string);
    const divisor = Math.pow(10, decimals);
    const formatted = (balanceNum / divisor).toFixed(6);
    const cleanFormatted = parseFloat(formatted).toString();
    return `${cleanFormatted} ${token.symbol}`;
  }

  // Calculate the actual balance by dividing totalPrice by unitPrice
  // This gives us the real token amount without needing to guess decimals
  if (token.unitPrice && (token.unitPrice as number) > 0) {
    const actualBalance = totalPriceNum / parseFloat(token.unitPrice as string);
    return `${actualBalance.toFixed(6)} ${token.symbol}`;
  }

  // Fallback: try to determine decimals by comparing balance and totalPrice
  // If balance is much larger than totalPrice, it's likely a high-decimal token
  const ratio = balanceNum / totalPriceNum;
  let decimals = 18; // default

  if (ratio > 1000000 && ratio < 10000000) {
    decimals = 6; // USDC-like (6 decimals)
  } else if (ratio > 10000000 && ratio < 1000000000) {
    decimals = 8; // cbBTC-like (8 decimals)
  }

  const divisor = Math.pow(10, decimals);
  const formatted = (balanceNum / divisor).toFixed(6);
  const cleanFormatted = parseFloat(formatted).toString();
  return `${cleanFormatted} ${token.symbol}`;
}

// Format price with currency symbol
export function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined || isNaN(Number(price))) return '$0.00';
  const priceNum = Number(price);
  if (priceNum === 0) return '$0.00';

  const isNegative = priceNum < 0;
  const abs = Math.abs(priceNum);

  let fractionDigits = 2;
  if (abs < 0.01) {
    fractionDigits = 6;
  } else if (abs < 1) {
    fractionDigits = 4;
  } else {
    fractionDigits = 2;
  }

  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  return isNegative ? `-$${formatted}` : `$${formatted}`;
}

// Format raw token amount (prioritizing provided formatted fields) with maxDecimals (truncate, not round)
export function formatTokenAmount(token: TokenLike | null | undefined, maxDecimals: number = 4): string {
  if (!token) return '-';
  // Normalize first so financials.* are promoted
  normalizeFinancials(token);

  // 1. Direct formatted fields from backend (preferred base number)
  // Backend rename: AmountFormatted (capital A) - keep backwards compatibility
  let base: unknown = token.AmountFormatted;
  if (base === undefined || base === null) base = token.amountFormatted;
  if (base === undefined || base === null) base = token.formattedAmount;
  if (base === undefined || base === null) base = token.balanceFormatted;
  if ((base === undefined || base === null) && token.financials) {
    base =
      token.financials.AmountFormatted ??
      token.financials.amountFormatted ??
      token.financials.formattedAmount ??
      token.financials.balanceFormatted;
  }

  // Convert string to number if needed
  if (base !== undefined && base !== null) {
    const num = Number(base);
    if (!isNaN(num) && isFinite(num)) {
      return truncateAndFormat(num, maxDecimals);
    }
  }

  // 2. Raw balance + decimalPlaces
  if (token.balance !== undefined && token.decimalPlaces !== undefined) {
    const raw = Number(token.balance);
    const decimals = Number(token.decimalPlaces);
    if (!isNaN(raw) && isFinite(raw) && !isNaN(decimals) && decimals >= 0 && decimals < 80) {
      const scaled = raw / Math.pow(10, decimals);
      return truncateAndFormat(scaled, maxDecimals);
    }
  }

  // 3. Derive from totalPrice / price
  if ((token.totalPrice || token.totalPrice === 0) && token.price) {
    const tp = Number(token.totalPrice);
    const p = Number(token.price);
    if (p > 0 && isFinite(tp) && isFinite(p)) {
      const derived = tp / p;
      return truncateAndFormat(derived, maxDecimals);
    }
  }

  return '-';
}

// Helper: truncate (not round) and format with up to maxDecimals, dropping trailing zeros
function truncateAndFormat(value: number, maxDecimals: number): string {
  if (typeof value !== 'number' || !isFinite(value)) return '-';
  // Sanitize maxDecimals: must be an integer between 0 and 20 for toLocaleString
  let md = Number(maxDecimals);
  if (isNaN(md) || !isFinite(md)) md = 4; // fallback default
  md = Math.min(20, Math.max(0, Math.trunc(md)));
  const factor = Math.pow(10, md);
  const truncated = Math.trunc(value * factor) / factor;
  return truncated.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: md,
  });
}

// Group DeFi positions by protocol
export function groupDefiByProtocol(defiData: WalletItemLike[]): ProtocolGroup[] {
  if (!defiData || !Array.isArray(defiData)) {
    return [];
  }

  const grouped: Record<string, ProtocolGroup> = {};

  // Helper: extract a normalized chain name from a position or nested tokens
  const resolveChain = (obj: Record<string, unknown> | null | undefined): string | undefined => {
    if (!obj || typeof obj !== 'object') return undefined;
    const direct =
      obj.chainId ||
      obj.chainID ||
      obj.chain_id ||
      obj.chain ||
      obj.networkId ||
      obj.network ||
      obj.chainName;
    if (direct) return direct as string;
    // Look inside protocol field
    if (obj.protocol && typeof obj.protocol === 'object') {
      const p = obj.protocol as Record<string, unknown>;
      const protoChain =
        p.chainId || p.chainID || p.chain_id || p.chain || p.networkId || p.network || p.chainName;
      if (protoChain) return protoChain as string;
    }
    // Fallback: search for any property containing chain/network
    for (const k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      if (/(chain|network)/i.test(k)) {
        const v = obj[k];
        if (v && (typeof v === 'string' || typeof v === 'number')) return v as string;
      }
    }
    return undefined;
  };

  defiData.forEach((defi) => {
    // Handle both WalletItem format (direct protocol/position) and legacy format (defi.protocol/defi.position)
    const protocol = defi.protocol;
    const position = defi.position;

    if (!defi || !protocol || !position) {
      return;
    }
    const baseProtocolId = protocol.id;
    const baseProtocolName = protocol.name || protocol.id;

    const isUniswapV3 = /uniswap\s*v?3/i.test(baseProtocolName);
    // Only apply chain grouping to base "pendle-v2", not "pendle-v2-deposits" or other variants
    const isPendleV2 = /^pendle-v2$/i.test(baseProtocolId);

    let effectiveProtocolId = baseProtocolId;
    let effectiveProtocolName = baseProtocolName;
    let protocolObj: ProtocolObj = { ...protocol };

    if (isUniswapV3 || isPendleV2) {
      // Derive chain from position or its tokens
      const chainCandidate =
        resolveChain(position as unknown as Record<string, unknown>) ||
        (Array.isArray(position.tokens) &&
          position.tokens.map((t) => resolveChain(t as unknown as Record<string, unknown>)).find(Boolean));
      if (chainCandidate) {
        const chainStr = chainCandidate.toString();
        const chainClean = chainStr.replace(/[^a-zA-Z0-9_-]/g, '');
        effectiveProtocolId = `${baseProtocolId}-${chainClean}`.toLowerCase();
        const prettyChain = capitalize(chainClean);

        if (isUniswapV3) {
          effectiveProtocolName = `Uniswap V3 (${prettyChain})`;
        } else if (isPendleV2) {
          effectiveProtocolName = `Pendle V2`;
        }

        // Attach explicit chain so existing icon overlay logic can pick it up
        protocolObj = {
          ...protocolObj,
          name: effectiveProtocolName,
          id: effectiveProtocolId,
          chain: prettyChain,
          chainName: prettyChain,
        };
      }
    }

    if (!grouped[effectiveProtocolId]) {
      grouped[effectiveProtocolId] = {
        protocol: protocolObj,
        positions: [],
      };
    }

    grouped[effectiveProtocolId].positions.push({
      ...position,
      type: defi.type as string,
      additionalData: defi.additionalData,
    });
  });

  const result = Object.values(grouped);
  return result;
}

// Group data by protocol name for table display
export function groupByProtocolName(data: Array<{ protocol: string; [key: string]: unknown }>): Record<string, Array<{ protocol: string; [key: string]: unknown }>> {
  if (!data || !Array.isArray(data)) return {};

  const grouped: Record<string, Array<{ protocol: string; [key: string]: unknown }>> = {};

  data.forEach((item) => {
    const protocolName = item.protocol;
    if (!grouped[protocolName]) {
      grouped[protocolName] = [];
    }
    grouped[protocolName].push(item);
  });

  return grouped;
}

// Separate DeFi into Liquidity and Other types
export function separateDefiByType(defiData: WalletItemLike[]): { liquidity: WalletItemLike[]; other: WalletItemLike[] } {
  if (!defiData || !Array.isArray(defiData)) return { liquidity: [], other: [] };

  const liquidity: WalletItemLike[] = [];
  const other: WalletItemLike[] = [];

  defiData.forEach((defi) => {
    if (defi.position?.label === 'Liquidity') {
      liquidity.push(defi);
    } else {
      other.push(defi);
    }
  });

  return { liquidity, other };
}

// Filter tokens based on positive balance setting
export function getFilteredTokens(tokens: WalletItemLike[], showOnlyPositiveBalance: boolean = true): WalletItemLike[] {
  // When showOnlyPositiveBalance is TRUE we now hide very small dust positions (< $0.05)
  // "Show Assets with no balance" disabled => only show tokens with total value >= 5 cents
  const MIN_VISIBLE_VALUE_USD = 0.05;
  if (showOnlyPositiveBalance) {
    return (tokens || []).filter((tokenData) => {
      const token = (tokenData as Record<string, unknown>).token || tokenData;
      const totalPriceRaw = (token as TokenLike).totalPrice ?? (token as TokenLike).financials?.totalPrice;
      const totalPrice = parseFloat(totalPriceRaw as string);
      if (isNaN(totalPrice)) return false;
      return totalPrice >= MIN_VISIBLE_VALUE_USD;
    });
  }
  return tokens || [];
}

// Group tokens by type for lending positions (supplied/borrowed/rewards)
export function groupTokensByType(positions: PositionObj[]): GroupedTokens {
  if (!positions || !Array.isArray(positions)) return {} as GroupedTokens;

  const grouped: GroupedTokens = {
    supplied: [],
    borrowed: [],
    rewards: [],
  };

  positions.forEach((position) => {
    if (position.tokens && Array.isArray(position.tokens)) {
      position.tokens.forEach((token) => {
        normalizeFinancials(token);
        const t = (token.type || '').toString().toLowerCase();

        const isSupplied = t === 'supplied' || t === 'supply' || t === 'deposit';
        const isBorrowed = t === 'borrowed' || t === 'borrow' || t === 'debt';
        const isReward = t === 'reward' || t === 'rewards';
        const isInternal =
          t === 'defi-token' ||
          t === 'internal' ||
          token.isInternal ||
          token.internal ||
          token.category === 'internal';

        if (isReward) {
          grouped.rewards.push(token);
          return;
        }
        if (isSupplied) {
          grouped.supplied.push(token);
          return;
        }
        if (isBorrowed) {
          grouped.borrowed.push(token);
          return;
        }

        // If token type is missing, infer from position label or other tokens
        if (!t) {
          const lbl = (position.position?.label || position.label || '').toString().toLowerCase();
          const sym = (token.symbol || '').toLowerCase();
          const name = (token.name || '').toLowerCase();

          // Check if this could be a reward token based on symbol/name patterns
          const isLikelyReward =
            sym.includes('reward') ||
            name.includes('reward') ||
            sym.includes('comp') ||
            sym.includes('crv') ||
            sym.includes('cake') ||
            sym.includes('uni') ||
            lbl.includes('reward') ||
            lbl.includes('incentive');

          if (isLikelyReward) {
            grouped.rewards.push(token);
            return;
          }

          if (lbl.includes('borrow')) {
            grouped.borrowed.push(token);
            return;
          }
          if (lbl.includes('supply') || lbl.includes('supplied') || lbl.includes('deposit')) {
            grouped.supplied.push(token);
            return;
          }
          // Fallback: infer by peers in same position
          const hasBorrowedPeer = position.tokens!.some((pt) => {
            const tt = (pt.type || '').toString().toLowerCase();
            return tt === 'borrowed' || tt === 'borrow' || tt === 'debt';
          });
          const hasSuppliedPeer = position.tokens!.some((pt) => {
            const tt = (pt.type || '').toString().toLowerCase();
            return tt === 'supplied' || tt === 'supply' || tt === 'deposit';
          });
          if (hasBorrowedPeer && !hasSuppliedPeer) {
            grouped.borrowed.push(token);
            return;
          }
          // Default to supplied
          grouped.supplied.push(token);
          return;
        }

        // For internal tokens, infer bucket from the position context
        if (isInternal) {
          // First check if this internal token is actually a reward token
          const sym = (token.symbol || '').toLowerCase();
          const name = (token.name || '').toLowerCase();
          const isLikelyReward =
            sym.includes('reward') ||
            name.includes('reward') ||
            sym.includes('comp') ||
            sym.includes('crv') ||
            sym.includes('cake') ||
            sym.includes('uni');

          if (isLikelyReward) {
            grouped.rewards.push(token);
            return;
          }

          const hasSuppliedInPos = position.tokens!.some((pt) => {
            const tt = (pt.type || '').toString().toLowerCase();
            return tt === 'supplied' || tt === 'supply' || tt === 'deposit';
          });
          const hasBorrowedInPos = position.tokens!.some((pt) => {
            const tt = (pt.type || '').toString().toLowerCase();
            return tt === 'borrowed' || tt === 'borrow' || tt === 'debt';
          });

          let bucket: keyof GroupedTokens = 'supplied';
          if (hasBorrowedInPos && !hasSuppliedInPos) bucket = 'borrowed';
          if (hasSuppliedInPos && hasBorrowedInPos) {
            // Heuristic: names containing 'debt' -> borrowed, otherwise supplied
            bucket =
              sym.includes('debt') || sym.includes('vdebt') || sym.includes('variabledebt')
                ? 'borrowed'
                : 'supplied';
          }
          grouped[bucket].push(token);
        }
      });
    }
  });

  return grouped;
}

// Group tokens by type for staking positions (staked/rewards)
export function groupStakingTokensByType(positions: PositionObj[]): GroupedStakingTokens {
  if (!positions || !Array.isArray(positions)) return {} as GroupedStakingTokens;

  const grouped: GroupedStakingTokens = {
    staked: [],
    rewards: [],
  };

  positions.forEach((position) => {
    if (position.tokens && Array.isArray(position.tokens)) {
      position.tokens.forEach((token) => {
        normalizeFinancials(token);
        if (token.type === 'reward' || token.type === 'rewards') {
          grouped.rewards.push(token);
        } else {
          grouped.staked.push(token);
        }
      });
    }
  });

  return grouped;
}

// Group tokens by pool for liquidity positions
export function groupTokensByPool(positions: PositionObj[]): Record<string, PoolGroup> {
  if (!positions || !Array.isArray(positions)) return {};

  const grouped: Record<string, PoolGroup> = {};

  positions.forEach((position) => {
    let poolKey = position.name || position.label || 'Unknown Pool';

    const canDeriveFromTokens =
      position.tokens && Array.isArray(position.tokens) && position.tokens.length > 0;
    if (canDeriveFromTokens) {
      const candidateTokens = position.tokens!.filter((token) => {
        const t = (token.type || '').toString().toLowerCase();
        return !['reward', 'rewards', 'borrowed', 'borrow', 'debt'].includes(t);
      });
      const tokenSymbols = candidateTokens
        .map((token) => token.symbol)
        .filter((sym): sym is string => !!sym && typeof sym === 'string')
        .slice(0, 4);
      const isGenericLabel = /liquidity|pool|position|lp/i.test(poolKey);
      if ((poolKey === 'Unknown Pool' || isGenericLabel) && tokenSymbols.length >= 2) {
        poolKey = tokenSymbols.join(' / ');
      }
    }

    let finalPoolKey = poolKey;
    let counter = 1;
    while (grouped[finalPoolKey]) {
      finalPoolKey = `${poolKey} (${counter})`;
      counter++;
    }

    const tokensArray: TokenLike[] = Array.isArray(position.tokens) ? position.tokens : [];
    tokensArray.forEach(normalizeFinancials);
    // Use unified filtering utilities
    const suppliedTokens = filterSuppliedTokens(tokensArray);
    const rewardTokensFromTokens = filterRewardTokens(tokensArray);

    const rewardsArray =
      rewardTokensFromTokens.length > 0
        ? rewardTokensFromTokens
        : Array.isArray(position.rewards)
          ? position.rewards
          : [];

    // Extract Uniswap V3 style range if present on the position
    const positionRange =
      (position.range as Range | undefined) ||
      (position.position?.range as Range | undefined) ||
      (position.meta?.range as Range | undefined) ||
      (position.extra?.range as Range | undefined) ||
      (position.additionalData?.range as Range | undefined) ||
      (position.position?.additionalData?.range as Range | undefined);

    // Enrich supplied tokens with range when applicable (non-destructive clone)
    const suppliedTokensEnriched = suppliedTokens.map((tok) => ({
      ...tok,
      range: tok.range || positionRange,
    }));

    grouped[finalPoolKey] = {
      label: finalPoolKey,
      tokens: suppliedTokensEnriched as TokenLike[],
      rewards: rewardsArray as TokenLike[],
      totalValue: 0,
      totalRewards: 0,
      // Attach range at pool level as well
      range: positionRange || null,
    };

    // Calcula valores totais
    grouped[finalPoolKey].totalValue =
      grouped[finalPoolKey].tokens?.reduce((sum, token) => sum + (parseFloat(token.totalPrice as string) || 0), 0) || 0;
    grouped[finalPoolKey].totalRewards =
      grouped[finalPoolKey].rewards?.reduce(
        (sum, reward) => sum + (parseFloat(reward.totalPrice as string) || 0),
        0
      ) || 0;
  });

  return grouped;
}

// Unified portfolio breakdown utility to ensure consistent math across Summary, Analytics, Protocols.
export function computePortfolioBreakdown({
  walletTokens = [],
  liquidityGroups = [],
  lendingGroups = [],
  stakingPositions = [],
  lockingGroups = [],
  filterLendingDefiTokens = (toks) => toks || [],
  filterStakingDefiTokens = (toks) => toks || [],
  showLendingDefiTokens = true,
  showStakingDefiTokens = true,
}: PortfolioBreakdownParams): PortfolioBreakdown {
  // Wallet gross
  const walletValue = walletTokens.reduce((sum, td) => {
    const tok = (td as Record<string, unknown>).token || td;
    const v = parseFloat((tok as TokenLike).totalPrice as string) || 0;
    return sum + (isFinite(v) ? v : 0);
  }, 0);

  // Liquidity gross (supplied side only)
  const liquidityValue = liquidityGroups.reduce((total, group) => {
    return (
      total +
      group.positions.reduce(
        (sum, pos) =>
          sum +
          (pos.tokens?.reduce(
            (tokenSum: number, t) => {
              if (isCollectedFeeToken(t)) return tokenSum;
              return tokenSum + (parseFloat((t.financials?.totalPrice || t.totalPrice) as string) || 0);
            },
            0
          ) || 0),
        0
      )
    );
  }, 0);

  // Lending supplied & borrowed separated
  let lendingSupplied = 0;
  let lendingBorrowed = 0;
  lendingGroups.forEach((group) => {
    group.positions.forEach((pos) => {
      const rawTokens: TokenLike[] = Array.isArray(pos.tokens) ? pos.tokens : [];
      const filteredTokens = filterLendingDefiTokens(rawTokens, showLendingDefiTokens);
      const classificationBase = filteredTokens.length > 0 ? filteredTokens : rawTokens;
      if (classificationBase.length === 0) return;
      const tempGrouped = groupTokensByType([
        { position: pos.position || pos, tokens: classificationBase },
      ]);
      (tempGrouped.supplied || []).forEach((t) => {
        const v = Math.abs(parseFloat(t.totalPrice as string) || 0);
        if (isFinite(v)) lendingSupplied += v;
      });
      (tempGrouped.borrowed || []).forEach((t) => {
        const v = Math.abs(parseFloat(t.totalPrice as string) || 0);
        if (isFinite(v)) lendingBorrowed += v;
      });
    });
  });
  const lendingNet = lendingSupplied - lendingBorrowed;

  // Staking total
  const stakingValue = stakingPositions.reduce((sum, pos) => {
    const balance = parseFloat(pos.balance as unknown as string) || 0;
    if (balance) return sum + balance;
    if (Array.isArray(pos.tokens)) {
      const toks = filterStakingDefiTokens(pos.tokens, showStakingDefiTokens);
      const val = toks.reduce((s, t) => s + (parseFloat(t.totalPrice as string) || 0), 0);
      return sum + val;
    }
    return sum;
  }, 0);

  // Locking total
  const lockingValue = lockingGroups.reduce((total, group) => {
    return (
      total +
      group.positions.reduce(
        (sum, pos) =>
          sum +
          (pos.tokens?.reduce(
            (tokenSum: number, t) => {
              if (isCollectedFeeToken(t)) return tokenSum;
              return tokenSum + (parseFloat((t.financials?.totalPrice || t.totalPrice) as string) || 0);
            },
            0
          ) || 0),
        0
      )
    );
  }, 0);

  const defiGross = liquidityValue + lendingSupplied + stakingValue + lockingValue;
  const defiNet = liquidityValue + lendingNet + stakingValue + lockingValue;
  const totalNet = walletValue + defiNet;

  return {
    walletValue,
    liquidityValue,
    lendingSupplied,
    lendingBorrowed,
    lendingNet,
    stakingValue,
    lockingValue,
    defiGross,
    defiNet,
    totalNet,
  };
}

/**
 * extractRewards
 * Heurística compartilhada para extrair uma lista plana de possíveis reward/incentive tokens
 * de um objeto de posição heterogêneo (evita duplicar lógica em múltiplas views como PoolsView).
 * Retorna array (não deduplica) mantendo referência original dos objetos.
 */
export function extractRewards(positionLike: Record<string, unknown> | null | undefined): TokenLike[] {
  const pos = (positionLike?.position || positionLike) as Record<string, unknown> | null | undefined;
  if (!pos || typeof pos !== 'object') return [];
  const rewards: TokenLike[] = [];
  const candidateArrays = [
    pos.rewards,
    (pos.position as Record<string, unknown> | undefined)?.rewards,
    pos.incentives,
    (pos.position as Record<string, unknown> | undefined)?.incentives,
    pos.rewardTokens,
    (pos.position as Record<string, unknown> | undefined)?.rewardTokens,
    pos.distributions,
    pos.emissions,
    pos.farmingRewards,
    pos.gaugeRewards,
    pos.bribes,
    pos.bribeRewards,
    pos.stakingRewards,
    pos.uncollectedRewards,
    pos.unclaimedRewards,
  ];
  candidateArrays.forEach((arr) => {
    if (Array.isArray(arr))
      arr.forEach((r: Record<string, unknown>) => {
        if (r) rewards.push((r?.token || r) as TokenLike);
      });
  });
  const nested = [pos.meta, pos.extra, pos.additionalData, pos.additionalInfo] as Array<Record<string, unknown> | undefined>;
  const keys = [
    'rewards',
    'incentives',
    'rewardTokens',
    'distributions',
    'emissions',
    'farmingRewards',
    'gaugeRewards',
    'bribeRewards',
    'unclaimedRewards',
  ];
  nested.forEach((container) => {
    if (!container || typeof container !== 'object') return;
    keys.forEach((k) => {
      const arr = container[k];
      if (Array.isArray(arr))
        arr.forEach((r: Record<string, unknown>) => {
          if (r) rewards.push((r?.token || r) as TokenLike);
        });
    });
  });
  return rewards.filter(Boolean);
}

// -------------------------------------------------------------
// Percentage & Portfolio Total Helpers (centralized exports)
// -------------------------------------------------------------

let __portfolioTotalValue = 0;

export function setTotalPortfolioValue(value: number | string): void {
  const num = Number(value);
  if (!isNaN(num) && isFinite(num)) {
    __portfolioTotalValue = num;
  }
}

export function getTotalPortfolioValue(): number {
  return __portfolioTotalValue;
}

export function calculatePercentage(value: number | string, total: number | string, options: PercentageOptions = {}): string {
  const { decimals = 2, minDisplay = 0.01 } = options;
  const v = Number(value);
  const t = Number(total);
  if (!t || isNaN(v) || !isFinite(v) || v <= 0) return '0%';
  const pct = (v / t) * 100;
  if (pct > 0 && pct < minDisplay) return `<${minDisplay.toFixed(decimals)}%`;
  return `${pct.toFixed(decimals)}%`;
}

/**
 * extractPoolRange
 * @deprecated Use extractPoolRange from types/wallet.ts instead
 * TODO: Remover esta versão JavaScript - migrado para TypeScript
 */
export function extractPoolRange(positionLike: Record<string, unknown> | null | undefined): Range | null {
  console.warn('⚠️ DEPRECATED: Use extractPoolRange from types/wallet.ts instead');
  if (!(positionLike?.additionalData as Record<string, unknown> | undefined)?.range) return null;

  const range = (positionLike!.additionalData as Record<string, unknown>).range as Record<string, unknown>;

  if (range.lower != null && range.upper != null && range.current != null) {
    return {
      lower: parseFloat(range.lower as string),
      upper: parseFloat(range.upper as string),
      current: parseFloat(range.current as string),
      inRange: range.inRange as boolean,
    };
  }

  return null;
}

/**
 * extractPoolFees24h
 * Extrai fees 24h de pools Uniswap V3 do additionalData
 */
export function extractPoolFees24h(positionLike: Record<string, unknown> | null | undefined): number | null {
  if (!(positionLike?.additionalData as Record<string, unknown> | undefined)?.fees24h) return null;

  const fees = parseFloat((positionLike!.additionalData as Record<string, unknown>).fees24h as string);
  return isFinite(fees) ? fees : null;
}

/**
 * groupBy
 * Função utilitária para agrupar arrays por uma chave derivada
 */
export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc: Record<string, T[]>, item) => {
    const k = keyFn(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

/**
 * sum
 * Função utilitária para somar valores numéricos em um array
 */
export function sum(values: (number | string)[]): number {
  return values.reduce((a: number, b) => a + (parseFloat(b as string) || 0), 0);
}

/**
 * derivePositionKey
 * Função utilitária para gerar chaves únicas para posições baseado em endereço ou símbolo
 */
export function derivePositionKey(p: Record<string, unknown>, index = 0): string {
  const pos = (p.position || p) as Record<string, unknown>;
  const token = (pos.token || pos.asset || {}) as Record<string, unknown>;
  const addr = ((token.address || token.contract || token.contractAddress || '') as string).toLowerCase();
  const symbol = ((token.symbol || '') as string).toLowerCase();
  if (addr) return `${addr}-${index}`;
  return `${symbol || 'asset'}-${index}`;
}

/**
 * extractHealthFactor
 * @deprecated Use extractHealthFactor from types/wallet.ts instead
 * TODO: Remover esta versão JavaScript - migrado para TypeScript
 */
export function extractHealthFactor(positionLike: Record<string, unknown> | null | undefined): number | null {
  console.warn('⚠️ DEPRECATED: Use extractHealthFactor from types/wallet.ts instead');
  if (!(positionLike?.additionalData as Record<string, unknown> | undefined)?.healthFactor) return null;

  const healthFactor = parseFloat((positionLike!.additionalData as Record<string, unknown>).healthFactor as string);
  return isFinite(healthFactor) ? healthFactor : null;
}
