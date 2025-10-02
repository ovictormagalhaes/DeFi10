// Unified token filtering utilities
// Centralizes all token type detection and filtering logic used across the project

/**
 * Normalize a token type to lowercase string for comparison
 * @param {string|number} type - Token type (string or enum number)
 * @returns {string} Normalized lowercase type
 */
export function normalizeTokenType(type) {
  return (type || '').toString().toLowerCase();
}

/**
 * Token type constants based on backend enum
 */
export const TOKEN_TYPES = {
  SUPPLIED: 1,
  BORROWED: 2,
  LIQUIDITY_UNCOLLECTED_FEE: 3,
  LIQUIDITY_COLLECTED_FEE: 4,
};

/**
 * Check if a token is a supplied/deposit token
 * @param {Object} token - Token object
 * @returns {boolean}
 */
export function isSuppliedToken(token) {
  if (!token) return false;
  
  const type = normalizeTokenType(token.type);
  return (
    type === 'supplied' ||
    type === 'supply' ||
    type === 'deposit' ||
    token.type === TOKEN_TYPES.SUPPLIED ||
    !type // Default to supplied if no type
  );
}

/**
 * Check if a token is a borrowed/debt token
 * @param {Object} token - Token object
 * @returns {boolean}
 */
export function isBorrowedToken(token) {
  if (!token) return false;
  
  const type = normalizeTokenType(token.type);
  return (
    type === 'borrowed' ||
    type === 'borrow' ||
    type === 'debt' ||
    token.type === TOKEN_TYPES.BORROWED
  );
}

/**
 * Check if a token is an uncollected fee token
 * @param {Object} token - Token object
 * @returns {boolean}
 */
export function isUncollectedFeeToken(token) {
  if (!token) return false;
  
  const type = normalizeTokenType(token.type);
  return (
    type === 'liquidityuncollectedfee' ||
    token.type === TOKEN_TYPES.LIQUIDITY_UNCOLLECTED_FEE
  );
}

/**
 * Check if a token is a collected fee token
 * @param {Object} token - Token object
 * @returns {boolean}
 */
export function isCollectedFeeToken(token) {
  if (!token) return false;
  
  const type = normalizeTokenType(token.type);
  return (
    type === 'liquiditycollectedfee' ||
    token.type === TOKEN_TYPES.LIQUIDITY_COLLECTED_FEE
  );
}

/**
 * Check if a token is a reward token (by type or symbol patterns)
 * @param {Object} token - Token object
 * @returns {boolean}
 */
export function isRewardToken(token) {
  if (!token) return false;
  
  const type = normalizeTokenType(token.type);
  const symbol = (token.symbol || '').toLowerCase();
  const name = (token.name || '').toLowerCase();

  // Check explicit reward types
  if (type === 'reward' || type === 'rewards') return true;
  
  // Check uncollected fees as rewards (they're displayed in rewards section)
  if (isUncollectedFeeToken(token)) return true;

  // Check by symbol/name patterns for common reward tokens
  const rewardPatterns = [
    'reward', 'comp', 'crv', 'cake', 'uni', 'ldo', 'bal', 'aura'
  ];
  
  return rewardPatterns.some(pattern => 
    symbol.includes(pattern) || name.includes(pattern)
  );
}

/**
 * Filter tokens by supplied/deposit type
 * @param {Array} tokens - Array of tokens
 * @returns {Array} Filtered supplied tokens
 */
export function filterSuppliedTokens(tokens) {
  if (!Array.isArray(tokens)) return [];
  return tokens.filter(isSuppliedToken);
}

/**
 * Filter tokens by borrowed/debt type
 * @param {Array} tokens - Array of tokens
 * @returns {Array} Filtered borrowed tokens
 */
export function filterBorrowedTokens(tokens) {
  if (!Array.isArray(tokens)) return [];
  return tokens.filter(isBorrowedToken);
}

/**
 * Filter tokens by reward type (includes uncollected fees)
 * @param {Array} tokens - Array of tokens
 * @returns {Array} Filtered reward tokens
 */
export function filterRewardTokens(tokens) {
  if (!Array.isArray(tokens)) return [];
  return tokens.filter(isRewardToken);
}

/**
 * Filter tokens by uncollected fee type
 * @param {Array} tokens - Array of tokens
 * @returns {Array} Filtered uncollected fee tokens
 */
export function filterUncollectedFeeTokens(tokens) {
  if (!Array.isArray(tokens)) return [];
  return tokens.filter(isUncollectedFeeToken);
}

/**
 * Calculate total value from an array of tokens
 * @param {Array} tokens - Array of tokens
 * @param {string} valueField - Field to sum (default: 'totalPrice')
 * @returns {number} Total value
 */
export function calculateTokensValue(tokens, valueField = 'totalPrice') {
  if (!Array.isArray(tokens)) return 0;
  
  return tokens.reduce((sum, token) => {
    const value = parseFloat(token[valueField]) || 0;
    return sum + value;
  }, 0);
}

/**
 * Get all reward-like tokens from different sources (rewards array, uncollected fees, etc.)
 * @param {Object} position - Position object that may contain rewards in different places
 * @returns {Array} Combined array of all reward tokens
 */
export function extractAllRewards(position) {
  if (!position) return [];
  
  const rewards = [];
  
  // Direct rewards array
  if (Array.isArray(position.rewards)) {
    rewards.push(...position.rewards);
  }
  
  // Alternative rewards field names
  if (Array.isArray(position.rewardTokens)) {
    rewards.push(...position.rewardTokens);
  }
  
  // Extract reward tokens from main tokens array
  if (Array.isArray(position.tokens)) {
    const rewardTokensFromArray = filterRewardTokens(position.tokens);
    rewards.push(...rewardTokensFromArray);
  }
  
  // Extract from uncollected fees arrays
  const uncollectedSources = [
    position.uncollectedFees,
    position.fees,
    position.uncollected
  ];
  
  uncollectedSources.forEach(source => {
    if (Array.isArray(source)) {
      const uncollectedRewards = source.filter(item => 
        item && (isUncollectedFeeToken(item) || item.financials)
      );
      rewards.push(...uncollectedRewards);
    }
  });
  
  return rewards;
}

/**
 * Normalize a token to ensure it has standard price fields
 * @param {Object} token - Token object
 * @returns {Object} Token with normalized price fields
 */
export function normalizeTokenPrice(token) {
  if (!token) return token;
  
  // Find the best price field available
  const priceFields = [
    'totalPrice',
    'totalValueUsd', 
    'totalValueUSD',
    'totalValue',
    'valueUsd',
    'price'
  ];
  
  let totalPrice = 0;
  
  // Check direct fields
  for (const field of priceFields) {
    if (token[field] !== undefined && token[field] !== null) {
      totalPrice = parseFloat(token[field]) || 0;
      break;
    }
  }
  
  // Check financials object
  if (!totalPrice && token.financials) {
    for (const field of priceFields) {
      if (token.financials[field] !== undefined && token.financials[field] !== null) {
        totalPrice = parseFloat(token.financials[field]) || 0;
        break;
      }
    }
  }
  
  return {
    ...token,
    totalPrice
  };
}