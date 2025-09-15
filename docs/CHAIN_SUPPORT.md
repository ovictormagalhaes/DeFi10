# API Endpoints - Multi-Chain Support

## Wallet API

### Get Wallet Information

#### Default Chain (Base)
```
GET /api/v1/wallets/accounts/{account}
```

#### Single Chain
```
GET /api/v1/wallets/accounts/{account}?chain=Base
GET /api/v1/wallets/accounts/{account}?chain=BNB
```

#### Multiple Chains (NEW!)
```
GET /api/v1/wallets/accounts/{account}?chains=Base,BNB
GET /api/v1/wallets/accounts/{account}?chains=Base
GET /api/v1/wallets/accounts/{account}?chains=BNB,Base
```

### Get Supported Chains
```
GET /api/v1/wallets/supported-chains
```

## Multi-Chain Features

### Parallel Processing
- ?? **Simultaneous requests**: All chains processed in parallel
- ? **Performance**: Faster than sequential chain calls
- ??? **Error isolation**: One chain failure doesn't stop others

### Priority System
1. **`chains` parameter** (highest priority) - Multiple chains
2. **`chain` parameter** - Single chain  
3. **Default** - Base chain

### Response Combination
- ? **Items merged**: All successful chain results combined
- ?? **Network name**: Shows which chains were processed
- ? **Single timestamp**: Combined response time

## Supported Chains

| Chain | Chain ID | String ID | Display Name | Supported Services |
|-------|----------|-----------|--------------|-------------------|
| Base | 8453 | base | Base | Moralis, Aave, UniswapV3 |
| BNB | 56 | bsc | BNB Smart Chain | Moralis |

## Protocol Support by Chain

### Moralis (ERC20 Tokens)
- ? Base
- ? BNB Smart Chain

### Aave V3 (Lending/Borrowing)
- ? Base
- ? BNB Smart Chain (not available)

### Uniswap V3 (Liquidity Pools)
- ? Base
- ? BNB Smart Chain (use PancakeSwap instead)

## Example Responses

### Single Chain (Base)
```json
{
  "account": "0x1234...",
  "network": "Base",
  "items": [
    {
      "type": "Wallet",
      "protocol": { "name": "Moralis", "chain": "Base" }
    },
    {
      "type": "LendingAndBorrowing", 
      "protocol": { "name": "Aave V3", "chain": "Base" }
    },
    {
      "type": "LiquidityPool",
      "protocol": { "name": "Uniswap V3", "chain": "Base" }
    }
  ],
  "lastUpdated": "2024-01-01T12:00:00Z"
}
```

### Multi-Chain (Base + BNB)
```json
{
  "account": "0x1234...",
  "network": "Multi-Chain (Base, BNB Smart Chain)",
  "items": [
    {
      "type": "Wallet",
      "protocol": { "name": "Moralis", "chain": "Base" }
    },
    {
      "type": "LendingAndBorrowing",
      "protocol": { "name": "Aave V3", "chain": "Base" }
    },
    {
      "type": "LiquidityPool", 
      "protocol": { "name": "Uniswap V3", "chain": "Base" }
    },
    {
      "type": "Wallet",
      "protocol": { "name": "Moralis", "chain": "BNB Smart Chain" }
    }
  ],
  "lastUpdated": "2024-01-01T12:00:00Z"
}
```

## Error Handling

### Invalid Single Chain
```json
{
  "error": "Invalid chain 'invalid'. Supported chains: Base, BNB"
}
```

### Invalid Multiple Chains
```json
{
  "error": "Invalid chains: ethereum, polygon. Supported chains: Base, BNB"
}
```

### Partial Success (One chain fails)
```json
{
  "account": "0x1234...",
  "network": "Multi-Chain (Base)",
  "items": [
    // Only Base items returned, BNB failed silently
  ]
}
```

### Chain Not Supported by Protocol
- **Behavior**: Protocol skipped for unsupported chains
- **Result**: No error, just missing data for that protocol+chain combination

## Performance Comparison

| Scenario | Sequential Time | Parallel Time | Improvement |
|----------|----------------|---------------|-------------|
| Base only | ~2s | ~2s | Same |
| BNB only | ~1s | ~1s | Same |
| Base + BNB | ~3s | ~2s | **33% faster** |

## Usage Examples

### Frontend JavaScript
```javascript
// Single chain
const baseWallet = await fetch('/api/v1/wallets/accounts/0x123?chain=Base');

// Multiple chains  
const multiWallet = await fetch('/api/v1/wallets/accounts/0x123?chains=Base,BNB');

// Default (Base)
const defaultWallet = await fetch('/api/v1/wallets/accounts/0x123');
```

### cURL Examples
```bash
# Single chain
curl "/api/v1/wallets/accounts/0x123?chain=Base"

# Multiple chains
curl "/api/v1/wallets/accounts/0x123?chains=Base,BNB"

# All supported chains
curl "/api/v1/wallets/accounts/0x123?chains=Base,BNB"