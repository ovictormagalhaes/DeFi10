import { test, expect } from '@playwright/test';
import { solveChallenge, authenticateWallet } from './helpers/pow';

const API_V1 = '/api/v1';
const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18';

test.describe('Wallet Authentication (PoW)', () => {
  test.describe('POST /pow/challenge', () => {
    test('should return a challenge', async ({ request }) => {
      const res = await request.post(`${API_V1}/pow/challenge`);

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.challenge).toBeDefined();
      expect(typeof body.challenge).toBe('string');
      expect(body.challenge.length).toBe(64);
      expect(body.expiresAt).toBeDefined();
    });

    test('should return unique challenges', async ({ request }) => {
      const res1 = await request.post(`${API_V1}/pow/challenge`);
      const res2 = await request.post(`${API_V1}/pow/challenge`);

      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1.challenge).not.toBe(body2.challenge);
    });
  });

  test.describe('POST /auth/wallet', () => {
    test('should return JWT token after valid PoW', async ({ request }) => {
      const result = await authenticateWallet(request, TEST_ADDRESS);

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.')).toHaveLength(3);
      expect(result.expiresAt).toBeDefined();
      expect(result.address).toBe(TEST_ADDRESS);

      const expiresAt = new Date(result.expiresAt);
      const now = new Date();
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(6);
      expect(diffDays).toBeLessThanOrEqual(7.1);
    });

    test('should reject invalid PoW nonce', async ({ request }) => {
      const challengeRes = await request.post(`${API_V1}/pow/challenge`);
      const { challenge } = await challengeRes.json();

      const res = await request.post(`${API_V1}/auth/wallet`, {
        data: {
          address: TEST_ADDRESS,
          challenge,
          nonce: 'invalid_nonce',
        },
      });

      expect(res.status()).toBe(401);
    });

    test('should reject reused challenge (single-use)', async ({ request }) => {
      const challengeRes = await request.post(`${API_V1}/pow/challenge`);
      const { challenge } = await challengeRes.json();

      const { nonce } = solveChallenge(challenge);

      const res1 = await request.post(`${API_V1}/auth/wallet`, {
        data: {
          address: TEST_ADDRESS,
          challenge,
          nonce: nonce.toString(),
        },
      });
      expect(res1.status()).toBe(200);

      const res2 = await request.post(`${API_V1}/auth/wallet`, {
        data: {
          address: TEST_ADDRESS,
          challenge,
          nonce: nonce.toString(),
        },
      });
      expect(res2.status()).toBe(401);
    });

    test('should reject empty address', async ({ request }) => {
      const challengeRes = await request.post(`${API_V1}/pow/challenge`);
      const { challenge } = await challengeRes.json();
      const { nonce } = solveChallenge(challenge);

      const res = await request.post(`${API_V1}/auth/wallet`, {
        data: {
          address: '',
          challenge,
          nonce: nonce.toString(),
        },
      });

      expect(res.status()).toBe(400);
    });

    test('should reject missing challenge', async ({ request }) => {
      const res = await request.post(`${API_V1}/auth/wallet`, {
        data: {
          address: TEST_ADDRESS,
          challenge: '',
          nonce: '123',
        },
      });

      expect(res.status()).toBe(400);
    });

    test('should authenticate different addresses independently', async ({ request }) => {
      const addr1 = '0x0000000000000000000000000000000000000001';
      const addr2 = '0x0000000000000000000000000000000000000002';

      const result1 = await authenticateWallet(request, addr1);
      const result2 = await authenticateWallet(request, addr2);

      expect(result1.token).not.toBe(result2.token);
      expect(result1.address).toBe(addr1);
      expect(result2.address).toBe(addr2);
    });
  });
});
