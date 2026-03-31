import { createHash } from 'crypto';
import { APIRequestContext } from '@playwright/test';

const API_V1 = '/api/v1';
const POW_DIFFICULTY = 5;

export function solveChallenge(challenge: string, difficulty: number = POW_DIFFICULTY): { nonce: number; hash: string } {
  const requiredPrefix = '0'.repeat(difficulty);
  let nonce = 0;

  while (true) {
    const input = challenge + nonce.toString();
    const hash = createHash('sha256').update(input).digest('hex');

    if (hash.startsWith(requiredPrefix)) {
      return { nonce, hash };
    }
    nonce++;
  }
}

export interface WalletAuthResponse {
  token: string;
  expiresAt: string;
  address: string;
}

export async function authenticateWallet(
  request: APIRequestContext,
  address: string,
): Promise<WalletAuthResponse> {
  const challengeRes = await request.post(`${API_V1}/pow/challenge`);
  const { challenge } = await challengeRes.json();

  const { nonce } = solveChallenge(challenge, POW_DIFFICULTY);

  const res = await request.post(`${API_V1}/auth/wallet`, {
    data: {
      address,
      challenge,
      nonce: nonce.toString(),
    },
  });

  if (res.status() !== 200) {
    throw new Error(`Wallet auth failed: ${res.status()} ${await res.text()}`);
  }

  return res.json();
}
