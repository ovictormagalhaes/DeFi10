use anyhow::Result;
use chrono::{Duration, Utc};
use defi10_core::pow::{Challenge, ChallengeData};
use redis::Commands;
use sha2::{Digest, Sha256};

const KEY_PREFIX: &str = "walletgroup:pow:";
const DEFAULT_DIFFICULTY: u32 = 5;
const DEFAULT_TTL_MINUTES: i64 = 15;

pub struct ProofOfWorkService {
    redis: redis::Client,
    difficulty: u32,
    ttl_minutes: i64,
}

impl ProofOfWorkService {
    pub fn new(redis_url: &str) -> Result<Self> {
        let redis = redis::Client::open(redis_url)?;
        Ok(Self {
            redis,
            difficulty: DEFAULT_DIFFICULTY,
            ttl_minutes: DEFAULT_TTL_MINUTES,
        })
    }

    pub fn with_difficulty(mut self, difficulty: u32) -> Self {
        self.difficulty = difficulty;
        self
    }

    pub fn with_ttl_minutes(mut self, ttl_minutes: i64) -> Self {
        self.ttl_minutes = ttl_minutes;
        self
    }

    pub fn generate_challenge(&self) -> Result<Challenge> {
        let challenge = self.generate_random_challenge();
        let expires_at = Utc::now() + Duration::minutes(self.ttl_minutes);

        let challenge_data = ChallengeData {
            challenge: challenge.clone(),
            created_at: Utc::now(),
            expires_at,
        };

        let mut conn = self.redis.get_connection()?;
        let key = Self::get_key(&challenge);
        let json = serde_json::to_string(&challenge_data)?;

        let ttl_seconds = (self.ttl_minutes * 60) as u64;
        let _: () = conn.set_ex(&key, json, ttl_seconds)?;

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

    pub fn validate_proof(&self, challenge: &str, nonce: &str) -> Result<bool> {
        if challenge.is_empty() || nonce.is_empty() {
            tracing::warn!("PoW validation failed: challenge or nonce is empty");
            return Ok(false);
        }

        let mut conn = self.redis.get_connection()?;
        let key = Self::get_key(challenge);
        let json: Option<String> = conn.get(&key)?;

        if json.is_none() {
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

    pub fn invalidate_challenge(&self, challenge: &str) -> Result<()> {
        if challenge.is_empty() {
            return Ok(());
        }

        let mut conn = self.redis.get_connection()?;
        let key = Self::get_key(challenge);
        let deleted: bool = conn.del(&key)?;

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

    fn get_key(challenge: &str) -> String {
        format!("{}{}", KEY_PREFIX, challenge)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_hash_with_valid_nonce() {
        let service = ProofOfWorkService {
            redis: redis::Client::open("redis://localhost").unwrap(),
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
        let service = ProofOfWorkService {
            redis: redis::Client::open("redis://localhost").unwrap(),
            difficulty: 10,
            ttl_minutes: 15,
        };

        let challenge = "test123";
        let nonce = "invalid";

        assert!(!service.validate_hash(challenge, nonce));
    }

    #[test]
    fn test_generate_random_challenge() {
        let service = ProofOfWorkService {
            redis: redis::Client::open("redis://localhost").unwrap(),
            difficulty: 5,
            ttl_minutes: 15,
        };

        let challenge1 = service.generate_random_challenge();
        let challenge2 = service.generate_random_challenge();

        assert_ne!(challenge1, challenge2);
        assert_eq!(challenge1.len(), 64);
        assert_eq!(challenge2.len(), 64);
    }
}
