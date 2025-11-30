// Helper to read env var from either process.env (Node/CRA) or import.meta.env (Vite)
// Uses defensive narrowing without @ts-ignore.
const getEnv = (keys: string[]): string | undefined => {
  for (const k of keys) {
    // Node / traditional environment vars
    if (typeof process !== 'undefined' && typeof process.env === 'object') {
      const val = (process.env as Record<string, string | undefined>)[k];
      if (val) return val;
    }
    // Vite style import.meta.env
    try {
      // import.meta is only defined in ESM / browser bundlers; we guard access
      const meta: unknown = import.meta as unknown;
      if (meta && typeof meta === 'object' && 'env' in meta) {
        const envObj = (meta as { env?: Record<string, unknown> }).env;
        if (envObj) {
          const possible = envObj[k];
          if (typeof possible === 'string' && possible) return possible;
        }
      }
    } catch (err) {
      // Swallow because some environments (SSR build tools) throw on import.meta access
      // eslint-disable-next-line no-empty
    }
  }
  return undefined;
};

const detectEnv = (): string => {
  // Prefer explicit VITE_FORCE_DEV to allow overriding when build tools mis-set NODE_ENV
  const forceDev = getEnv(['VITE_FORCE_DEV']);
  if (forceDev === '1' || forceDev === 'true') return 'development';

  // Vite exposes boolean flags
  try {
    const meta: any = import.meta as any;
    if (meta && meta.env) {
      if (meta.env.DEV) return 'development';
      if (meta.env.PROD) return 'production';
      if (typeof meta.env.MODE === 'string') return meta.env.MODE.toLowerCase();
    }
  } catch {
    // ignore
  }
  // Heuristic: if running in browser on localhost treat as development
  try {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (/^(localhost|127\.0\.0\.1)$/.test(host)) return 'development';
    }
  } catch { /* ignore */ }
  return (getEnv(['NODE_ENV', 'VITE_MODE', 'MODE']) || 'production').toLowerCase();
};

const _env = detectEnv();

// Explicit API base provided? Prefer the new VITE_API_BASE_URL (documented) then legacy names.
let explicit = getEnv(['VITE_API_BASE_URL', 'REACT_APP_API_URL', 'VITE_API_URL']);
let __source = 'none';
if (explicit) __source = 'env';

// Allow last‑ditch runtime override via a global window.__API_BASE__ (helpful when serving a static bundle in different envs)
try {
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    if (typeof w.__API_BASE__ === 'string' && (w.__API_BASE__ as string).length > 0) {
      explicit = w.__API_BASE__ as string;
      __source = 'window.__API_BASE__';
    }
  }
} catch {
  // ignore
}

// Normalize explicit (remove trailing slashes)
if (explicit) explicit = explicit.replace(/\/+$/, '');

let _normalizedApiBase = '';
if (_env === 'production') {
  // In production: require explicit or fall back to hosted default
  if (explicit && !/localhost|127\.0\.0\.1/i.test(explicit)) {
    _normalizedApiBase = explicit;
  } else {
    _normalizedApiBase = 'https://defi10-1.onrender.com';
    if (!explicit) __source = 'default:render-prod';
  }
} else {
  // In development default to backend .NET API launchSettings (10000) if not provided
  if (explicit) {
    _normalizedApiBase = explicit;
  } else {
    _normalizedApiBase = 'http://localhost:10000';
    __source = 'default:dev-10000';
  }
}

// Safety: strip trailing slashes again
_normalizedApiBase = _normalizedApiBase.replace(/\/+$/, '');

export const config = {
  // API Base URL - tries multiple prefixes, defaults to local dev port 10001 (normalized without trailing slash)
  API_BASE_URL: _normalizedApiBase,

  // API Endpoints
  API_ENDPOINTS: {
    HEALTH: '/health',
    WALLETS: '/api/v1/wallets',
    TOKENS: '/api/v1/tokens',
    CACHE: '/api/v1/cache',
    SUPPORTED_CHAINS: '/api/v1/wallets/supported-chains',
    REBALANCES: '/api/v1/rebalances',
    AGGREGATIONS: '/api/v1/aggregations',
    WALLET_GROUPS: '/api/v1/wallet-groups',
  },

  // Default configuration
  DEFAULT_CHAIN: 'Base',
  SUPPORTED_CHAINS: ['Base', 'BNB'],

  // UI Configuration (simplified)
  APP_NAME: 'Defi10',
  VERSION: '1.0.0',
  ENVIRONMENT: _env,
};

// Debug log (only first time) so you can see which base got resolved in production
(() => {
  const flag = '__DEF10_API_LOG__';
  try {
    if (typeof window !== 'undefined') {
      const w = window as unknown as Record<string, unknown>;
      if (!w[flag]) {
        w[flag] = true;
        w.__DEF10_API_BASE__ = _normalizedApiBase;
        // eslint-disable-next-line no-console
        console.log(
          `%c[Defi10] API Base: ${_normalizedApiBase} (env=${_env}) source=${__source} explicit=${explicit || 'none'}`,
          'color:#35f7a5;font-weight:600'
        );
        // Additional one-time debug of visible env keys (sanitized to strings/primitives)
        try {
          const meta: any = import.meta as any;
            if (meta && meta.env) {
              const printable: Record<string, unknown> = {};
              Object.keys(meta.env).forEach(k => {
                const v = (meta.env as any)[k];
                if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                  printable[k] = v;
                }
              });
              // eslint-disable-next-line no-console
              console.log('[Defi10] import.meta.env keys:', printable);
            }
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    // Non-critical logging failure; ignore.
    // eslint-disable-next-line no-empty
  }
})();

// API Helper functions
export const api = {
  baseURL: config.API_BASE_URL,

  // Health check
  health: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.HEALTH}`,

  // (Deprecated) getWallet endpoint removed in favor of aggregation jobs.
  // getWallet: (address: string, chains?: string[]) => { /* removed */ },

  // Token endpoints
  getTokenLogo: (address: string, chain: string = 'Base') =>
    `${config.API_BASE_URL}${config.API_ENDPOINTS.TOKENS}/${address}/logo?chain=${chain}`,

  getTokenStats: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.TOKENS}/stats`,

  // Supported chains
  getSupportedChains: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.SUPPORTED_CHAINS}`,

  // Rebalances
  getRebalances: (accountId: string) =>
    `${config.API_BASE_URL}${config.API_ENDPOINTS.REBALANCES}/${accountId}`,

  // Wallet Groups CRUD
  createWalletGroup: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.WALLET_GROUPS}`,
  getWalletGroup: (id: string) => 
    `${config.API_BASE_URL}${config.API_ENDPOINTS.WALLET_GROUPS}/${encodeURIComponent(id)}`,
  updateWalletGroup: (id: string) => 
    `${config.API_BASE_URL}${config.API_ENDPOINTS.WALLET_GROUPS}/${encodeURIComponent(id)}`,
  deleteWalletGroup: (id: string) => 
    `${config.API_BASE_URL}${config.API_ENDPOINTS.WALLET_GROUPS}/${encodeURIComponent(id)}`,

  // Aggregation jobs (pluralized backend: /api/v1/aggregations)
  // Contrato atual: POST /api/v1/aggregations  body: { account, chains? }
  startAggregation: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.AGGREGATIONS}`,
  buildStartAggregationBody: (account: string, chains?: string[] | string) => {
    const body: any = { account };
    if (chains) body.chains = Array.isArray(chains) ? chains : [chains];
    return JSON.stringify(body);
  },
  // V2: Multi-wallet support with walletGroupId
  buildStartAggregationBodyV2: (options: {
    account?: string;
    walletGroupId?: string;
    chains?: string[] | string;
  }) => {
    const body: any = {};
    if (options.account) body.account = options.account;
    if (options.walletGroupId) body.walletGroupId = options.walletGroupId;
    if (options.chains) {
      body.chains = Array.isArray(options.chains) ? options.chains : [options.chains];
    }
    return JSON.stringify(body);
  },
  // Helper: escolher jobId da lista retornada (prioriza Base, depois BNB, depois primeiro)
  pickAggregationJob: (jobs: any[]) => {
    if (!Array.isArray(jobs) || !jobs.length) return null;
    const prefs = ['Base', 'BASE', 'base', 'Bnb', 'BNB', 'bnb'];
    for (const p of prefs) {
      const found = jobs.find(j => (j.chain || '').toString().toLowerCase() === p.toString().toLowerCase());
      if (found) return found.jobId || found.jobID || found.id || null;
    }
    const first = jobs[0];
    return first.jobId || first.jobID || first.id || null;
  },
  getAggregation: (jobId: string) =>
    `${config.API_BASE_URL}${config.API_ENDPOINTS.AGGREGATIONS}/${encodeURIComponent(jobId)}`,
};

export default config;
