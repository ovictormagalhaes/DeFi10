// Environment configuration for Defi10 Frontend
// Helper to safely read env vars across build systems (CRA style REACT_APP_*, Vite style import.meta.env.VITE_*)
// At runtime after build only the inlined values remain.
const readEnv = (keys: string[], fallback?: string) => {
  for (const k of keys) {
    // CRA / Node style
    // @ts-ignore
    if (typeof process !== 'undefined' && process?.env?.[k]) return process.env[k] as string
    // Vite style (import.meta.env) - optional chaining to avoid runtime errors in other bundlers
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.[k]) {
        // @ts-ignore
        return (import.meta as any).env[k] as string
      }
    } catch {}
  }
  return fallback
}

// Normalize base URL (remove trailing slashes)
const _rawApiBase = readEnv(['REACT_APP_API_URL','VITE_API_URL'], 'http://localhost:10001') || 'http://localhost:10001'
const _normalizedApiBase = _rawApiBase.replace(/\/+$/,'')

export const config = {
  // API Base URL - tries multiple prefixes, defaults to local dev port 10001 (normalized without trailing slash)
  API_BASE_URL: _normalizedApiBase,
  
  // API Endpoints
  API_ENDPOINTS: {
    HEALTH: '/health',
    WALLETS: '/api/v1/wallets',
    TOKENS: '/api/v1/tokens',
    CACHE: '/api/v1/cache',
    SUPPORTED_CHAINS: '/api/v1/wallets/supported-chains'
  },
  
  // Default configuration
  DEFAULT_CHAIN: 'Base',
  SUPPORTED_CHAINS: ['Base', 'BNB'],
  
  // UI Configuration
  APP_NAME: readEnv(['REACT_APP_APP_NAME','VITE_APP_NAME'], 'Defi10'),
  VERSION: '1.0.0',
  ENVIRONMENT: readEnv(['NODE_ENV','VITE_MODE','MODE'], 'production')
};

// API Helper functions
export const api = {
  baseURL: config.API_BASE_URL,
  
  // Health check
  health: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.HEALTH}`,
  
  // Wallet endpoints
  getWallet: (address: string, chains?: string[]) => {
    const baseUrl = `${config.API_BASE_URL}${config.API_ENDPOINTS.WALLETS}/accounts/${address}`;
    if (chains && chains.length > 0) {
      return `${baseUrl}?chains=${chains.join(',')}`;
    }
    return baseUrl;
  },
  
  // Token endpoints
  getTokenLogo: (address: string, chain: string = 'Base') => 
    `${config.API_BASE_URL}${config.API_ENDPOINTS.TOKENS}/${address}/logo?chain=${chain}`,
  
  getTokenStats: () => 
    `${config.API_BASE_URL}${config.API_ENDPOINTS.TOKENS}/stats`,
  
  // Supported chains
  getSupportedChains: () => 
    `${config.API_BASE_URL}${config.API_ENDPOINTS.SUPPORTED_CHAINS}`
};

export default config;