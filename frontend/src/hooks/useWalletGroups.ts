import { useState, useCallback, useEffect } from 'react';
import type { 
  WalletGroup, 
  CreateWalletGroupRequest, 
  ValidationResult 
} from '../types/wallet-groups';
import { validateWalletGroup } from '../types/wallet-groups';
import * as apiClient from '../services/apiClient';

const STORAGE_KEY = 'defi10_wallet_groups';

export function useWalletGroups() {
  const [groups, setGroups] = useState<WalletGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setGroups(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Failed to load wallet groups from localStorage', e);
      }
    }
  }, []);

  // Persist to localStorage
  const persist = useCallback((updatedGroups: WalletGroup[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedGroups));
      setGroups(updatedGroups);
    } catch (e) {
      console.error('Failed to persist wallet groups', e);
    }
  }, []);

  const createGroup = useCallback(async (data: CreateWalletGroupRequest): Promise<WalletGroup | null> => {
    const validation = validateWalletGroup(data.wallets);
    if (!validation.valid) {
      setError(validation.error || 'Invalid wallet group');
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const newGroup = await apiClient.createWalletGroup(data);
      const updated = [...groups, newGroup];
      persist(updated);
      return newGroup;
    } catch (e: any) {
      const msg = e.response?.data?.error || e.response?.data?.title || e.message || 'Failed to create wallet group';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [groups, persist]);

  const updateGroup = useCallback(async (
    id: string, 
    data: CreateWalletGroupRequest
  ): Promise<WalletGroup | null> => {
    const validation = validateWalletGroup(data.wallets);
    if (!validation.valid) {
      setError(validation.error || 'Invalid wallet group');
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const updated = await apiClient.updateWalletGroup(id, data);
      const newGroups = groups.map(g => g.id === id ? updated : g);
      persist(newGroups);
      return updated;
    } catch (e: any) {
      const msg = e.response?.data?.error || e.response?.data?.title || e.message || 'Failed to update wallet group';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [groups, persist]);

  const deleteGroup = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.deleteWalletGroup(id);
      const updated = groups.filter(g => g.id !== id);
      persist(updated);
      return true;
    } catch (e: any) {
      const msg = e.response?.data?.error || e.response?.data?.title || e.message || 'Failed to delete wallet group';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [groups, persist]);

  const getGroup = useCallback((id: string): WalletGroup | null => {
    return groups.find(g => g.id === id) || null;
  }, [groups]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    groups,
    loading,
    error,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroup,
    clearError,
  };
}
