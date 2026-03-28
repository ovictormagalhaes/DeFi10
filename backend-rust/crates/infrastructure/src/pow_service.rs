use anyhow::Result;
use chrono::{Duration, Utc};
use defi10_core::pow::{Challenge, ChallengeData};
use sha2::{Digest, Sha256};
use std::sync::Arc;

use crate::cache::{CacheService, RedisCache};

const POW_PREFIX: &str = "walletgroup_pow";
const DEFAULT_DIFFICULTY: u32 = 5;
const DEFAULT_TTL_MINUTES: i64 = 15;

pub struct ProofOfWorkService {
    cache: Arc<RedisCache>,
    difficulty: u32,
    ttl_minutes: i64,
}

impl ProofOfWorkService {
    pub fn new(cache: Arc<RedisCache>) -> Self {
        Self {
            cache,
            difficulty: DEFAULT_DIFFICULTY,
            ttl_minutes: DEFAULT_TTL_MINUTES,
        }
    }

    pub fn with_difficulty(mut self, difficulty: u32) -> Self {
        self.difficulty = difficulty;
        self
    }

    pub fn with_ttl_minutes(mut self, ttl_minutes: i64) -> Self {
        self.ttl_minutes = ttl_minutes;
        self
    }

    pub async fn generate_challenge(&self) -> Result<Challenge> {
        let challenge = self.generate_random_challenge();
        let expires_at = Utc::now() + Duration::minutes(self.ttl_minutes);

        let challenge_data = ChallengeData {
            challenge: challenge.clone(),
            created_at: Utc::now(),
            expires_at,
        };

        let json = serde_json::to_string(&challenge_data)?;
        let ttl = std::time::Duration::from_secs((self.ttl_minutes * 60) as u64);

        self.cache
            .set_with_expiry(POW_PREFIX, &challenge, json, ttl)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to store PoW challenge: {}", e))?;

        tracing::info!(
            "Generated PoW challenge {} with difficulty {}, expires at {}",
            challenge,
            self.difficulty,
            expires_at
        );

        Ok(Challenge {
            challenge,
            expires_at,
        })
    }

    pub async fn validate_proof(&self, challenge: &str, nonce: &str) -> Result<bool> {
        if challenge.is_empty() || nonce.is_empty() {
            tracing::warn!("PoW validation failed: challenge or nonce is empty");
            return Ok(false);
        }

        let stored: Option<String> = self.cache.get(POW_PREFIX, challenge).await.unwrap_or(None);

        if stored.is_none() {
            tracing::warn!(
                "PoW validation failed: challenge {} not found or expired",
                challenge
            );
            return Ok(false);
        }

        let is_valid = self.validate_hash(challenge, nonce);

        if is_valid {
            tracing::info!(
                "PoW validation succeeded for challenge {} with nonce {}",
                challenge,
                nonce
            );
        } else {
            tracing::warn!(
                "PoW validation failed: hash does not meet difficulty {} for challenge {}",
                self.difficulty,
                challenge
            );
        }

        Ok(is_valid)
    }

    pub async fn invalidate_challenge(&self, challenge: &str) -> Result<()> {
        if challenge.is_empty() {
            return Ok(());
        }

        let deleted = self
            .cache
            .delete(POW_PREFIX, challenge)
            .await
            .unwrap_or(false);

        if deleted {
            tracing::info!("Invalidated PoW challenge {}", challenge);
        }

        Ok(())
    }

    fn validate_hash(&self, challenge: &str, nonce: &str) -> bool {
        let input = format!("{}{}", challenge, nonce);
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        let result = hasher.finalize();
        let hex_hash = hex::encode(result);

        let required_prefix = "0".repeat(self.difficulty as usize);
        hex_hash.starts_with(&required_prefix)
    }

    fn generate_random_challenge(&self) -> String {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let bytes: [u8; 32] = rng.gen();
        hex::encode(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_service_for_hash_test() -> ProofOfWorkService {
        let cache = Arc::new(
            tokio::runtime::Runtime::new()
                .unwrap()
                .block_on(RedisCache::new("redis://localhost", 300))
                .unwrap(),
        );
        ProofOfWorkService {
            cache,
            difficulty: DEFAULT_DIFFICULTY,
            ttl_minutes: DEFAULT_TTL_MINUTES,
        }
    }

    #[test]
    fn test_validate_hash_with_valid_nonce() {
        let service = ProofOfWorkService {
            cache: Arc::new(
                tokio::runtime::Runtime::new()
                    .unwrap()
                    .block_on(RedisCache::new("redis://localhost", 300))
                    .unwrap(),
            ),
            difficulty: 2,
            ttl_minutes: 15,
        };

        let challenge = "test123";
        let mut found = false;

        for nonce in 0..100000 {
            if service.validate_hash(challenge, &nonce.to_string()) {
                found = true;
                break;
            }
        }

        assert!(
            found,
            "Should find valid nonce within 100000 attempts for difficulty 2"
        );
    }

    #[test]
    fn test_validate_hash_with_invalid_nonce() {
        let service = make_service_for_hash_test();
        let service = ProofOfWorkService {
            difficulty: 10,
            ..service
        };

        let challenge = "test123";
        let nonce = "invalid";

        assert!(!service.validate_hash(challenge, nonce));
    }

    #[test]
    fn test_generate_random_challenge() {
        let service = make_service_for_hash_test();

        let challenge1 = service.generate_random_challenge();
        let challenge2 = service.generate_random_challenge();

        assert_ne!(challenge1, challenge2);
        assert_eq!(challenge1.len(), 64);
        assert_eq!(challenge2.len(), 64);
    }
}
