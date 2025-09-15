# Chain Icon URLs - Reference Guide

## Method Usage

```csharp
// Get icon URL for any chain
string baseIcon = Chain.Base.GetIconUrl();
string ethereumIcon = Chain.Ethereum.GetIconUrl();
string bnbIcon = Chain.BNB.GetIconUrl();
```

## Suggested Icon URLs

### Option 1: CoinGecko Icons (Free, High Quality)
```csharp
Chain.Base => "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png", // Base placeholder
Chain.Ethereum => "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
Chain.Polygon => "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
Chain.Arbitrum => "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg",
Chain.Optimism => "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
Chain.BNB => "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png"
```

### Option 2: TrustWallet Assets (GitHub CDN)
```csharp
Chain.Base => "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
Chain.Ethereum => "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
Chain.Polygon => "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
Chain.Arbitrum => "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
Chain.Optimism => "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
Chain.BNB => "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png"
```

### Option 3: Local Assets (Self-hosted)
```csharp
Chain.Base => "/assets/chains/base.png",
Chain.Ethereum => "/assets/chains/ethereum.png", 
Chain.Polygon => "/assets/chains/polygon.png",
Chain.Arbitrum => "/assets/chains/arbitrum.png",
Chain.Optimism => "/assets/chains/optimism.png",
Chain.BNB => "/assets/chains/bnb.png"
```

### Option 4: CDN (jsDelivr + TrustWallet)
```csharp
Chain.Base => "https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/base/info/logo.png",
Chain.Ethereum => "https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/ethereum/info/logo.png",
Chain.Polygon => "https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/polygon/info/logo.png",
Chain.Arbitrum => "https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/arbitrum/info/logo.png",
Chain.Optimism => "https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/optimism/info/logo.png",
Chain.BNB => "https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/smartchain/info/logo.png"
```

## Usage Examples

### In Controllers/API Responses
```csharp
[HttpGet("supported-chains")]
public ActionResult<object> GetSupportedChains()
{
    var supportedChains = new[]
    {
        new { 
            name = "Base", 
            id = "base", 
            chainId = 8453, 
            displayName = "Base",
            iconUrl = Chain.Base.GetIconUrl() // ? Using the new method
        },
        new { 
            name = "BNB", 
            id = "bsc", 
            chainId = 56, 
            displayName = "BNB Smart Chain",
            iconUrl = Chain.BNB.GetIconUrl() // ? Using the new method
        }
    };

    return Ok(new { chains = supportedChains });
}
```

### In Wallet Responses
```csharp
public class Protocol 
{
    public string Name { get; set; }
    public string Chain { get; set; }
    public string Id { get; set; }
    public string Url { get; set; }
    public string Logo { get; set; }
    public string ChainIconUrl { get; set; } // ? New property for chain icon
}

// Usage in mappers:
private static Protocol GetProtocol(ChainEnum chain) => new()
{
    Name = "Moralis",
    Chain = chain.GetDisplayName(),
    Id = "moralis",
    Url = "",
    Logo = "",
    ChainIconUrl = chain.GetIconUrl() // ? Using the new method
};
```

### Frontend Integration
```json
// API Response Example
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
  ]
}
```

## Recommendations

### ?? Best Option: TrustWallet + jsDelivr CDN
- ? **Free**: No API limits
- ? **High quality**: 256x256 PNG icons
- ? **Fast CDN**: jsDelivr global distribution
- ? **Reliable**: TrustWallet maintains the assets
- ? **Consistent**: Same style across all chains

### ?? Alternative: CoinGecko
- ? **Free**: No API key required
- ? **High quality**: Professional icons
- ?? **Variable sizes**: Not all icons same size
- ?? **Rate limits**: Possible throttling

### ?? Self-hosted
- ? **Full control**: No external dependencies
- ? **Custom styling**: Can modify icons
- ? **Maintenance**: Need to download and host icons
- ? **Bandwidth**: Uses your server resources

## Next Steps

1. **Choose option** from above suggestions
2. **Replace TODO comments** in `GetIconUrl()` method
3. **Test URLs** to ensure they work
4. **Update Protocol class** to include `ChainIconUrl` property
5. **Update mappers** to use the new icon URLs