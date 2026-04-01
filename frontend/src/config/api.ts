const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:10000').replace(
  /\/+$/,
  '',
);

export const config = {
  API_BASE_URL,

  API_ENDPOINTS: {
    HEALTH: '/health',
    WALLETS: '/api/v1/wallets',
    TOKENS: '/api/v1/tokens',
    CACHE: '/api/v1/cache',
    SUPPORTED_CHAINS: '/api/v1/wallets/supported-chains',
    STRATEGIES: '/api/v1/strategies',
    AGGREGATIONS: '/api/v1/aggregations',
    WALLET_GROUPS: '/api/v1/wallet-groups',
    PROTOCOLS_STATUS: '/api/v1/protocols/status',
  },

  DEFAULT_CHAIN: 'Base',
  SUPPORTED_CHAINS: ['Base', 'BNB'],

  APP_NAME: 'Defi10',
  VERSION: '1.0.0',
};

export const api = {
  baseURL: config.API_BASE_URL,

  health: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.HEALTH}`,

  getTokenLogo: (address: string, chain: string = 'Base') =>
    `${config.API_BASE_URL}${config.API_ENDPOINTS.TOKENS}/${address}/logo?chain=${chain}`,

  getTokenStats: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.TOKENS}/stats`,

  getSupportedChains: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.SUPPORTED_CHAINS}`,

  getStrategies: (accountId: string) =>
    `${config.API_BASE_URL}${config.API_ENDPOINTS.STRATEGIES}/${accountId}`,
  getStrategiesByGroup: (walletGroupId: string) =>
    `${config.API_BASE_URL}${config.API_ENDPOINTS.STRATEGIES}/${walletGroupId}`,
  saveStrategy: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.STRATEGIES}`,

  getRebalances: (accountId: string) =>
    `${config.API_BASE_URL}${config.API_ENDPOINTS.STRATEGIES}/${accountId}`,
  getRebalancesByGroup: (walletGroupId: string) =>
    `${config.API_BASE_URL}${config.API_ENDPOINTS.STRATEGIES}/${walletGroupId}`,

  getChallenge: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.WALLET_GROUPS}/challenge`,
  createWalletGroup: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.WALLET_GROUPS}`,
  connectWalletGroup: (id: string) =>
    `${config.API_BASE_URL}${config.API_ENDPOINTS.WALLET_GROUPS}/${encodeURIComponent(id)}/connect`,
  getWalletGroup: (id: string) =>
    `${config.API_BASE_URL}${config.API_ENDPOINTS.WALLET_GROUPS}/${encodeURIComponent(id)}`,
  updateWalletGroup: (id: string) =>
    `${config.API_BASE_URL}${config.API_ENDPOINTS.WALLET_GROUPS}/${encodeURIComponent(id)}`,
  deleteWalletGroup: (id: string) =>
    `${config.API_BASE_URL}${config.API_ENDPOINTS.WALLET_GROUPS}/${encodeURIComponent(id)}`,

  startAggregation: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.AGGREGATIONS}`,
  buildStartAggregationBody: (account: string, chains?: string[] | string) => {
    const body: Record<string, unknown> = { account };
    if (chains) body.chains = Array.isArray(chains) ? chains : [chains];
    return JSON.stringify(body);
  },
  buildStartAggregationBodyV2: (options: {
    account?: string;
    walletGroupId?: string;
    chains?: string[] | string;
  }) => {
    const body: Record<string, unknown> = {};
    if (options.account) body.account = options.account;
    if (options.walletGroupId) body.walletGroupId = options.walletGroupId;
    if (options.chains) {
      body.chains = Array.isArray(options.chains) ? options.chains : [options.chains];
    }
    return JSON.stringify(body);
  },
  pickAggregationJob: (jobs: Record<string, unknown>[]) => {
    if (!Array.isArray(jobs) || !jobs.length) return null;
    const prefs = ['base', 'bnb'];
    for (const p of prefs) {
      const found = jobs.find(
        (j) => String(j.chain || '').toLowerCase() === p,
      );
      if (found) return found.jobId || found.jobID || found.id || null;
    }
    const first = jobs[0];
    return first.jobId || first.jobID || first.id || null;
  },
  getAggregation: (jobId: string) =>
    `${config.API_BASE_URL}${config.API_ENDPOINTS.AGGREGATIONS}/${encodeURIComponent(jobId)}`,

  getProtocolsStatus: () => `${config.API_BASE_URL}${config.API_ENDPOINTS.PROTOCOLS_STATUS}`,
};

export default config;
