# Multi-Chain Usage Examples

## API Examples

### 1. Single Chain Requests
```bash
# Base chain only (all protocols: Moralis + Aave + Uniswap)
curl "http://localhost:5000/api/v1/wallets/accounts/0x742d35Cc6634C0532925a3b8D42F8f0234dC8ef4?chain=Base"

# BNB chain only (Moralis tokens only)
curl "http://localhost:5000/api/v1/wallets/accounts/0x742d35Cc6634C0532925a3b8D42F8f0234dC8ef4?chain=BNB"
```

### 2. Multi-Chain Requests (NEW!)
```bash
# Both chains simultaneously  
curl "http://localhost:5000/api/v1/wallets/accounts/0x742d35Cc6634C0532925a3b8D42F8f0234dC8ef4?chains=Base,BNB"

# Same chains, different order (order doesn't matter)
curl "http://localhost:5000/api/v1/wallets/accounts/0x742d35Cc6634C0532925a3b8D42F8f0234dC8ef4?chains=BNB,Base"
```

### 3. Error Cases
```bash
# Invalid chain
curl "http://localhost:5000/api/v1/wallets/accounts/0x742d35Cc6634C0532925a3b8D42F8f0234dC8ef4?chain=ethereum"
# Response: {"error": "Invalid chain 'ethereum'. Supported chains: Base, BNB"}

# Invalid chains in multi-chain
curl "http://localhost:5000/api/v1/wallets/accounts/0x742d35Cc6634C0532925a3b8D42F8f0234dC8ef4?chains=Base,ethereum,BNB"
# Response: {"error": "Invalid chains: ethereum. Supported chains: Base, BNB"}
```

## Expected Response Structure

### Base Chain Only
```json
{
  "account": "0x742d35...",
  "network": "Base",
  "items": [
    {
      "type": "Wallet",
      "protocol": {
        "name": "Moralis",
        "chain": "Base",
        "id": "moralis"
      },
      "position": {
        "label": "Wallet",
        "tokens": [
          {
            "name": "USD Coin",
            "symbol": "USDC",
            "financials": {
              "amount": 1000000,
              "balanceFormatted": 1.0,
              "price": 1.0,
              "totalPrice": 1.0
            }
          }
        ]
      }
    },
    {
      "type": "LendingAndBorrowing",
      "protocol": {
        "name": "Aave V3",
        "chain": "Base"
      }
    },
    {
      "type": "LiquidityPool",
      "protocol": {
        "name": "Uniswap V3", 
        "chain": "Base"
      }
    }
  ],
  "lastUpdated": "2024-01-01T12:00:00Z"
}
```

### Multi-Chain (Base + BNB)
```json
{
  "account": "0x742d35...",
  "network": "Multi-Chain (Base, BNB Smart Chain)",
  "items": [
    // Base chain items
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
    // BNB chain items (only Moralis tokens)
    {
      "type": "Wallet", 
      "protocol": { "name": "Moralis", "chain": "BNB Smart Chain" },
      "position": {
        "tokens": [
          {
            "name": "PancakeSwap Token",
            "symbol": "CAKE",
            "financials": {
              "amount": 5000000000000000000,
              "balanceFormatted": 5.0,
              "price": 2.5,
              "totalPrice": 12.5
            }
          }
        ]
      }
    }
  ],
  "lastUpdated": "2024-01-01T12:00:00Z"
}
```

## Performance Benefits

### Sequential vs Parallel
```bash
# OLD WAY (Sequential) - Total: ~3 seconds
time curl "http://localhost:5000/api/v1/wallets/accounts/0x123?chain=Base"   # ~2s
time curl "http://localhost:5000/api/v1/wallets/accounts/0x123?chain=BNB"    # ~1s

# NEW WAY (Parallel) - Total: ~2 seconds  
time curl "http://localhost:5000/api/v1/wallets/accounts/0x123?chains=Base,BNB"  # ~2s
```

### Logs Output
```
WalletController: Processing multiple chains: Base, BNB
WalletService: Processing 2 chains for account: 0x123
WalletService: Starting chain Base processing...
WalletService: Starting chain BNB processing...
SUCCESS: WalletService: Chain BNB completed with 5 items
SUCCESS: WalletService: Chain Base completed with 12 items  
SUCCESS: WalletService: Multi-chain processing completed. Successful chains: 2, Failed chains: 0, Total items: 17
```

## Frontend Integration

### React Example
```typescript
interface WalletData {
  account: string;
  network: string; 
  items: WalletItem[];
  lastUpdated: string;
}

// Single chain
const fetchSingleChain = async (address: string, chain: 'Base' | 'BNB'): Promise<WalletData> => {
  const response = await fetch(`/api/v1/wallets/accounts/${address}?chain=${chain}`);
  return response.json();
};

// Multi-chain 
const fetchMultiChain = async (address: string, chains: string[]): Promise<WalletData> => {
  const chainsParam = chains.join(',');
  const response = await fetch(`/api/v1/wallets/accounts/${address}?chains=${chainsParam}`);
  return response.json();
};

// Usage
const wallet = await fetchMultiChain('0x123', ['Base', 'BNB']);
console.log(`Found ${wallet.items.length} items across ${wallet.network}`);
```

### JavaScript Fetch Example
```javascript
// All supported chains
async function getAllChainData(walletAddress) {
  try {
    const response = await fetch(
      `/api/v1/wallets/accounts/${walletAddress}?chains=Base,BNB`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Multi-chain data for ${walletAddress}:`, data);
    return data;
  } catch (error) {
    console.error('Error fetching multi-chain data:', error);
    throw error;
  }
}

// Call it
getAllChainData('0x742d35Cc6634C0532925a3b8D42F8f0234dC8ef4')
  .then(wallet => {
    console.log(`Network: ${wallet.network}`);
    console.log(`Total items: ${wallet.items.length}`);
    console.log(`Last updated: ${wallet.lastUpdated}`);
  });
```