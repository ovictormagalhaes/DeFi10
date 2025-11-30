using System.Text.Json;
using MyWebWallet.API.Services.Interfaces;
using Solnet.Rpc;
using Solnet.Wallet;

namespace MyWebWallet.API.Services.Solana;

/// <summary>
/// Implementation of token metadata service using Redis cache with automatic CMC fallback
/// </summary>
public sealed class TokenMetadataService : ITokenMetadataService
{
    private readonly ICacheService _cache;
    private readonly ICoinMarketCapService _cmcService;
    private readonly ILogger<TokenMetadataService> _logger;
    
    private const string METADATA_PREFIX = "token:metadata:";
    private const string PRICE_PREFIX = "token:price:";
    private static readonly TimeSpan METADATA_TTL = TimeSpan.FromDays(7);  // Metadata rarely changes
    private static readonly TimeSpan PRICE_TTL = TimeSpan.FromMinutes(5);  // Prices change frequently
    
    // Well-known Solana token mappings (mint → symbol for CMC lookup)
    private static readonly Dictionary<string, string> WellKnownTokens = new(StringComparer.OrdinalIgnoreCase)
    {
        ["So11111111111111111111111111111111111111112"] = "SOL",
        ["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"] = "USDC",
        ["Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"] = "USDT",
        ["4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"] = "RAY",
        ["mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So"] = "MSOL",
        ["7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj"] = "STSOL",
        ["JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"] = "JUP",
        ["DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"] = "BONK",
        ["7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr"] = "POPCAT",
        ["WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk"] = "WEN"
    };

    public TokenMetadataService(
        ICacheService cache,
        ICoinMarketCapService cmcService,
        ILogger<TokenMetadataService> logger)
    {
        _cache = cache;
        _cmcService = cmcService;
        _logger = logger;
    }

    public async Task<TokenMetadata?> GetTokenMetadataAsync(string mintAddress)
    {
        if (string.IsNullOrWhiteSpace(mintAddress))
            return null;

        try
        {
            // 1. Try cache first
            string key = $"{METADATA_PREFIX}{mintAddress}";
            string? cached = await _cache.GetAsync<string>(key);
            
            if (cached != null)
            {
                _logger.LogDebug("[TokenMetadata] Cache HIT for mint={Mint}", mintAddress);
                return JsonSerializer.Deserialize<TokenMetadata>(cached);
            }
            
            _logger.LogDebug("[TokenMetadata] Cache MISS for mint={Mint}, fetching from CMC...", mintAddress);
            
            // 2. Try to fetch from CoinMarketCap
            var metadata = await FetchMetadataFromCMCAsync(mintAddress);
            
            if (metadata != null)
            {
                // Cache it for future use
                await SetTokenMetadataAsync(mintAddress, metadata);
                _logger.LogInformation("[TokenMetadata] Fetched and cached metadata for mint={Mint}, symbol={Symbol}", 
                    mintAddress, metadata.Symbol);
            }
            
            return metadata;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Failed to get metadata for mint={Mint}", mintAddress);
            return null;
        }
    }
    
    private async Task<TokenMetadata?> FetchMetadataFromCMCAsync(string mintAddress)
    {
        try
        {
            // Check if it's a well-known token
            if (WellKnownTokens.TryGetValue(mintAddress, out var symbol))
            {
                _logger.LogDebug("[TokenMetadata] Found well-known token: {Mint} → {Symbol}", mintAddress, symbol);
                
                // Fetch from CMC by symbol
                var cmcResponse = await _cmcService.GetQuotesLatestV2Async(new[] { symbol });
                
                if (cmcResponse?.Data != null && cmcResponse.Data.TryGetValue(symbol.ToUpperInvariant(), out var quote))
                {
                    var metadata = new TokenMetadata
                    {
                        Symbol = quote.Symbol,
                        Name = quote.Name,
                        LogoUrl = null // CMC doesn't provide logo URLs in this endpoint
                    };
                    
                    // Also cache the price while we're at it
                    if (quote.Quote.TryGetValue("USD", out var usdQuote) && usdQuote.Price.HasValue)
                    {
                        await SetTokenPriceAsync(mintAddress, usdQuote.Price.Value);
                        await SetTokenPriceAsync(symbol, usdQuote.Price.Value);
                    }
                    
                    return metadata;
                }
            }
            
            // TODO: For unknown tokens, we could:
            // 1. Query Solana blockchain for token metadata (using Metaplex standards)
            // 2. Use Jupiter API or other token lists
            // 3. Use Solana Token List (GitHub repo)
            
            _logger.LogDebug("[TokenMetadata] Could not fetch metadata from CMC for mint={Mint}", mintAddress);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Error fetching from CMC for mint={Mint}", mintAddress);
            return null;
        }
    }

    public async Task<decimal?> GetTokenPriceAsync(string identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier))
            return null;

        try
        {
            // Try to get price by identifier (could be mint address, symbol, or name)
            string key = $"{PRICE_PREFIX}{identifier.ToLowerInvariant()}";
            var cached = await _cache.GetAsync<string>(key);
            
            if (cached != null && decimal.TryParse(cached, out decimal price))
            {
                _logger.LogDebug("[TokenPrice] Cache HIT for identifier={Identifier}, price={Price}", 
                    identifier, price);
                return price;
            }
            
            _logger.LogDebug("[TokenPrice] Cache MISS for identifier={Identifier}", identifier);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenPrice] Failed to get price for identifier={Identifier}", identifier);
            return null;
        }
    }

    public async Task SetTokenMetadataAsync(string mintAddress, TokenMetadata metadata)
    {
        if (string.IsNullOrWhiteSpace(mintAddress) || metadata == null)
            return;

        try
        {
            string key = $"{METADATA_PREFIX}{mintAddress}";
            string json = JsonSerializer.Serialize(metadata);
            await _cache.SetAsync(key, json, METADATA_TTL);
            
            _logger.LogInformation("[TokenMetadata] Cached metadata for mint={Mint}, symbol={Symbol}, name={Name}", 
                mintAddress, metadata.Symbol, metadata.Name);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Failed to cache metadata for mint={Mint}", mintAddress);
        }
    }

    public async Task SetTokenPriceAsync(string identifier, decimal priceUsd)
    {
        if (string.IsNullOrWhiteSpace(identifier))
            return;

        try
        {
            // Store by all identifiers: mint address, symbol, and name if they're different
            string key = $"{PRICE_PREFIX}{identifier.ToLowerInvariant()}";
            await _cache.SetAsync(key, priceUsd.ToString(System.Globalization.CultureInfo.InvariantCulture), PRICE_TTL);
            
            _logger.LogInformation("[TokenPrice] Cached price for identifier={Identifier}, price={Price}", 
                identifier, priceUsd);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenPrice] Failed to cache price for identifier={Identifier}", identifier);
        }
    }
}
