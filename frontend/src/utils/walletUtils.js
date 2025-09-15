// Utility functions for wallet data processing and formatting

// Normalize financials block into flat token fields (mutates the object for convenience)
export function normalizeFinancials(token) {
  if (!token || typeof token !== 'object') return token
  const fin = token.financials
  if (fin && typeof fin === 'object') {
    if (token.balance === undefined && fin.amount !== undefined) token.balance = fin.amount
    if (token.decimalPlaces === undefined && fin.decimalPlaces !== undefined) token.decimalPlaces = fin.decimalPlaces
    if (token.balanceFormatted === undefined && fin.balanceFormatted !== undefined) token.balanceFormatted = fin.balanceFormatted
    if (token.price === undefined && fin.price !== undefined) token.price = fin.price
    if (token.totalPrice === undefined && fin.totalPrice !== undefined) token.totalPrice = fin.totalPrice
  }
  return token
}

// Constants for item types
export const ITEM_TYPES = {
  WALLET: 1,
  LIQUIDITY_POOL: 2,
  LENDING_AND_BORROWING: 3,
  STAKING: 4
}

// Filter items by type from a unified data array
export function filterItemsByType(items, type) {
  if (!items || !Array.isArray(items)) return []
  return items.filter(item => item.type === type)
}

// Get wallet tokens from unified data
export function getWalletTokens(data) {
  const items = filterItemsByType(data, ITEM_TYPES.WALLET)
  const collected = []
  items.forEach(item => {
    // Old shape: direct item.token
    if (item.token) {
      normalizeFinancials(item.token)
      collected.push({ ...item, token: item.token })
    }
    // New shape: tokens array inside position.tokens
    if (item.position && Array.isArray(item.position.tokens)) {
      item.position.tokens.forEach(tok => {
        normalizeFinancials(tok)
        collected.push({ ...item, token: tok })
      })
    }
  })
  return collected
}

// Get liquidity pools from unified data
export function getLiquidityPools(data) {
  return filterItemsByType(data, ITEM_TYPES.LIQUIDITY_POOL)
}

// Get lending and borrowing positions from unified data
export function getLendingAndBorrowingPositions(data) {
  return filterItemsByType(data, ITEM_TYPES.LENDING_AND_BORROWING)
}

// Get staking positions from unified data
export function getStakingPositions(data) {
  return filterItemsByType(data, ITEM_TYPES.STAKING)
}

// Format balance (use default decimals since not provided in response)
export function formatBalance(balance, isNative = false) {
  const balanceNum = parseFloat(balance)
  // Use 18 decimals for native tokens (ETH), 6-8 for others
  const decimals = isNative ? 18 : 6
  const divisor = Math.pow(10, decimals)
  const formatted = (balanceNum / divisor).toFixed(6)
  return parseFloat(formatted).toString() // Remove trailing zeros
}

// Format native balance for tooltip
export function formatNativeBalance(token) {
  // Normalize first (in case caller passed raw)
  normalizeFinancials(token)
  const totalPriceCandidate = token.totalPrice ?? token.financials?.totalPrice
  const balanceFormattedCandidate = token.balanceFormatted ?? token.financials?.balanceFormatted
  if (!balanceFormattedCandidate && (!token.balance || !totalPriceCandidate)) return 'N/A'
  
  const balanceNum = parseFloat(token.balance)
  const totalPriceNum = parseFloat(totalPriceCandidate)
  
  // Use decimalPlaces from API if available
  if (token.decimalPlaces !== null && token.decimalPlaces !== undefined) {
    const decimals = parseInt(token.decimalPlaces)
    const divisor = Math.pow(10, decimals)
    const formatted = (balanceNum / divisor).toFixed(6)
    const cleanFormatted = parseFloat(formatted).toString()
    return `${cleanFormatted} ${token.symbol}`
  }
  
  // Calculate the actual balance by dividing totalPrice by unitPrice
  // This gives us the real token amount without needing to guess decimals
  if (token.unitPrice && token.unitPrice > 0) {
    const actualBalance = totalPriceNum / parseFloat(token.unitPrice)
    return `${actualBalance.toFixed(6)} ${token.symbol}`
  }
  
  // Fallback: try to determine decimals by comparing balance and totalPrice
  // If balance is much larger than totalPrice, it's likely a high-decimal token
  const ratio = balanceNum / totalPriceNum
  let decimals = 18 // default
  
  if (ratio > 1000000 && ratio < 10000000) {
    decimals = 6 // USDC-like (6 decimals)
  } else if (ratio > 10000000 && ratio < 1000000000) {
    decimals = 8 // cbBTC-like (8 decimals)
  }
  
  const divisor = Math.pow(10, decimals)
  const formatted = (balanceNum / divisor).toFixed(6)
  const cleanFormatted = parseFloat(formatted).toString()
  return `${cleanFormatted} ${token.symbol}`
}

// Format price with currency symbol
export function formatPrice(price) {
  if (price === null || price === undefined || isNaN(price)) return '$0.00'
  const priceNum = Number(price)
  if (priceNum === 0) return '$0.00'

  const isNegative = priceNum < 0
  const abs = Math.abs(priceNum)

  let fractionDigits = 2
  if (abs < 0.01) {
    fractionDigits = 6
  } else if (abs < 1) {
    fractionDigits = 4
  } else {
    fractionDigits = 2
  }

  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })

  return isNegative ? `-$${formatted}` : `$${formatted}`
}

// Format raw token amount (prioritizing provided formatted fields) with maxDecimals (truncate, not round)
export function formatTokenAmount(token, maxDecimals = 4) {
  if (!token) return '-'
  // Normalize first so financials.* are promoted
  normalizeFinancials(token)

  // 1. Direct formatted fields from backend (preferred base number)
  // Backend rename: AmountFormatted (capital A) - keep backwards compatibility
  let base = token.AmountFormatted
  if (base === undefined || base === null) base = token.amountFormatted
  if (base === undefined || base === null) base = token.formattedAmount
  if (base === undefined || base === null) base = token.balanceFormatted
  if ((base === undefined || base === null) && token.financials) {
    base = token.financials.AmountFormatted ?? token.financials.amountFormatted ?? token.financials.formattedAmount ?? token.financials.balanceFormatted
  }

  // Convert string to number if needed
  if (base !== undefined && base !== null) {
    const num = Number(base)
    if (!isNaN(num) && isFinite(num)) {
      return truncateAndFormat(num, maxDecimals)
    }
  }

  // 2. Raw balance + decimalPlaces
  if (token.balance !== undefined && token.decimalPlaces !== undefined) {
    const raw = Number(token.balance)
    const decimals = Number(token.decimalPlaces)
    if (!isNaN(raw) && isFinite(raw) && !isNaN(decimals) && decimals >= 0 && decimals < 80) {
      const scaled = raw / Math.pow(10, decimals)
      return truncateAndFormat(scaled, maxDecimals)
    }
  }

  // 3. Derive from totalPrice / price
  if ((token.totalPrice || token.totalPrice === 0) && token.price) {
    const tp = Number(token.totalPrice)
    const p = Number(token.price)
    if (p > 0 && isFinite(tp) && isFinite(p)) {
      const derived = tp / p
      return truncateAndFormat(derived, maxDecimals)
    }
  }

  return '-'
}

// Helper: truncate (not round) and format with up to maxDecimals, dropping trailing zeros
function truncateAndFormat(value, maxDecimals) {
  if (typeof value !== 'number' || !isFinite(value)) return '-'
  const factor = Math.pow(10, maxDecimals)
  const truncated = Math.trunc(value * factor) / factor
  return truncated.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  })
}

// Group DeFi positions by protocol
export function groupDefiByProtocol(defiData) {
  if (!defiData || !Array.isArray(defiData)) return []
  
  const grouped = {}
  
  defiData.forEach(defi => {
    const protocolId = defi.protocol.id
    if (!grouped[protocolId]) {
      grouped[protocolId] = {
        protocol: defi.protocol,
        positions: []
      }
    }
    grouped[protocolId].positions.push({
      ...defi.position,
      additionalData: defi.additionalData
    })
  })
  
  return Object.values(grouped)
}

// Group data by protocol name for table display
export function groupByProtocolName(data) {
  if (!data || !Array.isArray(data)) return {}
  
  const grouped = {}
  
  data.forEach(item => {
    const protocolName = item.protocol
    if (!grouped[protocolName]) {
      grouped[protocolName] = []
    }
    grouped[protocolName].push(item)
  })
  
  return grouped
}

// Separate DeFi into Liquidity and Other types
export function separateDefiByType(defiData) {
  if (!defiData || !Array.isArray(defiData)) return { liquidity: [], other: [] }
  
  const liquidity = []
  const other = []
  
  defiData.forEach(defi => {
    if (defi.position.label === 'Liquidity') {
      liquidity.push(defi)
    } else {
      other.push(defi)
    }
  })
  
  return { liquidity, other }
}

// Filter tokens based on positive balance setting
export function getFilteredTokens(tokens, showOnlyPositiveBalance = true) {
  // When showOnlyPositiveBalance is TRUE we now hide very small dust positions (< $0.05)
  // "Show Assets with no balance" disabled => only show tokens with total value >= 5 cents
  const MIN_VISIBLE_VALUE_USD = 0.05
  if (showOnlyPositiveBalance) {
    return (tokens || []).filter(tokenData => {
      const token = tokenData.token || tokenData // Support both old and new structure
      const totalPriceRaw = token.totalPrice ?? token.financials?.totalPrice
      const totalPrice = parseFloat(totalPriceRaw)
      if (isNaN(totalPrice)) return false
      return totalPrice >= MIN_VISIBLE_VALUE_USD
    })
  }
  return tokens || []
}

// Group tokens by type for lending positions (supplied/borrowed)
export function groupTokensByType(positions) {
  if (!positions || !Array.isArray(positions)) return {}
  
  const grouped = {
    supplied: [],
    borrowed: []
  }
  
  positions.forEach(position => {
    if (position.tokens && Array.isArray(position.tokens)) {
      position.tokens.forEach(token => {
        normalizeFinancials(token)
        const t = (token.type || '').toString().toLowerCase()

        const isSupplied = t === 'supplied' || t === 'supply' || t === 'deposit'
        const isBorrowed = t === 'borrowed' || t === 'borrow' || t === 'debt'
        const isInternal = t === 'defi-token' || t === 'internal' || token.isInternal || token.internal || token.category === 'internal'

        if (isSupplied) {
          grouped.supplied.push(token)
          return
        }
        if (isBorrowed) {
          grouped.borrowed.push(token)
          return
        }

        // If token type is missing, infer from position label or other tokens
        if (!t) {
          const lbl = (position.position?.label || position.label || '').toString().toLowerCase()
          if (lbl.includes('borrow')) {
            grouped.borrowed.push(token)
            return
          }
          if (lbl.includes('supply') || lbl.includes('supplied') || lbl.includes('deposit')) {
            grouped.supplied.push(token)
            return
          }
          // Fallback: infer by peers in same position
          const hasBorrowedPeer = position.tokens.some(pt => {
            const tt = (pt.type || '').toString().toLowerCase()
            return tt === 'borrowed' || tt === 'borrow' || tt === 'debt'
          })
          const hasSuppliedPeer = position.tokens.some(pt => {
            const tt = (pt.type || '').toString().toLowerCase()
            return tt === 'supplied' || tt === 'supply' || tt === 'deposit'
          })
          if (hasBorrowedPeer && !hasSuppliedPeer) {
            grouped.borrowed.push(token)
            return
          }
          // Default to supplied
          grouped.supplied.push(token)
          return
        }

        // For internal tokens, infer bucket from the position context
        if (isInternal) {
          const hasSuppliedInPos = position.tokens.some(pt => {
            const tt = (pt.type || '').toString().toLowerCase()
            return tt === 'supplied' || tt === 'supply' || tt === 'deposit'
          })
          const hasBorrowedInPos = position.tokens.some(pt => {
            const tt = (pt.type || '').toString().toLowerCase()
            return tt === 'borrowed' || tt === 'borrow' || tt === 'debt'
          })

          let bucket = 'supplied'
          if (hasBorrowedInPos && !hasSuppliedInPos) bucket = 'borrowed'
          if (hasSuppliedInPos && hasBorrowedInPos) {
            // Heuristic: names containing 'debt' -> borrowed, otherwise supplied
            const sym = (token.symbol || '').toLowerCase()
            bucket = (sym.includes('debt') || sym.includes('vdebt') || sym.includes('variabledebt')) ? 'borrowed' : 'supplied'
          }
          grouped[bucket].push(token)
        }
      })
    }
  })
  
  return grouped
}

// Group tokens by type for staking positions (staked/rewards)
export function groupStakingTokensByType(positions) {
  if (!positions || !Array.isArray(positions)) return {}
  
  const grouped = {
    staked: [],
    rewards: []
  }
  
  positions.forEach(position => {
    if (position.tokens && Array.isArray(position.tokens)) {
      position.tokens.forEach(token => {
        normalizeFinancials(token)
        if (token.type === 'reward' || token.type === 'rewards') {
          grouped.rewards.push(token)
        } else {
          // Default para staked se não for explicitamente reward
          grouped.staked.push(token)
        }
      })
    }
  })
  
  return grouped
}

// Group tokens by pool for liquidity positions
export function groupTokensByPool(positions) {
  if (!positions || !Array.isArray(positions)) return {}
  
  const grouped = {}
  
  positions.forEach((position, positionIndex) => {
    // Usa o nome da posição como chave do pool, ou cria baseado nos tokens
    let poolKey = position.name || position.label || 'Unknown Pool'
    
    // Se não tem nome, cria baseado nos símbolos dos tokens supplied
    const canDeriveFromTokens = position.tokens && Array.isArray(position.tokens) && position.tokens.length > 0
    if (canDeriveFromTokens) {
      const candidateTokens = position.tokens.filter(token => {
        const t = (token.type || '').toLowerCase()
        // Exclui reward / borrowed tokens da composição do nome
        return !['reward','rewards','borrowed','borrow','debt'].includes(t)
      })
      const tokenSymbols = candidateTokens
        .map(token => token.symbol)
        .filter(sym => sym && typeof sym === 'string')
        .slice(0, 4) // evita nomes gigantes, normalmente 2
      const isGenericLabel = /liquidity|pool|position|lp/i.test(poolKey)
      if ((poolKey === 'Unknown Pool' || isGenericLabel) && tokenSymbols.length >= 2) {
        poolKey = tokenSymbols.join(' / ')
      }
    }
    
    // Se o poolKey já existe, adiciona um sufixo para diferenciá-lo
    let finalPoolKey = poolKey
    let counter = 1
    while (grouped[finalPoolKey]) {
      finalPoolKey = `${poolKey} (${counter})`
      counter++
    }
    
    const tokensArray = Array.isArray(position.tokens) ? position.tokens : []
  tokensArray.forEach(normalizeFinancials)
    const suppliedTokens = tokensArray.filter(token => {
      const t = (token.type || '').toString().toLowerCase()
      return t === 'supplied' || t === 'supply' || t === 'deposit' || !t
    })
    const rewardTokensFromTokens = tokensArray.filter(token => {
      const t = (token.type || '').toString().toLowerCase()
      return t === 'reward' || t === 'rewards'
    })
    const rewardsArray = rewardTokensFromTokens.length > 0
      ? rewardTokensFromTokens
      : (Array.isArray(position.rewards) ? position.rewards : [])

    grouped[finalPoolKey] = {
      label: finalPoolKey,
      tokens: suppliedTokens,
      rewards: rewardsArray,
      totalValue: 0,
      totalRewards: 0
    }
    
    // Calcula valores totais
    grouped[finalPoolKey].totalValue = grouped[finalPoolKey].tokens?.reduce((sum, token) => sum + (token.totalPrice || 0), 0) || 0
  grouped[finalPoolKey].totalRewards = grouped[finalPoolKey].rewards?.reduce((sum, reward) => sum + (parseFloat(reward.totalPrice) || 0), 0) || 0
  })
  
  return grouped
}
