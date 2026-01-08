/**
 * Chain mappings and utilities
 * Centralized configuration for blockchain networks
 */

export type ChainKey = 
  | 'eth' 
  | 'ethereum' 
  | 'polygon' 
  | 'bsc' 
  | 'avalanche' 
  | 'optimism' 
  | 'arbitrum'
  | 'fantom' 
  | 'base' 
  | 'cronos'
  | 'xdai'
  | 'solana'
  | 'unknown';

/**
 * Chain ID to standardized chain key mapping
 * Maps both numeric IDs and string names to canonical keys
 */
export const CHAIN_ID_TO_KEY: Record<number, string> = {
  1: 'ethereum',
  56: 'bsc',
  137: 'polygon',
  250: 'fantom',
  43114: 'avalanche',
  42161: 'arbitrum',
  10: 'optimism',
  25: 'cronos',
  100: 'xdai',
  8453: 'base',
  84531: 'base', // Base testnet
};

/**
 * Comprehensive chain mappings including all aliases
 * Maps string names, IDs, and aliases to canonical keys
 */
export const CHAIN_MAPPINGS: Record<string, ChainKey> = {
  // Ethereum
  '1': 'eth',
  'eth': 'eth',
  'ethereum': 'ethereum',
  'mainnet': 'eth',
  'erc20': 'eth',
  
  // Polygon
  '137': 'polygon',
  'polygon': 'polygon',
  'matic': 'polygon',
  
  // Avalanche
  '43114': 'avalanche',
  'avalanche': 'avalanche',
  'avax': 'avalanche',
  
  // Optimism
  '10': 'optimism',
  'optimism': 'optimism',
  'op': 'optimism',
  
  // BSC
  '56': 'bsc',
  'bsc': 'bsc',
  'bnb': 'bsc',
  'binance': 'bsc',
  'binance smart chain': 'bsc',
  'bnb smart chain': 'bsc',
  
  // Fantom
  '250': 'fantom',
  'fantom': 'fantom',
  'ftm': 'fantom',
  
  // Arbitrum
  '42161': 'arbitrum',
  'arbitrum': 'arbitrum',
  'arb': 'arbitrum',
  
  // Base
  '8453': 'base',
  '84531': 'base',
  'base': 'base',
  
  // Cronos
  '25': 'cronos',
  'cronos': 'cronos',
  'cro': 'cronos',
  
  // xDai/Gnosis
  '100': 'xdai',
  'xdai': 'xdai',
  'gnosis': 'xdai',
  
  // Solana
  'solana': 'solana',
  'sol': 'solana',
};

/**
 * Get standardized chain key from various input formats
 * @param input - Chain ID (number or string) or chain name
 * @returns Standardized chain key or 'unknown'
 */
export function getChainKey(input: string | number | null | undefined): ChainKey {
  if (input == null) return 'unknown';
  
  const normalized = String(input).trim().toLowerCase();
  return (CHAIN_MAPPINGS[normalized] as ChainKey) || 'unknown';
}

/**
 * Get chain key from numeric chain ID
 * @param chainId - Numeric chain ID
 * @returns Standardized chain key or 'unknown'
 */
export function getChainKeyFromId(chainId: number): string {
  return CHAIN_ID_TO_KEY[chainId] || 'unknown';
}
