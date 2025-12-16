using System.Text.Json;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Infrastructure.CoinMarketCap;
using DeFi10.API.Configuration;
using Microsoft.Extensions.Options;
using Solnet.Rpc;
using Solnet.Wallet;
using DeFi10.API.Models;

namespace DeFi10.API.Services.Helpers;


public sealed class TokenMetadataService : ITokenMetadataService
{
    private readonly ICacheService _cache;
    private readonly ICoinMarketCapService _cmcService;
    private readonly ILogger<TokenMetadataService> _logger;
    private readonly bool _enableCoinMarketCapLookup;
    
    private const string METADATA_PREFIX = "token:metadata:";
    private const string METADATA_BY_SYMBOL_PREFIX = "token:metadata:symbol:";
    private const string PRICE_PREFIX = "token:price:";
    private static readonly TimeSpan METADATA_TTL = TimeSpan.FromDays(7);
    private static readonly TimeSpan PRICE_TTL = TimeSpan.FromMinutes(5);

    public TokenMetadataService(
        ICacheService cache,
        ICoinMarketCapService cmcService,
        ILogger<TokenMetadataService> logger,
        IOptions<AggregationOptions> aggregationOptions)
    {
        _cache = cache;
        _cmcService = cmcService;
        _logger = logger;
        _enableCoinMarketCapLookup = aggregationOptions.Value.EnableCoinMarketCapLookup;
    }

    public async Task<TokenMetadata?> GetTokenMetadataAsync(string mintAddress)
    {
        if (string.IsNullOrWhiteSpace(mintAddress))
            return null;

        try
        {
            // 1. Check Redis cache (in-memory tokens)
            string key = $"{METADATA_PREFIX}{mintAddress.ToLowerInvariant()}";
            string? cached = await _cache.GetAsync<string>(key);
            
            if (cached != null)
            {
                _logger.LogDebug("[TokenMetadata] Cache HIT for mint={Mint}", mintAddress);
                return JsonSerializer.Deserialize<TokenMetadata>(cached);
            }
            
            _logger.LogDebug("[TokenMetadata] Cache MISS for mint={Mint}, fetching from CMC by address...", mintAddress);

            if (_enableCoinMarketCapLookup)
            {
                var metadata = await FetchMetadataFromCMCByAddressAsync(mintAddress);
                
                if (metadata != null)
                {
                    await SetTokenMetadataAsync(mintAddress, metadata);
                    _logger.LogDebug("[TokenMetadata] Fetched and cached metadata from CMC for mint={Mint}, symbol={Symbol}", 
                        mintAddress, metadata.Symbol);
                    return metadata;
                }
            }
            else
            {
                _logger.LogDebug("[TokenMetadata] CMC lookup disabled - skipping external API call");
            }
            
            _logger.LogDebug("[TokenMetadata] No metadata found for mint={Mint}", mintAddress);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Failed to get metadata for mint={Mint}", mintAddress);
            return null;
        }
    }
    
    public async Task<TokenMetadata?> GetTokenMetadataBySymbolAndNameAsync(string symbol, string name)
    {
        if (string.IsNullOrWhiteSpace(symbol) || string.IsNullOrWhiteSpace(name))
            return null;

        try
        {
            // 1. Check Redis cache by symbol+name
            string compositeKey = $"{METADATA_BY_SYMBOL_PREFIX}{symbol.ToUpperInvariant()}:{name}";
            string? cached = await _cache.GetAsync<string>(compositeKey);
            
            if (cached != null)
            {
                _logger.LogDebug("[TokenMetadata] Cross-chain lookup HIT for symbol={Symbol}, name={Name}", 
                    symbol, name);
                return JsonSerializer.Deserialize<TokenMetadata>(cached);
            }
            
            _logger.LogDebug("[TokenMetadata] Cross-chain lookup MISS for symbol={Symbol}, name={Name}, fetching from CMC...", 
                symbol, name);
            
            if (_enableCoinMarketCapLookup)
            {
                var metadata = await FetchMetadataFromCMCBySymbolAsync(symbol);
                
                if (metadata != null)
                {
                    if (metadata.Name?.Equals(name, StringComparison.OrdinalIgnoreCase) == true)
                    {
                        string json = JsonSerializer.Serialize(metadata);
                        await _cache.SetAsync(compositeKey, json, METADATA_TTL);
                        
                        _logger.LogDebug("[TokenMetadata] Fetched and cached metadata from CMC by symbol+name: {Symbol}/{Name}", 
                            symbol, name);
                        return metadata;
                    }
                    
                    _logger.LogDebug("[TokenMetadata] Symbol found but name mismatch: expected={ExpectedName}, got={ActualName}", 
                        name, metadata.Name);
                }
            }
            else
            {
                _logger.LogDebug("[TokenMetadata] CMC lookup disabled - skipping external API call");
            }
            
            _logger.LogDebug("[TokenMetadata] No metadata found for symbol={Symbol}, name={Name}", symbol, name);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Failed to get metadata by symbol={Symbol}, name={Name}", 
                symbol, name);
            return null;
        }
    }
    
    private async Task<TokenMetadata?> FetchMetadataFromCMCByAddressAsync(string mintAddress)
    {
        try
        {
            // CMC API does not support direct Solana mint address lookup
            // Return null to try other strategies
            _logger.LogDebug("[TokenMetadata] CMC does not support Solana mint address lookup: {Mint}", mintAddress);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Error in CMC address lookup for mint={Mint}", mintAddress);
            return null;
        }
    }
    
    private async Task<TokenMetadata?> FetchMetadataFromCMCBySymbolAsync(string symbol)
    {
        try
        {
            _logger.LogDebug("[TokenMetadata] Fetching from CMC by symbol: {Symbol}", symbol);

            var cmcResponse = await _cmcService.GetQuotesLatestV2Async(new[] { symbol });
            
            if (cmcResponse?.Data != null && cmcResponse.Data.TryGetValue(symbol.ToUpperInvariant(), out var quote))
            {
                var metadata = new TokenMetadata
                {
                    Symbol = quote.Symbol,
                    Name = quote.Name,
                    LogoUrl = null
                };

                if (quote.Quote.TryGetValue("USD", out var usdQuote) && usdQuote.Price.HasValue)
                {
                    await SetTokenPriceAsync(symbol, usdQuote.Price.Value);
                    _logger.LogDebug("[TokenMetadata] Cached price for symbol={Symbol}: ${Price}", 
                        symbol, usdQuote.Price.Value);
                }
                
                return metadata;
            }

            _logger.LogDebug("[TokenMetadata] No CMC data found for symbol={Symbol}", symbol);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Error fetching from CMC for symbol={Symbol}", symbol);
            return null;
        }
    }

    public async Task<decimal?> GetTokenPriceAsync(string identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier))
            return null;

        try
        {

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
            // Save with mint address (normalized to lowercase)
            string key = $"{METADATA_PREFIX}{mintAddress.ToLowerInvariant()}";
            string json = JsonSerializer.Serialize(metadata);
            await _cache.SetAsync(key, json, METADATA_TTL);
            
            _logger.LogDebug("[TokenMetadata] Cached metadata for mint={Mint}, symbol={Symbol}, name={Name}", 
                mintAddress, metadata.Symbol, metadata.Name);

            // Also save with composite symbol+name key for cross-chain lookup
            if (!string.IsNullOrWhiteSpace(metadata.Symbol) && !string.IsNullOrWhiteSpace(metadata.Name))
            {
                string compositeKey = $"{METADATA_BY_SYMBOL_PREFIX}{metadata.Symbol.ToUpperInvariant()}:{metadata.Name}";
                await _cache.SetAsync(compositeKey, json, METADATA_TTL);
                
                _logger.LogDebug("[TokenMetadata] Cached metadata for cross-chain lookup: {CompositeKey}", 
                    compositeKey);
            }
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

            string key = $"{PRICE_PREFIX}{identifier.ToLowerInvariant()}";
            await _cache.SetAsync(key, priceUsd.ToString(System.Globalization.CultureInfo.InvariantCulture), PRICE_TTL);
            
            _logger.LogDebug("[TokenPrice] Cached price for identifier={Identifier}, price={Price}", 
                identifier, priceUsd);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenPrice] Failed to cache price for identifier={Identifier}", identifier);
        }
    }
}