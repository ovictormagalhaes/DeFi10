import { test, expect } from '@playwright/test';
import {
  API_V1,
  TEST_WALLETS,
  createWalletGroup,
  connectWalletGroup,
  createAuthenticatedWalletGroup,
  deleteWalletGroup,
} from './helpers/auth';

test.describe('Wallet Groups', () => {
  let createdIds: { id: string; token: string }[] = [];

  test.afterEach(async ({ request }) => {
    for (const { id, token } of createdIds) {
      await deleteWalletGroup(request, id, token).catch(() => {});
    }
    createdIds = [];
  });

  test.describe('POST /wallet-groups - Create', () => {
    test('should create a wallet group', async ({ request }) => {
      const res = await request.post(`${API_V1}/wallet-groups`, {
        data: { wallets: TEST_WALLETS, displayName: 'E2E Create Test' },
      });

      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.wallets).toEqual(expect.arrayContaining(TEST_WALLETS));
      expect(body.displayName).toBe('E2E Create Test');

      const conn = await connectWalletGroup(request, body.id);
      createdIds.push({ id: body.id, token: conn.token });
    });

    test('should reject empty wallets array', async ({ request }) => {
      const res = await request.post(`${API_V1}/wallet-groups`, {
        data: { wallets: [], displayName: 'Empty' },
      });

      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    });
  });

  test.describe('POST /wallet-groups/:id/connect - Authentication', () => {
    test('should return JWT token on connect', async ({ request }) => {
      const group = await createWalletGroup(request);
      const res = await request.post(`${API_V1}/wallet-groups/${group.id}/connect`, {
        data: {},
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(typeof body.token).toBe('string');
      expect(body.walletGroupId).toBe(group.id);
      expect(body.expiresAt).toBeDefined();

      createdIds.push({ id: group.id, token: body.token });
    });

    test('should return 404 for non-existent wallet group', async ({ request }) => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request.post(`${API_V1}/wallet-groups/${fakeId}/connect`, {
        data: {},
      });

      expect(res.status()).toBe(404);
    });
  });

  test.describe('GET /wallet-groups/:id - Protected', () => {
    test('should return 401 without token', async ({ request }) => {
      const group = await createWalletGroup(request);
      const conn = await connectWalletGroup(request, group.id);
      createdIds.push({ id: group.id, token: conn.token });

      const res = await request.get(`${API_V1}/wallet-groups/${group.id}`);
      expect(res.status()).toBe(401);
    });

    test('should return 401 with invalid token', async ({ request }) => {
      const group = await createWalletGroup(request);
      const conn = await connectWalletGroup(request, group.id);
      createdIds.push({ id: group.id, token: conn.token });

      const res = await request.get(`${API_V1}/wallet-groups/${group.id}`, {
        headers: { Authorization: 'Bearer invalid.token.here' },
      });
      expect(res.status()).toBe(401);
    });

    test('should return wallet group with valid token', async ({ request }) => {
      const { walletGroup, token } = await createAuthenticatedWalletGroup(request);
      createdIds.push({ id: walletGroup.id, token });

      const res = await request.get(`${API_V1}/wallet-groups/${walletGroup.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(walletGroup.id);
      expect(body.wallets).toEqual(expect.arrayContaining(TEST_WALLETS));
    });
  });

  test.describe('DELETE /wallet-groups/:id - Protected', () => {
    test('should return 401 without token', async ({ request }) => {
      const { walletGroup, token } = await createAuthenticatedWalletGroup(request);
      createdIds.push({ id: walletGroup.id, token });

      const res = await request.delete(`${API_V1}/wallet-groups/${walletGroup.id}`);
      expect(res.status()).toBe(401);
    });

    test('should delete wallet group with valid token', async ({ request }) => {
      const { walletGroup, token } = await createAuthenticatedWalletGroup(request);

      const res = await request.delete(`${API_V1}/wallet-groups/${walletGroup.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(204);
    });
  });
});
