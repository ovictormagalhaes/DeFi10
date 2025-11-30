/**
 * Types and utilities for Wallet Groups
 * Backend limits groups to max 3 wallets and prevents mixing EVM/Solana
 */

export interface WalletGroup {
  id: string; // GUID from backend
  wallets: string[]; // Max 3 addresses
  displayName?: string;
  createdAt: string; // ISO timestamp
}

export interface CreateWalletGroupRequest {
  wallets: string[];
  displayName?: string;
}

export interface UpdateWalletGroupRequest {
  wallets: string[];
  displayName?: string;
}

export interface WalletGroupResponse {
  id: string;
  wallets: string[];
  displayName?: string;
  createdAt: string;
}

// Validation helpers
export const isEVMAddress = (addr: string): boolean => 
  /^0x[a-fA-F0-9]{40}$/.test(addr);

export const isSolanaAddress = (addr: string): boolean => 
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);

export const getAddressType = (addr: string): 'EVM' | 'Solana' | 'Unknown' => {
  if (isEVMAddress(addr)) return 'EVM';
  if (isSolanaAddress(addr)) return 'Solana';
  return 'Unknown';
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const validateWalletGroup = (wallets: string[]): ValidationResult => {
  if (wallets.length === 0) {
    return { valid: false, error: 'At least 1 wallet required' };
  }
  
  if (wallets.length > 3) {
    return { valid: false, error: 'Maximum 3 wallets allowed' };
  }
  
  const types = wallets.map(getAddressType);
  
  // Check for invalid addresses
  if (types.includes('Unknown')) {
    return { valid: false, error: 'Invalid wallet address format' };
  }
  
  // Check for duplicates (case-insensitive for EVM, case-sensitive for Solana)
  const normalized = wallets.map(w => 
    isEVMAddress(w) ? w.toLowerCase() : w
  );
  const uniqueSet = new Set(normalized);
  
  if (uniqueSet.size !== wallets.length) {
    return { valid: false, error: 'Duplicate wallet addresses detected' };
  }
  
  return { valid: true };
};

export const validateSingleAddress = (addr: string): ValidationResult => {
  if (!addr || addr.trim().length === 0) {
    return { valid: false, error: 'Address is required' };
  }
  
  const type = getAddressType(addr.trim());
  
  if (type === 'Unknown') {
    return { valid: false, error: 'Invalid address format (expected EVM 0x... or Solana Base58)' };
  }
  
  return { valid: true };
};

// Helper to format address for display
export const formatAddress = (addr: string, length: number = 6): string => {
  if (!addr || addr.length < length * 2) return addr;
  return `${addr.slice(0, length)}...${addr.slice(-length)}`;
};
