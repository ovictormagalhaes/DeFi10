declare global {
  interface Window {
    rabby?: unknown;
    ethereum?: unknown;
    solana?: { isPhantom?: boolean };
  }
}

export type WalletType = 'evm' | 'solana';

export interface WalletConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  type: WalletType;
  detectFn: () => boolean;
}

export const WALLETS: WalletConfig[] = [
  {
    id: 'rabby',
    name: 'Rabby',
    description: 'Connect with Rabby',
    icon: '\u{1F430}',
    color: '#8697FF',
    type: 'evm',
    detectFn: () => {
      return !!window.rabby;
    },
  },
  {
    id: 'metamask',
    name: 'MetaMask',
    description: 'Connect with MetaMask',
    icon: '\u{1F98A}',
    color: '#F6851B',
    type: 'evm',
    detectFn: () => {
      return !!window.ethereum;
    },
  },
  {
    id: 'phantom',
    name: 'Phantom',
    description: 'Connect with Phantom',
    icon: '\u{1F47B}',
    color: '#AB9FF2',
    type: 'solana',
    detectFn: () => !!(window.solana && window.solana.isPhantom),
  },
];

export function detectAvailableWallets(): Record<string, boolean> {
  const available: Record<string, boolean> = {};
  WALLETS.forEach((wallet) => {
    available[wallet.id] = wallet.detectFn();
  });

  return available;
}

export function getWalletById(walletId: string): WalletConfig | null {
  return WALLETS.find((w) => w.id === walletId) || null;
}

export function hasAnyWallet(): boolean {
  return WALLETS.some((wallet) => wallet.detectFn());
}

export function getWalletNames(): string {
  return WALLETS.map((w) => w.name).join(', ');
}
