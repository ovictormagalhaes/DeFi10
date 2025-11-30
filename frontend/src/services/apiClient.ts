import axios from 'axios';

import { api } from '../config/api';
import { HealthStatus, SupportedChain } from '../types/api';
import type { 
  WalletGroup, 
  CreateWalletGroupRequest, 
  UpdateWalletGroupRequest 
} from '../types/wallet-groups';

// Generic GET helper with simple error normalization
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

// Wallet Groups API
export async function createWalletGroup(data: CreateWalletGroupRequest): Promise<WalletGroup> {
  const res = await axios.post(api.createWalletGroup(), data);
  return res.data;
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
}

// getWallet removed (replaced by aggregation workflow)

