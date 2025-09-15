# Supported Chains API Response

## New Response Structure

### Endpoint
```
GET /api/v1/wallets/supported-chains
```

### Old Response (Anonymous Object)
```json
{
  "chains": [
    {
      "name": "Base",
      "id": "base", 
      "chainId": 8453,
      "displayName": "Base"
    },
    {
      "name": "BNB",
      "id": "bsc",
      "chainId": 56,
      "displayName": "BNB Smart Chain"
    }
  ]
}
```

### New Response (Strongly-Typed with Icons)
```json
{
  "chains": [
    {
      "name": "Base",
      "id": "base",
      "chainId": 8453,
      "displayName": "Base",
      "iconUrl": "https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/base/info/logo.png"
    },
    {
      "name": "BNB", 
      "id": "bsc",
      "chainId": 56,
      "displayName": "BNB Smart Chain",
      "iconUrl": "https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/smartchain/info/logo.png"
    }
  ],
  "count": 2,
  "lastUpdated": "2024-01-01T12:00:00.000Z"
}
```

## Implementation Details

### Classes Created
```csharp
// Individual chain information
public class SupportedChainResponse
{
    public string Name { get; set; } = string.Empty;
    public string Id { get; set; } = string.Empty;
    public int ChainId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string IconUrl { get; set; } = string.Empty;  // ? NEW!
}

// Complete response wrapper
public class SupportedChainsResponse
{
    public List<SupportedChainResponse> Chains { get; set; } = new();
    public int Count => Chains.Count;                        // ? NEW!
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow; // ? NEW!
}
```

### Controller Method Updated
```csharp
[HttpGet("supported-chains")]
public ActionResult<SupportedChainsResponse> GetSupportedChains()
{
    var supportedChains = new List<SupportedChainResponse>
    {
        new()
        {
            Name = "Base",
            Id = Chain.Base.ToChainId(),                // "base"
            ChainId = Chain.Base.ToNumericChainId(),    // 8453
            DisplayName = Chain.Base.GetDisplayName(),  // "Base"
            IconUrl = Chain.Base.GetIconUrl()           // ? Icon URL!
        },
        new()
        {
            Name = "BNB",
            Id = Chain.BNB.ToChainId(),                 // "bsc"
            ChainId = Chain.BNB.ToNumericChainId(),     // 56
            DisplayName = Chain.BNB.GetDisplayName(),   // "BNB Smart Chain"
            IconUrl = Chain.BNB.GetIconUrl()            // ? Icon URL!
        }
    };

    return Ok(new SupportedChainsResponse { Chains = supportedChains });
}
```

## Icon URLs Implemented

All chains now have real icon URLs from TrustWallet assets:

| Chain | Icon URL |
|-------|----------|
| Base | `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/base/info/logo.png` |
| Ethereum | `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/ethereum/info/logo.png` |
| Polygon | `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/polygon/info/logo.png` |
| Arbitrum | `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/arbitrum/info/logo.png` |
| Optimism | `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/optimism/info/logo.png` |
| BNB | `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/smartchain/info/logo.png` |

## Frontend Usage

### React Component Example
```typescript
interface SupportedChain {
  name: string;
  id: string;
  chainId: number;
  displayName: string;
  iconUrl: string;
}

interface SupportedChainsResponse {
  chains: SupportedChain[];
  count: number;
  lastUpdated: string;
}

const ChainSelector: React.FC = () => {
  const [chains, setChains] = useState<SupportedChain[]>([]);

  useEffect(() => {
    fetch('/api/v1/wallets/supported-chains')
      .then(res => res.json())
      .then((data: SupportedChainsResponse) => {
        setChains(data.chains);
      });
  }, []);

  return (
    <div>
      <h3>Select Chain ({chains.length} available)</h3>
      {chains.map(chain => (
        <div key={chain.id} className="chain-option">
          <img src={chain.iconUrl} alt={chain.name} width="24" height="24" />
          <span>{chain.displayName}</span>
          <small>Chain ID: {chain.chainId}</small>
        </div>
      ))}
    </div>
  );
};
```

### JavaScript/Vanilla Example
```javascript
async function loadSupportedChains() {
  try {
    const response = await fetch('/api/v1/wallets/supported-chains');
    const data = await response.json();
    
    console.log(`Loaded ${data.count} supported chains:`);
    
    data.chains.forEach(chain => {
      console.log(`- ${chain.displayName} (${chain.id})`);
      console.log(`  Icon: ${chain.iconUrl}`);
      console.log(`  Chain ID: ${chain.chainId}`);
    });
    
    return data.chains;
  } catch (error) {
    console.error('Failed to load supported chains:', error);
    return [];
  }
}

// Usage
loadSupportedChains().then(chains => {
  // Build UI with chain data including icons
});
```

## Benefits

### ? Type Safety
- **Before**: Anonymous objects, no compile-time checking
- **After**: Strongly-typed classes with IntelliSense

### ? Rich Metadata
- **Icons**: Visual representation for each chain
- **Count**: Number of supported chains
- **Timestamp**: When data was generated

### ? Extensibility
- **Easy to add**: New properties to `SupportedChainResponse`
- **Versioning**: Can add API version info to response
- **Caching**: Can add cache headers/TTL

### ? Frontend Benefits
- **Visual**: Icons for chain selection UI
- **Consistent**: Same icon URLs across all endpoints
- **Performant**: CDN-hosted images load fast