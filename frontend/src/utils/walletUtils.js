// Utility functions for wallet data processing and formatting
import {
  filterSuppliedTokens,
  filterBorrowedTokens,
  filterRewardTokens,
  isRewardToken,
  normalizeTokenPrice,
} from './tokenFilters';

// Normalize financials block into flat token fields (mutates the object for convenience)
export function normalizeFinancials(token) {
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
  GROUP: 98, // virtual grouping type (frontend only)
};

// Filter items by type from a unified data array
export function filterItemsByType(items, type) {
  if (!items || !Array.isArray(items)) return [];
  return items.filter((item) => item.type === type);
}

// Get wallet tokens from unified data
export function getWalletTokens(data) {
  const items = filterItemsByType(data, ITEM_TYPES.WALLET);
  const collected = [];
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
export function formatBalance(balance, isNative = false) {
  const balanceNum = parseFloat(balance);
  // Use 18 decimals for native tokens (ETH), 6-8 for others
  const decimals = isNative ? 18 : 6;
  const divisor = Math.pow(10, decimals);
  const formatted = (balanceNum / divisor).toFixed(6);
  return parseFloat(formatted).toString(); // Remove trailing zeros
}

// Format native balance for tooltip
export function formatNativeBalance(token) {
  // Normalize first (in case caller passed raw)
  normalizeFinancials(token);
  const totalPriceCandidate = token.totalPrice ?? token.financials?.totalPrice;
  const balanceFormattedCandidate = token.balanceFormatted ?? token.financials?.balanceFormatted;
  if (!balanceFormattedCandidate && (!token.balance || !totalPriceCandidate)) return 'N/A';

  const balanceNum = parseFloat(token.balance);
  const totalPriceNum = parseFloat(totalPriceCandidate);

  // Use decimalPlaces from API if available
  if (token.decimalPlaces !== null && token.decimalPlaces !== undefined) {
    const decimals = parseInt(token.decimalPlaces);
    const divisor = Math.pow(10, decimals);
    const formatted = (balanceNum / divisor).toFixed(6);
    const cleanFormatted = parseFloat(formatted).toString();
    return `${cleanFormatted} ${token.symbol}`;
  }

  // Calculate the actual balance by dividing totalPrice by unitPrice
  // This gives us the real token amount without needing to guess decimals
  if (token.unitPrice && token.unitPrice > 0) {
    const actualBalance = totalPriceNum / parseFloat(token.unitPrice);
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
export function formatPrice(price) {
  if (price === null || price === undefined || isNaN(price)) return '$0.00';
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
export function formatTokenAmount(token, maxDecimals = 4) {
  if (!token) return '-';
  // Normalize first so financials.* are promoted
  normalizeFinancials(token);

  // 1. Direct formatted fields from backend (preferred base number)
  // Backend rename: AmountFormatted (capital A) - keep backwards compatibility
  let base = token.AmountFormatted;
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
function truncateAndFormat(value, maxDecimals) {
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
export function groupDefiByProtocol(defiData) {
  if (!defiData || !Array.isArray(defiData)) return [];

  const grouped = {};

  // Helper: extract a normalized chain name from a position or nested tokens
  const resolveChain = (obj) => {
    if (!obj || typeof obj !== 'object') return undefined;
    const direct =
      obj.chainId ||
      obj.chainID ||
      obj.chain_id ||
      obj.chain ||
      obj.networkId ||
      obj.network ||
      obj.chainName;
    if (direct) return direct;
    // Look inside protocol field
    if (obj.protocol && typeof obj.protocol === 'object') {
      const p = obj.protocol;
      const protoChain =
        p.chainId || p.chainID || p.chain_id || p.chain || p.networkId || p.network || p.chainName;
      if (protoChain) return protoChain;
    }
    // Fallback: search for any property containing chain/network
    for (const k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      if (/(chain|network)/i.test(k)) {
        const v = obj[k];
        if (v && (typeof v === 'string' || typeof v === 'number')) return v;
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
    let protocolObj = { ...protocol };

    if (isUniswapV3 || isPendleV2) {
      // Derive chain from position or its tokens
      const chainCandidate =
        resolveChain(position) ||
        (Array.isArray(position.tokens) &&
          position.tokens.map((t) => resolveChain(t)).find(Boolean));
      if (chainCandidate) {
        const chainStr = chainCandidate.toString();
        const chainClean = chainStr.replace(/[^a-zA-Z0-9_-]/g, '');
        effectiveProtocolId = `${baseProtocolId}-${chainClean}`.toLowerCase();
        // Pretty chain name capitalized
        const prettyChain = chainClean.charAt(0).toUpperCase() + chainClean.slice(1);

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
      type: defi.type,
      additionalData: defi.additionalData,
    });
  });

  return Object.values(grouped);
}

// Group data by protocol name for table display
export function groupByProtocolName(data) {
  if (!data || !Array.isArray(data)) return {};

  const grouped = {};

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
export function separateDefiByType(defiData) {
  if (!defiData || !Array.isArray(defiData)) return { liquidity: [], other: [] };

  const liquidity = [];
  const other = [];

  defiData.forEach((defi) => {
    if (defi.position.label === 'Liquidity') {
      liquidity.push(defi);
    } else {
      other.push(defi);
    }
  });

  return { liquidity, other };
}

// Filter tokens based on positive balance setting
export function getFilteredTokens(tokens, showOnlyPositiveBalance = true) {
  // When showOnlyPositiveBalance is TRUE we now hide very small dust positions (< $0.05)
  // "Show Assets with no balance" disabled => only show tokens with total value >= 5 cents
  const MIN_VISIBLE_VALUE_USD = 0.05;
  if (showOnlyPositiveBalance) {
    return (tokens || []).filter((tokenData) => {
      const token = tokenData.token || tokenData; // Support both old and new structure
      const totalPriceRaw = token.totalPrice ?? token.financials?.totalPrice;
      const totalPrice = parseFloat(totalPriceRaw);
      if (isNaN(totalPrice)) return false;
      return totalPrice >= MIN_VISIBLE_VALUE_USD;
    });
  }
  return tokens || [];
}

// Group tokens by type for lending positions (supplied/borrowed/rewards)
export function groupTokensByType(positions) {
  if (!positions || !Array.isArray(positions)) return {};

  const grouped = {
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
          const hasBorrowedPeer = position.tokens.some((pt) => {
            const tt = (pt.type || '').toString().toLowerCase();
            return tt === 'borrowed' || tt === 'borrow' || tt === 'debt';
          });
          const hasSuppliedPeer = position.tokens.some((pt) => {
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

          const hasSuppliedInPos = position.tokens.some((pt) => {
            const tt = (pt.type || '').toString().toLowerCase();
            return tt === 'supplied' || tt === 'supply' || tt === 'deposit';
          });
          const hasBorrowedInPos = position.tokens.some((pt) => {
            const tt = (pt.type || '').toString().toLowerCase();
            return tt === 'borrowed' || tt === 'borrow' || tt === 'debt';
          });

          let bucket = 'supplied';
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
export function groupStakingTokensByType(positions) {
  if (!positions || !Array.isArray(positions)) return {};

  const grouped = {
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
          // Default para staked se não for explicitamente reward
          grouped.staked.push(token);
        }
      });
    }
  });

  return grouped;
}

// Group tokens by pool for liquidity positions
export function groupTokensByPool(positions) {
  if (!positions || !Array.isArray(positions)) return {};

  const grouped = {};

  positions.forEach((position, positionIndex) => {
    // Usa o nome da posição como chave do pool, ou cria baseado nos tokens
    let poolKey = position.name || position.label || 'Unknown Pool';

    // Se não tem nome, cria baseado nos símbolos dos tokens supplied
    const canDeriveFromTokens =
      position.tokens && Array.isArray(position.tokens) && position.tokens.length > 0;
    if (canDeriveFromTokens) {
      const candidateTokens = position.tokens.filter((token) => {
        const t = (token.type || '').toLowerCase();
        // Exclui reward / borrowed tokens da composição do nome
        return !['reward', 'rewards', 'borrowed', 'borrow', 'debt'].includes(t);
      });
      const tokenSymbols = candidateTokens
        .map((token) => token.symbol)
        .filter((sym) => sym && typeof sym === 'string')
        .slice(0, 4); // evita nomes gigantes, normalmente 2
      const isGenericLabel = /liquidity|pool|position|lp/i.test(poolKey);
      if ((poolKey === 'Unknown Pool' || isGenericLabel) && tokenSymbols.length >= 2) {
        poolKey = tokenSymbols.join(' / ');
      }
    }

    // Se o poolKey já existe, adiciona um sufixo para diferenciá-lo
    let finalPoolKey = poolKey;
    let counter = 1;
    while (grouped[finalPoolKey]) {
      finalPoolKey = `${poolKey} (${counter})`;
      counter++;
    }

    const tokensArray = Array.isArray(position.tokens) ? position.tokens : [];
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
      position.range ||
      position.position?.range ||
      position.meta?.range ||
      position.extra?.range ||
      position.additionalData?.range ||
      position.position?.additionalData?.range;

    // Enrich supplied tokens with range when applicable (non-destructive clone)
    const suppliedTokensEnriched = suppliedTokens.map((tok) => ({
      ...tok,
      range: tok.range || positionRange,
    }));

    grouped[finalPoolKey] = {
      label: finalPoolKey,
      tokens: suppliedTokensEnriched,
      rewards: rewardsArray,
      totalValue: 0,
      totalRewards: 0,
      // Attach range at pool level as well
      range: positionRange,
    };

    // Calcula valores totais
    grouped[finalPoolKey].totalValue =
      grouped[finalPoolKey].tokens?.reduce((sum, token) => sum + (token.totalPrice || 0), 0) || 0;
    grouped[finalPoolKey].totalRewards =
      grouped[finalPoolKey].rewards?.reduce(
        (sum, reward) => sum + (parseFloat(reward.totalPrice) || 0),
        0
      ) || 0;
  });

  return grouped;
}

// Unified portfolio breakdown utility to ensure consistent math across Summary, Analytics, Protocols.
// Params are arrays already fetched by getters in App: walletTokens (flat token objects),
// liquidityGroups (groupDefiByProtocol(getLiquidityPoolsData())), lendingGroups (groupDefiByProtocol(...)), stakingPositions (raw staking positions array)
// filterLendingDefiTokens / filterStakingDefiTokens to respect user toggles for internal tokens.
export function computePortfolioBreakdown({
  walletTokens = [],
  liquidityGroups = [],
  lendingGroups = [],
  stakingPositions = [],
  filterLendingDefiTokens = (toks) => toks || [],
  filterStakingDefiTokens = (toks) => toks || [],
  showLendingDefiTokens = true,
  showStakingDefiTokens = true,
}) {
  // Wallet gross
  const walletValue = walletTokens.reduce((sum, td) => {
    const tok = td.token || td;
    const v = parseFloat(tok.totalPrice) || 0;
    return sum + (isFinite(v) ? v : 0);
  }, 0);

  // Liquidity gross (supplied side only) – rewards not counted here (already inside tokens if priced)
  const liquidityValue = liquidityGroups.reduce((total, group) => {
    return (
      total +
      group.positions.reduce(
        (sum, pos) =>
          sum +
          (pos.tokens?.reduce((tokenSum, t) => tokenSum + (parseFloat(t.totalPrice) || 0), 0) || 0),
        0
      )
    );
  }, 0);

  // Lending supplied & borrowed separated (classify using groupTokensByType so internal aTokens contam)
  let lendingSupplied = 0;
  let lendingBorrowed = 0;
  lendingGroups.forEach((group) => {
    group.positions.forEach((pos) => {
      const rawTokens = Array.isArray(pos.tokens) ? pos.tokens : [];
      const filteredTokens = filterLendingDefiTokens(rawTokens, showLendingDefiTokens);
      // Se filtro removeu tudo (ex: internos ocultos), ainda classificamos base bruta para não perder supply real
      const classificationBase = filteredTokens.length > 0 ? filteredTokens : rawTokens;
      if (classificationBase.length === 0) return;
      const tempGrouped = groupTokensByType([
        { position: pos.position || pos, tokens: classificationBase },
      ]);
      (tempGrouped.supplied || []).forEach((t) => {
        const v = Math.abs(parseFloat(t.totalPrice) || 0);
        if (isFinite(v)) lendingSupplied += v;
      });
      (tempGrouped.borrowed || []).forEach((t) => {
        const v = Math.abs(parseFloat(t.totalPrice) || 0);
        if (isFinite(v)) lendingBorrowed += v;
      });
      // rewards ignorados
    });
  });
  const lendingNet = lendingSupplied - lendingBorrowed; // can be negative

  // Staking total (treat balances as positive assets)
  const stakingValue = stakingPositions.reduce((sum, pos) => {
    // Primary numeric field is balance (already USD) or totalPrice inside tokens
    const balance = parseFloat(pos.balance) || 0;
    if (balance) return sum + balance;
    if (Array.isArray(pos.tokens)) {
      const toks = filterStakingDefiTokens(pos.tokens, showStakingDefiTokens);
      const val = toks.reduce((s, t) => s + (parseFloat(t.totalPrice) || 0), 0);
      return sum + val;
    }
    return sum;
  }, 0);

  const defiGross = liquidityValue + lendingSupplied + stakingValue; // borrowed excluded from gross
  const defiNet = liquidityValue + lendingNet + stakingValue; // borrowed subtracts
  const totalNet = walletValue + defiNet;

  return {
    walletValue,
    liquidityValue,
    lendingSupplied,
    lendingBorrowed,
    lendingNet,
    stakingValue,
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
export function extractRewards(positionLike) {
  const pos = positionLike?.position || positionLike;
  if (!pos || typeof pos !== 'object') return [];
  const rewards = [];
  const candidateArrays = [
    pos.rewards,
    pos.position?.rewards,
    pos.incentives,
    pos.position?.incentives,
    pos.rewardTokens,
    pos.position?.rewardTokens,
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
      arr.forEach((r) => {
        if (r) rewards.push(r?.token || r);
      });
  });
  const nested = [pos.meta, pos.extra, pos.additionalData, pos.additionalInfo];
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
        arr.forEach((r) => {
          if (r) rewards.push(r?.token || r);
        });
    });
  });
  return rewards.filter(Boolean);
}

// -------------------------------------------------------------
// Percentage & Portfolio Total Helpers (centralized exports)
// -------------------------------------------------------------
// Some components (e.g. SummaryProtocolsCard, TokensMenu) previously relied on
// global inline helpers. We expose a shared implementation here.

let __portfolioTotalValue = 0; // module-scoped cached total (net) in USD

/**
 * setTotalPortfolioValue
 * Allows the app shell (e.g. after computePortfolioBreakdown) to register the
 * current total net portfolio value so that leaf components which only import
 * utils (and not the full breakdown object) can derive percentages.
 */
export function setTotalPortfolioValue(value) {
  const num = Number(value);
  if (!isNaN(num) && isFinite(num)) {
    __portfolioTotalValue = num;
  }
}

/**
 * getTotalPortfolioValue
 * Returns the last registered portfolio total. If never set, returns 0.
 */
export function getTotalPortfolioValue() {
  return __portfolioTotalValue;
}

/**
 * calculatePercentage
 * Consistent percentage formatting with tiny value handling.
 * value: part value (>= 0), total: denominator (> 0)
 * options.decimals: number of fraction digits (default 2)
 * options.minDisplay: minimal non-zero shown threshold (default 0.01 => '<0.01%')
 */
export function calculatePercentage(value, total, options = {}) {
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
export function extractPoolRange(positionLike) {
  console.warn('⚠️ DEPRECATED: Use extractPoolRange from types/wallet.ts instead');
  if (!positionLike?.additionalData?.range) return null;

  const range = positionLike.additionalData.range;

  // Valida se tem as propriedades necessárias
  if (range.lower != null && range.upper != null && range.current != null) {
    return {
      lower: parseFloat(range.lower),
      upper: parseFloat(range.upper),
      current: parseFloat(range.current),
      inRange: range.inRange,
    };
  }

  return null;
}

/**
 * extractPoolFees24h
 * Extrai fees 24h de pools Uniswap V3 do additionalData
 */
export function extractPoolFees24h(positionLike) {
  if (!positionLike?.additionalData?.fees24h) return null;

  const fees = parseFloat(positionLike.additionalData.fees24h);
  return isFinite(fees) ? fees : null;
}

/**
 * groupBy
 * Função utilitária para agrupar arrays por uma chave derivada
 */
export function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
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
export function sum(values) {
  return values.reduce((a, b) => a + (parseFloat(b) || 0), 0);
}

/**
 * derivePositionKey
 * Função utilitária para gerar chaves únicas para posições baseado em endereço ou símbolo
 */
export function derivePositionKey(p, index) {
  const pos = p.position || p;
  const token = pos.token || pos.asset || {};
  const addr = (token.address || token.contract || token.contractAddress || '').toLowerCase();
  const symbol = (token.symbol || '').toLowerCase();
  if (addr) return `${addr}-${index}`;
  return `${symbol || 'asset'}-${index}`;
}

/**
 * extractHealthFactor
 * @deprecated Use extractHealthFactor from types/wallet.ts instead
 * TODO: Remover esta versão JavaScript - migrado para TypeScript
 */
export function extractHealthFactor(positionLike) {
  console.warn('⚠️ DEPRECATED: Use extractHealthFactor from types/wallet.ts instead');
  if (!positionLike?.additionalData?.healthFactor) return null;

  const healthFactor = parseFloat(positionLike.additionalData.healthFactor);
  return isFinite(healthFactor) ? healthFactor : null;
}
