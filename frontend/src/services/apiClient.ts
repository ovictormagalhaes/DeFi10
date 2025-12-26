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
import type { Challenge } from './proofOfWork';

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
  const match = config.url?.match(/\/wallet-groups\/([^\/]+)/);
  if (match && match[1] && match[1] !== 'challenge') {
    const walletGroupId = decodeURIComponent(match[1]);
    const token = getToken(walletGroupId);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const match = error.config?.url?.match(/\/wallet-groups\/([^\/]+)/);
      if (match && match[1] && match[1] !== 'challenge' && match[1] !== 'connect') {
        const walletGroupId = decodeURIComponent(match[1]);
        removeToken(walletGroupId);
        notifyTokenExpired(walletGroupId);
      }
      
      if (error.config?.data && error.config.method === 'post') {
        try {
          const body = JSON.parse(error.config.data);
          if (body.walletGroupId) {
            removeToken(body.walletGroupId);
            notifyTokenExpired(body.walletGroupId);
          }
        } catch {
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

export async function checkWalletGroup(
  id: string
): Promise<{ requiresPassword: boolean }> {
  const res = await axios.get(api.checkWalletGroup(id));
  return res.data;
}

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
