// Helper to read env var from either process.env (Node/CRA) or import.meta.env (Vite)
const getEnv = (keys: string[]): string | undefined => {
  for (const k of keys) {
    // @ts-ignore
    if (typeof process !== 'undefined' && process?.env?.[k]) return process.env[k] as string
    try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.[k]) {
        // @ts-ignore
        return (import.meta as any).env[k] as string
      }
    } catch {}
  }
  return undefined
}

const detectEnv = (): string => {
  return (getEnv(['NODE_ENV','VITE_MODE','MODE']) || 'production').toLowerCase()
}

const _env = detectEnv()

// Explicit API base provided?
let explicit = getEnv(['REACT_APP_API_URL','VITE_API_URL'])

// Normalize explicit (remove trailing slashes)
if (explicit) explicit = explicit.replace(/\/+$/,'')

let _normalizedApiBase = ''
if (_env === 'production') {
  if (explicit && !/localhost|127\.0\.0\.1/i.test(explicit)) {
    _normalizedApiBase = explicit
  } else {
    _normalizedApiBase = 'https://defi10-1.onrender.com'
  }
} else {
  _normalizedApiBase = explicit || 'http://localhost:10001'
}

// Safety: strip trailing slashes again
_normalizedApiBase = _normalizedApiBase.replace(/\/+$/,'')

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

// Debug log (only first time) so you can see which base got resolved in production
(() => {
  const flag = '__DEF10_API_LOG__'
  try {
    if (typeof window !== 'undefined') {
      if (!(window as any)[flag]) {
        (window as any)[flag] = true
        ;(window as any).__DEF10_API_BASE__ = _normalizedApiBase
        // eslint-disable-next-line no-console
        console.log(`%c[Defi10] API Base: ${_normalizedApiBase} (env=${_env}) explicit=${explicit||'none'}`,'color:#35f7a5;font-weight:600')
      }
    }
  } catch {}
})()

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