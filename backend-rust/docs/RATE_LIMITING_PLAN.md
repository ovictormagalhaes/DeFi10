# Alchemy Rate Limiting Plan

## Problem Statement

Alchemy has a rate limit of **25 requests per second** (configurable per plan). 
Each protocol method can make multiple RPC calls, quickly exhausting the quota.

### Current RPC Call Analysis (per wallet)

| Protocol | Method | Estimated RPC Calls | Notes |
|----------|--------|---------------------|-------|
| Raydium | get_user_positions | 3-10+ | 1 (NFT accounts) + 1 (position PDA) + 1 (pool data) per position + price fetches |
| Kamino | get_user_positions | 2-3 | 1 (API) + potential reserve fetches |
| Solana Provider | get_nft_positions | 2-4 | 1 (SPL tokens) + 1 (Token-2022) + retries |

**Worst case**: Processing 5 wallets simultaneously = 50+ RPC calls in seconds.

---

## Proposed Solutions

### Option 1: Global Rate Limiter (Recommended)

Implement a centralized rate limiter that all RPC calls pass through.

```rust
// Conceptual structure
pub struct RateLimitedRpcClient {
    inner: RpcClient,
    limiter: RateLimiter,  // governor or leaky-bucket crate
    max_rps: u32,          // from config, default 25
}

impl RateLimitedRpcClient {
    pub async fn call<T>(&self, method: &str, params: Value) -> Result<T> {
        self.limiter.acquire().await;  // blocks if over limit
        self.inner.call(method, params).await
    }
}
```

**Pros:**
- Single point of control
- Works for all protocols automatically
- Easy to configure per environment

**Cons:**
- May slow down aggregation if many wallets queued
- Needs careful backpressure handling

### Option 2: Request Batching

Group multiple RPC calls into batch requests where supported.

```rust
// Batch getMultipleAccounts instead of multiple getAccountInfo
let accounts = rpc.get_multiple_accounts(&[
    position_pda,
    pool_address,
    token_mint_a,
    token_mint_b,
]).await?;
```

**Applicable methods:**
- `getMultipleAccounts` - fetch position + pool + mints in 1 call
- `getTokenAccountsByOwner` - already batched (current implementation)

**Pros:**
- Dramatically reduces call count
- Faster response times

**Cons:**
- Not all data can be batched
- Requires refactoring service logic

### Option 3: Tiered Rate Limiting

Different limits for different priority levels.

```rust
pub enum Priority {
    High,    // User-initiated, real-time requests
    Normal,  // Background aggregation
    Low,     // Cache warming, prefetch
}

// High priority gets 15 RPS, Normal gets 8 RPS, Low gets 2 RPS
```

### Option 4: Request Deduplication + Caching

Cache RPC responses to avoid redundant calls.

```rust
// Pool data rarely changes - cache for 30s
let pool = cache.get_or_fetch(&pool_id, Duration::from_secs(30), || {
    self.fetch_account_data(&pool_id)
}).await?;
```

**High-value caches:**
- Pool data (tick spacing, sqrt_price changes slowly)
- Token decimals (immutable)
- Token metadata (immutable)

---

## Recommended Implementation Strategy

### Phase 1: Quick Wins (Low effort, high impact)

1. **Batch account fetches in Raydium**
   - Use `getMultipleAccounts` for position + pool + mints
   - Reduces 4 calls to 1 per position

2. **Cache token decimals**
   - Token decimals never change
   - In-memory HashMap with lazy population

3. **Cache pool data**
   - 30-60 second TTL
   - Reduces repeated pool fetches for same pool

### Phase 2: Global Rate Limiter

1. **Add `governor` crate** for rate limiting
   ```toml
   governor = "0.6"
   ```

2. **Wrap RPC client**
   ```rust
   pub struct SolanaProvider {
       rpc: RpcClient,
       rate_limiter: RateLimiter,
   }
   ```

3. **Configuration**
   ```toml
   [solana.rate_limit]
   max_rps = 25
   burst_size = 5
   ```

### Phase 3: Advanced Optimizations

1. **Request queuing with priorities**
2. **Adaptive rate limiting** (back off on 429 responses)
3. **Multi-provider load balancing** (Alchemy + Helius + QuickNode)

---

## Configuration Schema

```toml
[solana]
rpc_url = "https://solana-mainnet.g.alchemy.com/v2/{API_KEY}"

[solana.rate_limit]
enabled = true
max_requests_per_second = 25  # Alchemy plan limit
burst_size = 5                 # Allow short bursts
backoff_on_429 = true          # Exponential backoff on rate limit
retry_after_ms = 1000          # Default retry delay

[solana.cache]
pool_data_ttl_seconds = 60
token_decimals_ttl_seconds = 86400  # 24h (immutable data)
```

---

## Monitoring & Observability

Track these metrics:
- `rpc_requests_total` - Counter by method
- `rpc_rate_limit_wait_ms` - Time spent waiting for rate limiter
- `rpc_429_responses` - Rate limit hits from provider
- `rpc_cache_hits` - Cache effectiveness

---

## Estimated Impact

| Optimization | RPC Calls Saved | Effort |
|--------------|-----------------|--------|
| Batch account fetches | ~60% per position | Medium |
| Cache token decimals | ~10% overall | Low |
| Cache pool data | ~20% for repeat queries | Low |
| Global rate limiter | Prevents 429 errors | Medium |

---

## Next Steps

1. [ ] Implement token decimals caching (quick win)
2. [ ] Refactor Raydium to use `getMultipleAccounts`
3. [ ] Add `governor` rate limiter to SolanaProvider
4. [ ] Add configuration for rate limits
5. [ ] Add metrics for monitoring
