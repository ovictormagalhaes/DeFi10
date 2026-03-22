import { test, expect } from '@playwright/test';
import {
  API_V1,
  createAuthenticatedWalletGroup,
  deleteWalletGroup,
} from './helpers/auth';

const buildStrategy = () => ({
  strategyType: 1,
  name: 'E2E Test Strategy',
  description: 'Created by Playwright e2e test',
  allocations: [
    {
      assetKey: 'aave-base-weth',
      protocol: { id: 'aave', name: 'Aave' },
      chain: { id: 'base', name: 'Base' },
      token: { symbol: 'WETH', name: 'Wrapped Ether', address: '0x4200000000000000000000000000000000000006' },
      group: 'lending',
      groupType: 1,
      targetWeight: 50,
      positionType: 1,
    },
    {
      assetKey: 'aave-base-usdc',
      protocol: { id: 'aave', name: 'Aave' },
      chain: { id: 'base', name: 'Base' },
      token: { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
      group: 'lending',
      groupType: 1,
      targetWeight: 50,
      positionType: 1,
    },
  ],
});

test.describe('Strategies', () => {
  let walletGroupId: string;
  let token: string;

  test.beforeAll(async ({ request }) => {
    const result = await createAuthenticatedWalletGroup(request);
    walletGroupId = result.walletGroup.id;
    token = result.token;
  });

  test.afterAll(async ({ request }) => {
    await deleteWalletGroup(request, walletGroupId, token).catch(() => {});
  });

  test.describe('Authentication Required', () => {
    test('POST /strategies should return 401 without token', async ({ request }) => {
      const res = await request.post(`${API_V1}/strategies`, {
        data: {
          walletGroupId,
          strategies: [buildStrategy()],
        },
      });

      expect(res.status()).toBe(401);
    });

    test('GET /strategies/:walletGroupId should return 401 without token', async ({ request }) => {
      const res = await request.get(`${API_V1}/strategies/${walletGroupId}`);
      expect(res.status()).toBe(401);
    });

    test('POST /strategies should return 401 with invalid token', async ({ request }) => {
      const res = await request.post(`${API_V1}/strategies`, {
        data: {
          walletGroupId,
          strategies: [buildStrategy()],
        },
        headers: { Authorization: 'Bearer invalid.token.here' },
      });

      expect(res.status()).toBe(401);
    });

    test('GET /strategies/:walletGroupId should return 401 with invalid token', async ({ request }) => {
      const res = await request.get(`${API_V1}/strategies/${walletGroupId}`, {
        headers: { Authorization: 'Bearer invalid.token.here' },
      });

      expect(res.status()).toBe(401);
    });
  });

  test.describe('POST /strategies - Save', () => {
    test('should save strategies with valid token', async ({ request }) => {
      const res = await request.post(`${API_V1}/strategies`, {
        data: {
          walletGroupId,
          strategies: [buildStrategy()],
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.strategiesCount).toBeGreaterThanOrEqual(1);
      expect(body.strategies).toBeDefined();
    });

    test('should save multiple strategies', async ({ request }) => {
      const strategies = [
        { ...buildStrategy(), name: 'Strategy A' },
        { ...buildStrategy(), name: 'Strategy B' },
      ];

      const res = await request.post(`${API_V1}/strategies`, {
        data: { walletGroupId, strategies },
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.strategiesCount).toBe(2);
    });
  });

  test.describe('GET /strategies/:walletGroupId - Retrieve', () => {
    test('should return strategies for wallet group', async ({ request }) => {
      await request.post(`${API_V1}/strategies`, {
        data: {
          walletGroupId,
          strategies: [buildStrategy()],
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      const res = await request.get(`${API_V1}/strategies/${walletGroupId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.walletGroupId).toBe(walletGroupId);
      expect(body.strategies).toBeDefined();
      expect(Array.isArray(body.strategies)).toBe(true);
    });

    test('should return correct strategy structure', async ({ request }) => {
      const res = await request.get(`${API_V1}/strategies/${walletGroupId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();

      if (body.strategies && body.strategies.length > 0) {
        const strategy = body.strategies[0];
        expect(strategy).toHaveProperty('name');
        expect(strategy).toHaveProperty('strategyType');
      }
    });
  });
});
