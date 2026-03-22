import { test, expect } from '@playwright/test';
import {
  API_V1,
  TEST_WALLETS,
  createAuthenticatedWalletGroup,
  deleteWalletGroup,
} from './helpers/auth';

test.describe('Aggregation', () => {
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

  test.describe('POST /aggregations - Start Job', () => {
    test('should start aggregation with a single wallet address', async ({ request }) => {
      const res = await request.post(`${API_V1}/aggregations`, {
        data: { account: TEST_WALLETS[0] },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.jobId).toBeDefined();
      expect(body.status).toBeDefined();
    });

    test('should start aggregation with walletGroupId and auth', async ({ request }) => {
      const res = await request.post(`${API_V1}/aggregations`, {
        data: { walletGroupId },
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.jobId).toBeDefined();
      expect(body.accounts).toBeDefined();
    });

    test('should return 401 when using walletGroupId without token', async ({ request }) => {
      const res = await request.post(`${API_V1}/aggregations`, {
        data: { walletGroupId },
      });

      expect([401, 400]).toContain(res.status());
    });

    test('should reject invalid wallet address', async ({ request }) => {
      const res = await request.post(`${API_V1}/aggregations`, {
        data: { account: 'not-a-valid-address' },
      });

      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
    });
  });

  test.describe('GET /aggregations/:jobId - Get Results', () => {
    test('should return job status for a valid jobId', async ({ request }) => {
      const startRes = await request.post(`${API_V1}/aggregations`, {
        data: { account: TEST_WALLETS[0] },
      });
      const { jobId } = await startRes.json();

      const res = await request.get(`${API_V1}/aggregations/${jobId}`);

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.jobId).toBe(jobId);
      expect(body.status).toBeDefined();
    });

    test('should return 404 for non-existent jobId', async ({ request }) => {
      const fakeJobId = '00000000-0000-0000-0000-000000000000';
      const res = await request.get(`${API_V1}/aggregations/${fakeJobId}`);

      expect(res.status()).toBe(404);
    });
  });
});
