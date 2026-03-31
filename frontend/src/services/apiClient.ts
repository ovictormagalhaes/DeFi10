import axios from 'axios';

import { api } from '../config/api';
import { HealthStatus, SupportedChain } from '../types/api';
import type {
  WalletGroup,
  CreateWalletGroupRequest,
  UpdateWalletGroupRequest,
  ConnectWalletGroupResponse,
  ConnectWalletGroupRequest,
} from '../types/wallet-groups';
import type { 
  Strategy, 
  SaveStrategyRequest, 
  SaveStrategyResponse,
  SaveStrategiesRequest,
  SaveStrategiesResponse,
  StrategyData
} from '../types/strategy';
import type { Challenge } from './proofOfWork';
import { solveChallenge } from './proofOfWork';

const TOKEN_STORAGE_KEY = 'defi10_wallet_group_tokens';

interface StoredToken {
  walletGroupId: string;
  token: string;
  expiresAt: string;
}

function getStoredTokens(): StoredToken[] {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function getToken(walletGroupId: string): string | null {
  const tokens = getStoredTokens();
  const tokenData = tokens.find(t => t.walletGroupId === walletGroupId);
  
  if (!tokenData) return null;
  
  const expiresAt = new Date(tokenData.expiresAt);
  if (expiresAt <= new Date()) {
    removeToken(walletGroupId);
    return null;
  }
  
  return tokenData.token;
}

function storeToken(walletGroupId: string, token: string, expiresAt: string): void {
  const tokens = getStoredTokens();
  const filtered = tokens.filter(t => t.walletGroupId !== walletGroupId);
  filtered.push({ walletGroupId, token, expiresAt });
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(filtered));
}

function removeToken(walletGroupId: string): void {
  const tokens = getStoredTokens();
  const filtered = tokens.filter(t => t.walletGroupId !== walletGroupId);
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(filtered));
}

type TokenExpiredListener = (walletGroupId: string) => void;
const tokenExpiredListeners: TokenExpiredListener[] = [];

export function onTokenExpired(callback: TokenExpiredListener): () => void {
  tokenExpiredListeners.push(callback);
  return () => {
    const index = tokenExpiredListeners.indexOf(callback);
    if (index > -1) {
      tokenExpiredListeners.splice(index, 1);
    }
  };
}

function notifyTokenExpired(walletGroupId: string): void {
  tokenExpiredListeners.forEach(listener => {
    try {
      listener(walletGroupId);
    } catch (err) {
      console.error('[apiClient] Error in token expired listener:', err);
    }
  });
}

export { getToken, storeToken, removeToken, notifyTokenExpired };

axios.interceptors.request.use((config) => {
  // Match wallet-groups routes: /wallet-groups/{id}
  let match = config.url?.match(/\/wallet-groups\/([^\/]+)/);
  if (match && match[1] && match[1] !== 'challenge') {
    const walletGroupId = decodeURIComponent(match[1]);
    const token = getToken(walletGroupId);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  
  // Match strategies routes: /strategies/{walletGroupId} or /strategies (with walletGroupId in body)
  if (!match) {
    match = config.url?.match(/\/strategies\/([^\/]+)/);
    if (match && match[1] && match[1] !== 'save') {
      const walletGroupId = decodeURIComponent(match[1]);
      const token = getToken(walletGroupId);
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } else if (config.url?.includes('/strategies') && config.method === 'post' && config.data) {
      // For POST /strategies with walletGroupId in body
      try {
        const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
        if (body.walletGroupId) {
          const token = getToken(body.walletGroupId);
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  }
  
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check wallet-groups routes
      let match = error.config?.url?.match(/\/wallet-groups\/([^\/]+)/);
      if (match && match[1] && match[1] !== 'challenge' && match[1] !== 'connect') {
        const walletGroupId = decodeURIComponent(match[1]);
        removeToken(walletGroupId);
        notifyTokenExpired(walletGroupId);
      }
      
      // Check strategies routes
      if (!match) {
        match = error.config?.url?.match(/\/strategies\/([^\/]+)/);
        if (match && match[1] && match[1] !== 'save') {
          const walletGroupId = decodeURIComponent(match[1]);
          removeToken(walletGroupId);
          notifyTokenExpired(walletGroupId);
        }
      }
      
      // Check POST body for walletGroupId
      if (error.config?.data && error.config.method === 'post') {
        try {
          const body = JSON.parse(error.config.data);
          if (body.walletGroupId) {
            removeToken(body.walletGroupId);
            notifyTokenExpired(body.walletGroupId);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
    
    return Promise.reject(error);
  }
);

async function getJSON<T>(url: string): Promise<T> {
  const res = await axios.get(url);
  return res.data as T;
}

export async function getHealth(): Promise<HealthStatus> {
  return getJSON<HealthStatus>(api.health());
}

export async function getSupportedChains(): Promise<SupportedChain[]> {
  const data = await getJSON<{ chains?: SupportedChain[] }>(api.getSupportedChains());
  return data.chains || [];
}

export async function getChallenge(): Promise<Challenge> {
  const res = await axios.get(api.getChallenge());
  return res.data;
}

export async function createWalletGroup(data: CreateWalletGroupRequest): Promise<WalletGroup> {
  const res = await axios.post(api.createWalletGroup(), data);
  const walletGroup = res.data;
  
  if (data.password) {
    try {
      await connectWalletGroup(walletGroup.id, { password: data.password });
    } catch {
      // Silently handle auto-connect failure
    }
  } else {
    try {
      await connectWalletGroup(walletGroup.id, {});
    } catch {
      // Silently handle auto-connect failure
    }
  }
  
  return walletGroup;
}

// REMOVED: checkWalletGroup - endpoint /check does not exist in backend
// export async function checkWalletGroup(
//   id: string
// ): Promise<{ requiresPassword: boolean }> {
//   const res = await axios.get(api.checkWalletGroup(id));
//   return res.data;
// }

export async function connectWalletGroup(
  id: string,
  data: ConnectWalletGroupRequest
): Promise<ConnectWalletGroupResponse> {
  const res = await axios.post(api.connectWalletGroup(id), data);
  const response: ConnectWalletGroupResponse = res.data;
  
  storeToken(response.walletGroupId, response.token, response.expiresAt);
  
  return response;
}

export async function getWalletGroup(id: string): Promise<WalletGroup> {
  const res = await axios.get(api.getWalletGroup(id));
  return res.data;
}

export async function updateWalletGroup(
  id: string,
  data: UpdateWalletGroupRequest
): Promise<WalletGroup> {
  const res = await axios.put(api.updateWalletGroup(id), data);
  return res.data;
}

export async function deleteWalletGroup(id: string): Promise<void> {
  await axios.delete(api.deleteWalletGroup(id));
  removeToken(id);
}

/**
 * Create or update a strategy for a wallet group (legacy format)
 */
export async function saveStrategy(data: SaveStrategyRequest): Promise<SaveStrategyResponse> {
  const res = await axios.post(api.saveStrategy(), data);
  return res.data;
}

/**
 * Create or update multiple strategies for a wallet group (new format)
 */
export async function saveStrategies(data: SaveStrategiesRequest): Promise<SaveStrategiesResponse> {
  const res = await axios.post(api.saveStrategy(), data);
  return res.data;
}

/**
 * Get strategy for a wallet group (returns new format with array of strategies)
 */
export async function getStrategyByGroup(walletGroupId: string): Promise<SaveStrategiesResponse | null> {
  try {
    const res = await axios.get(api.getStrategiesByGroup(walletGroupId));
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export function hasValidToken(walletGroupId: string): boolean {
  return getToken(walletGroupId) !== null;
}

export async function authenticateWallet(
  walletGroupId: string,
  onProgress?: (nonce: number) => void
): Promise<void> {
  const challenge = await getChallenge();
  const result = await solveChallenge(
    challenge.challenge,
    challenge.difficulty,
    onProgress ? (nonce) => onProgress(nonce) : undefined
  );
  await connectWalletGroup(walletGroupId, {
    challenge: challenge.challenge,
    nonce: result.nonce,
    hash: result.hash,
  });
}
