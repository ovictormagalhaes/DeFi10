import { test, expect } from '@playwright/test';
import { authenticateWallet } from './helpers/pow';
import {
  API_V1,
  createAuthenticatedWalletGroup,
  deleteWalletGroup,
} from './helpers/auth';

const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18';

const buildStrategy = () => ({
  strategyType: 1,
  name: 'E2E Wallet Strategy',
  description: 'Strategy for direct wallet',
  allocations: [
    {
      assetKey: 'aave-base-weth',
      protocol: { id: 'aave', name: 'Aave' },
      chain: { id: 'base', name: 'Base' },
      token: { symbol: 'WETH', name: 'Wrapped Ether', address: '0x4200000000000000000000000000000000000006' },
      group: 'lending',
      groupType: 1,
      targetWeight: 60,
      positionType: 1,
    },
    {
      assetKey: 'aave-base-usdc',
      protocol: { id: 'aave', name: 'Aave' },
      chain: { id: 'base', name: 'Base' },
      token: { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
      group: 'lending',
      groupType: 1,
      targetWeight: 40,
      positionType: 1,
    },
  ],
});

test.describe('Strategies - Direct Wallet (PoW Auth)', () => {
  let walletToken: string;

  test.beforeAll(async ({ request }) => {
    const result = await authenticateWallet(request, TEST_ADDRESS);
    walletToken = result.token;
  });

  test.describe('Authentication', () => {
    test('GET /strategies/:address should return 401 without token', async ({ request }) => {
      const res = await request.get(`${API_V1}/strategies/${TEST_ADDRESS}`);
      expect(res.status()).toBe(401);
    });

    test('POST /strategies should return 401 without token', async ({ request }) => {
      const res = await request.post(`${API_V1}/strategies`, {
        data: {
          walletGroupId: TEST_ADDRESS,
          strategies: [buildStrategy()],
        },
      });
      expect(res.status()).toBe(401);
    });

    test('GET /strategies/:address should return 403 with mismatched token', async ({ request }) => {
      const otherAddress = '0x0000000000000000000000000000000000000099';
      const res = await request.get(`${API_V1}/strategies/${otherAddress}`, {
        headers: { Authorization: `Bearer ${walletToken}` },
      });
      expect(res.status()).toBe(403);
    });
  });

  test.describe('POST /strategies - Save with wallet address', () => {
    test('should save strategies using wallet address as identifier', async ({ request }) => {
      const res = await request.post(`${API_V1}/strategies`, {
        data: {
          walletGroupId: TEST_ADDRESS,
          strategies: [buildStrategy()],
        },
        headers: { Authorization: `Bearer ${walletToken}` },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.strategiesCount).toBe(1);
      expect(body.key).toBe(TEST_ADDRESS);
      expect(body.wallets).toContain(TEST_ADDRESS);
    });

    test('should save multiple strategies for wallet address', async ({ request }) => {
      const strategies = [
        { ...buildStrategy(), name: 'Wallet Strategy A' },
        { ...buildStrategy(), name: 'Wallet Strategy B' },
      ];

      const res = await request.post(`${API_V1}/strategies`, {
        data: { walletGroupId: TEST_ADDRESS, strategies },
        headers: { Authorization: `Bearer ${walletToken}` },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.strategiesCount).toBe(2);
    });
  });

  test.describe('GET /strategies/:address - Retrieve', () => {
    test('should return strategies for wallet address', async ({ request }) => {
      await request.post(`${API_V1}/strategies`, {
        data: {
          walletGroupId: TEST_ADDRESS,
          strategies: [buildStrategy()],
        },
        headers: { Authorization: `Bearer ${walletToken}` },
      });

      const res = await request.get(`${API_V1}/strategies/${TEST_ADDRESS}`, {
        headers: { Authorization: `Bearer ${walletToken}` },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.key).toBe(TEST_ADDRESS);
      expect(body.wallets).toContain(TEST_ADDRESS);
      expect(body.strategies).toBeDefined();
      expect(Array.isArray(body.strategies)).toBe(true);
    });

    test('should return empty strategies for new address', async ({ request }) => {
      const newAddress = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      const auth = await authenticateWallet(request, newAddress);

      const res = await request.get(`${API_V1}/strategies/${newAddress}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.key).toBe(newAddress);
      expect(body.strategies).toEqual([]);
      expect(body.count).toBe(0);
    });

    test('should return correct strategy structure', async ({ request }) => {
      await request.post(`${API_V1}/strategies`, {
        data: {
          walletGroupId: TEST_ADDRESS,
          strategies: [buildStrategy()],
        },
        headers: { Authorization: `Bearer ${walletToken}` },
      });

      const res = await request.get(`${API_V1}/strategies/${TEST_ADDRESS}`, {
        headers: { Authorization: `Bearer ${walletToken}` },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();

      if (body.strategies.length > 0) {
        const strategy = body.strategies[0];
        expect(strategy).toHaveProperty('name');
        expect(strategy).toHaveProperty('strategyType');
        expect(strategy).toHaveProperty('allocations');
        expect(strategy.allocations.length).toBeGreaterThan(0);
      }
    });
  });
});

test.describe('Strategies - Wallet Group flow still works', () => {
  let walletGroupId: string;
  let groupToken: string;

  test.beforeAll(async ({ request }) => {
    const result = await createAuthenticatedWalletGroup(request);
    walletGroupId = result.walletGroup.id;
    groupToken = result.token;
  });

  test.afterAll(async ({ request }) => {
    await deleteWalletGroup(request, walletGroupId, groupToken).catch(() => {});
  });

  test('should save and retrieve strategies for wallet group (UUID)', async ({ request }) => {
    const saveRes = await request.post(`${API_V1}/strategies`, {
      data: {
        walletGroupId,
        strategies: [buildStrategy()],
      },
      headers: { Authorization: `Bearer ${groupToken}` },
    });

    expect(saveRes.status()).toBe(200);
    const saveBody = await saveRes.json();
    expect(saveBody.strategiesCount).toBe(1);

    const getRes = await request.get(`${API_V1}/strategies/${walletGroupId}`, {
      headers: { Authorization: `Bearer ${groupToken}` },
    });

    expect(getRes.status()).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.walletGroupId).toBe(walletGroupId);
    expect(getBody.strategies).toHaveLength(1);
  });
});

test.describe('Strategies - Isolation between wallet and group', () => {
  test('wallet address strategies are isolated from wallet group strategies', async ({ request }) => {
    const address = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const walletAuth = await authenticateWallet(request, address);
    const { walletGroup, token: groupToken } = await createAuthenticatedWalletGroup(request);

    await request.post(`${API_V1}/strategies`, {
      data: {
        walletGroupId: address,
        strategies: [{ ...buildStrategy(), name: 'Wallet Only Strategy' }],
      },
      headers: { Authorization: `Bearer ${walletAuth.token}` },
    });

    await request.post(`${API_V1}/strategies`, {
      data: {
        walletGroupId: walletGroup.id,
        strategies: [{ ...buildStrategy(), name: 'Group Only Strategy' }],
      },
      headers: { Authorization: `Bearer ${groupToken}` },
    });

    const walletRes = await request.get(`${API_V1}/strategies/${address}`, {
      headers: { Authorization: `Bearer ${walletAuth.token}` },
    });
    const walletBody = await walletRes.json();
    expect(walletBody.strategies[0].name).toBe('Wallet Only Strategy');

    const groupRes = await request.get(`${API_V1}/strategies/${walletGroup.id}`, {
      headers: { Authorization: `Bearer ${groupToken}` },
    });
    const groupBody = await groupRes.json();
    expect(groupBody.strategies[0].name).toBe('Group Only Strategy');

    await deleteWalletGroup(request, walletGroup.id, groupToken).catch(() => {});
  });
});
