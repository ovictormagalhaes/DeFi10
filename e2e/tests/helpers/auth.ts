import { APIRequestContext } from '@playwright/test';

const API_V1 = '/api/v1';

const TEST_WALLETS = [
  '0xF6998ed7484b4aDB3B5aD636D24CB1c576C12b27',
  '884XrhgNyJFM88AtRpBe1JwycCiWv6PXXhY2bZHWHXQk',
];

export interface WalletGroup {
  id: string;
  wallets: string[];
  displayName: string;
  hasPassword: boolean;
}

export interface ConnectResponse {
  token: string;
  walletGroupId: string;
  expiresAt: string;
  wallets: string[];
  displayName: string;
  hasPassword: boolean;
}

export async function createWalletGroup(
  request: APIRequestContext,
  wallets: string[] = TEST_WALLETS,
  displayName = 'E2E Test Group',
  password?: string,
): Promise<WalletGroup> {
  const body: Record<string, unknown> = { wallets, displayName };
  if (password) body.password = password;

  const res = await request.post(`${API_V1}/wallet-groups`, { data: body });
  const data = await res.json();
  return data;
}

export async function connectWalletGroup(
  request: APIRequestContext,
  walletGroupId: string,
  password?: string,
): Promise<ConnectResponse> {
  const body: Record<string, unknown> = {};
  if (password) body.password = password;

  const res = await request.post(`${API_V1}/wallet-groups/${walletGroupId}/connect`, { data: body });
  const data = await res.json();
  return data;
}

export async function createAuthenticatedWalletGroup(
  request: APIRequestContext,
  password?: string,
): Promise<{ walletGroup: WalletGroup; token: string }> {
  const walletGroup = await createWalletGroup(request, TEST_WALLETS, 'E2E Test Group', password);
  const connectRes = await connectWalletGroup(request, walletGroup.id, password);
  return { walletGroup, token: connectRes.token };
}

export async function deleteWalletGroup(
  request: APIRequestContext,
  walletGroupId: string,
  token: string,
): Promise<void> {
  await request.delete(`${API_V1}/wallet-groups/${walletGroupId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export { TEST_WALLETS, API_V1 };
