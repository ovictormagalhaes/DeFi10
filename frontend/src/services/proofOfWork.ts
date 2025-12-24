/**
 * Proof-of-Work service for wallet group authentication
 * Implements SHA-256 based PoW challenge solving
 */

export interface Challenge {
  challenge: string;
  expiresAt: string;
  difficulty: number;
}

export interface PoWResult {
  nonce: number;
  hash: string;
}

/**
 * Solves a Proof-of-Work challenge by finding a nonce that produces
 * a hash starting with the required number of zeros (difficulty)
 */
export async function solveChallenge(
  challenge: string,
  difficulty: number,
  onProgress?: (nonce: number, hash: string) => void
): Promise<PoWResult> {
  let nonce = 0;
  const requiredPrefix = '0'.repeat(difficulty);
  const startTime = Date.now();

  while (true) {
    const input = challenge + nonce.toString();
    const hash = await sha256(input);

    if (nonce % 5000 === 0 && onProgress) {
      onProgress(nonce, hash);
    }

    if (hash.startsWith(requiredPrefix)) {
      return { nonce, hash };
    }

    nonce++;

    // Yield to browser every 10000 iterations to prevent UI freeze
    if (nonce % 10000 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

/**
 * Computes SHA-256 hash of input string
 * Uses Web Crypto API for browser compatibility
 */
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Estimates time to solve challenge based on difficulty
 * Used for UI feedback
 */
export function estimateSolveTime(difficulty: number): string {
  const iterations = Math.pow(16, difficulty);
  const iterationsPerSecond = 50000; // Conservative estimate
  const seconds = iterations / iterationsPerSecond;

  if (seconds < 1) return '< 1 second';
  if (seconds < 60) return `~${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `~${Math.round(seconds / 60)} minutes`;
  return `~${Math.round(seconds / 3600)} hours`;
}
