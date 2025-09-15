// Environment configuration for Defi10 Frontend
export const config = {
  // API Base URL - will be set by environment variable in production
  API_BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:10001',
  
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
  APP_NAME: process.env.REACT_APP_APP_NAME || 'Defi10',
  VERSION: '1.0.0'
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