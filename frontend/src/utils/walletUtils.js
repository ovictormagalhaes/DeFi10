// Utility functions for wallet data processing and formatting

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
  if (!token.balance || !token.totalPrice) return 'N/A'
  
  const balanceNum = parseFloat(token.balance)
  const totalPriceNum = parseFloat(token.totalPrice)
  
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
  if (price === 0 || price === null || price === undefined) return '$0.00'
  const priceNum = parseFloat(price)
  if (priceNum < 0.01) {
    return `$${priceNum.toFixed(6)}`
  } else if (priceNum < 1) {
    return `$${priceNum.toFixed(4)}`
  } else {
    return `$${priceNum.toFixed(2)}`
  }
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
  if (showOnlyPositiveBalance) {
    return tokens.filter(token => {
      const totalPrice = parseFloat(token.totalPrice)
      return totalPrice > 0
    })
  }
  return tokens
}

// Group tokens by pool for liquidity positions
export function groupTokensByPool(positions) {
  if (!positions || !Array.isArray(positions)) return {}
  
  const grouped = {}
  
  positions.forEach((position, positionIndex) => {
    // Cria o nome do pool baseado nos símbolos dos tokens
    let poolKey = 'Unknown Pool'
    
    if (position.tokens && Array.isArray(position.tokens) && position.tokens.length > 0) {
      // Pega os símbolos únicos dos tokens para formar o nome do pool
      const tokenSymbols = position.tokens.map(token => token.symbol).filter(symbol => symbol)
      if (tokenSymbols.length > 0) {
        poolKey = tokenSymbols.join('/')
      }
    }
    
    // Se o poolKey já existe, adiciona um sufixo para diferenciá-lo
    let finalPoolKey = poolKey
    let counter = 1
    while (grouped[finalPoolKey]) {
      finalPoolKey = `${poolKey} (${counter})`
      counter++
    }
    
    grouped[finalPoolKey] = {
      label: finalPoolKey,
      tokens: [...(position.tokens || [])],
      rewards: [...(position.rewards || [])],
      totalValue: 0,
      totalRewards: 0
    }

    // Calcula valores totais
    grouped[finalPoolKey].totalValue = position.tokens?.reduce((sum, token) => sum + (token.totalPrice || 0), 0) || 0
    grouped[finalPoolKey].totalRewards = position.rewards?.reduce((sum, reward) => sum + (reward.totalPrice || 0), 0) || 0
  })
  
  return grouped
}
