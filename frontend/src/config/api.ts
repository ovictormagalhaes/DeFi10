// Configuração simples: se NODE_ENV === 'production' usa rota de produção, senão localhost.
// Mantemos compatibilidade lendo tanto process.env quanto import.meta.env.
const detectEnv = () => {
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) return process.env.NODE_ENV
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE) {
      // @ts-ignore
      return (import.meta as any).env.MODE
    }
  } catch {}
  return 'production'
}

const _env = (detectEnv() || 'production').toLowerCase()
const _normalizedApiBase = (_env === 'production'
  ? 'https://defi10-api.onrender.com'
  : 'http://localhost:10001').replace(/\/+$/,'')

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
  
  // UI Configuration (simplified)
  APP_NAME: 'Defi10',
  VERSION: '1.0.0',
  ENVIRONMENT: _env
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