using System.Text.Json;
using System.Collections.Concurrent;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Infrastructure.CoinMarketCap;
using DeFi10.API.Configuration;
using Microsoft.Extensions.Options;
using DeFi10.API.Models;
using StackExchange.Redis;

namespace DeFi10.API.Services.Helpers;

/// <summary>
/// Token metadata service with in-memory cache for single-pod deployment.
/// Strategy: Memory -> Redis -> CoinMarketCap -> null
/// 
/// Supports multiple lookup strategies:
/// - By address (contract address)
/// - By symbol
/// - By symbol + name (cross-chain)
/// </summary>
public sealed class TokenMetadataService : ITokenMetadataService
{
    private readonly ICacheService _cache;
    private readonly ICoinMarketCapService _cmcService;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<TokenMetadataService> _logger;
    private readonly bool _enableCoinMarketCapLookup;
    
    // In-memory caches for fast lookup (single pod optimization)
    private readonly ConcurrentDictionary<string, TokenMetadata> _memoryByAddress;
    private readonly ConcurrentDictionary<string, TokenMetadata> _memoryBySymbol;
    private readonly ConcurrentDictionary<string, TokenMetadata> _memoryBySymbolName;
    private readonly ConcurrentDictionary<string, decimal> _memoryPrices;
    private readonly SemaphoreSlim _loadingSemaphore;
    private volatile bool _isInitialized = false;
    
    private const string METADATA_PREFIX = "token:metadata:";
    private const string METADATA_BY_SYMBOL_PREFIX = "token:metadata:symbol:";
    private const string PRICE_PREFIX = "token:price:";
    private static readonly TimeSpan METADATA_TTL = TimeSpan.FromDays(7);
    private static readonly TimeSpan PRICE_TTL = TimeSpan.FromMinutes(5);
    
    // JsonSerializerOptions for flexible deserialization (handles extra properties from legacy data)
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        AllowTrailingCommas = true,
        ReadCommentHandling = JsonCommentHandling.Skip
    };

    public TokenMetadataService(
        ICacheService cache,
        ICoinMarketCapService cmcService,
        IConnectionMultiplexer redis,
        ILogger<TokenMetadataService> logger,
        IOptions<AggregationOptions> aggregationOptions)
    {
        _cache = cache;
        _cmcService = cmcService;
        _redis = redis;
        _logger = logger;
        _enableCoinMarketCapLookup = aggregationOptions.Value.EnableCoinMarketCapLookup;
        
        _memoryByAddress = new ConcurrentDictionary<string, TokenMetadata>(StringComparer.OrdinalIgnoreCase);
        _memoryBySymbol = new ConcurrentDictionary<string, TokenMetadata>(StringComparer.OrdinalIgnoreCase);
        _memoryBySymbolName = new ConcurrentDictionary<string, TokenMetadata>(StringComparer.OrdinalIgnoreCase);
        _memoryPrices = new ConcurrentDictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        _loadingSemaphore = new SemaphoreSlim(1, 1);
    }

    public async Task LoadAllMetadataIntoMemoryAsync()
    {
        if (_isInitialized) return;

        await _loadingSemaphore.WaitAsync();
        try
        {
            if (_isInitialized) return;

            _logger.LogInformation("[TokenMetadata] Loading all metadata from Redis into memory...");
            
            var db = _redis.GetDatabase();
            
            // ? DIAGNOSTIC: Check if Redis is connected
            try
            {
                var pingResult = await db.PingAsync();
                _logger.LogInformation("[TokenMetadata] Redis PING: {Latency}ms", pingResult.TotalMilliseconds);
            }
            catch (Exception pingEx)
            {
                _logger.LogError(pingEx, "[TokenMetadata] Redis PING FAILED - connection issue detected!");
                _isInitialized = true;
                return;
            }
            
            var server = _redis.GetServer(_redis.GetEndPoints().First());
            
            // ? DIAGNOSTIC: Check if server.Keys() is working
            try
            {
                _logger.LogInformation("[TokenMetadata] Redis server: {Server}", server.EndPoint);
                
                // Test with a simple pattern first to see if ANY keys exist
                var allKeysTest = server.Keys(pattern: "*", pageSize: 10).Take(10).ToList();
                _logger.LogInformation("[TokenMetadata] Redis total keys sample (first 10): {Count}", allKeysTest.Count);
                if (allKeysTest.Count > 0)
                {
                    _logger.LogInformation("[TokenMetadata] Sample keys: {Keys}", 
                        string.Join(", ", allKeysTest.Take(5).Select(k => k.ToString())));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[TokenMetadata] Failed to enumerate Redis keys - permissions issue?");
            }
            
            // Load metadata by address AND by symbol+name (composite keys)
            var metadataPattern = $"{METADATA_PREFIX}*";
            _logger.LogInformation("[TokenMetadata] Searching for metadata keys with pattern: {Pattern}", metadataPattern);
            
            var metadataKeys = server.Keys(pattern: metadataPattern).ToList();
            _logger.LogInformation("[TokenMetadata] Found {Count} metadata keys in Redis", metadataKeys.Count);
            
            var loadedByAddress = 0;
            var loadedBySymbolName = 0;
            var skippedInvalid = 0;
            
            foreach (var key in metadataKeys)
            {
                try
                {
                    var json = await db.StringGetAsync(key);
                    if (!json.HasValue) continue;
                    
                    // Try to deserialize with flexible options (handles legacy data)
                    var metadata = TryDeserializeMetadata(json!);
                    if (metadata == null)
                    {
                        skippedInvalid++;
                        continue;
                    }
                    
                    var keyStr = key.ToString();
                    
                    // ? FIX: Detect key type and index accordingly
                    // Key format 1: "token:metadata:{address}" (address-based)
                    // Key format 2: "token:metadata:symbol:{SYMBOL}:{NAME}" (composite)
                    
                    if (keyStr.StartsWith(METADATA_BY_SYMBOL_PREFIX))
                    {
                        // Composite key: token:metadata:symbol:{SYMBOL}:{NAME}
                        var compositeKey = keyStr.Substring(METADATA_BY_SYMBOL_PREFIX.Length);
                        _memoryBySymbolName[compositeKey] = metadata;
                        loadedBySymbolName++;
                        
                        // Also index by symbol alone if available
                        if (!string.IsNullOrEmpty(metadata.Symbol))
                        {
                            _memoryBySymbol.TryAdd(metadata.Symbol, metadata);
                        }
                        
                        _logger.LogDebug("[TokenMetadata] Loaded composite key: {Key}", compositeKey);
                    }
                    else if (keyStr.StartsWith(METADATA_PREFIX))
                    {
                        // Address-based key: token:metadata:{address}
                        var address = keyStr.Substring(METADATA_PREFIX.Length);
                        
                        // Validate it's not a composite key that slipped through
                        if (!address.Contains(':'))
                        {
                            _memoryByAddress[address] = metadata;
                            loadedByAddress++;
                            
                            // Index by symbol if available
                            if (!string.IsNullOrEmpty(metadata.Symbol))
                            {
                                _memoryBySymbol.TryAdd(metadata.Symbol, metadata);
                            }
                            
                            // Index by symbol+name if both available
                            if (!string.IsNullOrEmpty(metadata.Symbol) && !string.IsNullOrEmpty(metadata.Name))
                            {
                                var compositeKey = $"{metadata.Symbol}:{metadata.Name}";
                                _memoryBySymbolName.TryAdd(compositeKey, metadata);
                            }
                            
                            _logger.LogDebug("[TokenMetadata] Loaded address key: {Address}", address);
                        }
                        else
                        {
                            _logger.LogWarning("[TokenMetadata] Skipping ambiguous key (contains ':'): {Key}", keyStr);
                            skippedInvalid++;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "[TokenMetadata] Failed to load metadata key: {Key}", key);
                    skippedInvalid++;
                }
            }
            
            // Load prices
            var pricePattern = $"{PRICE_PREFIX}*";
            _logger.LogInformation("[TokenMetadata] Searching for price keys with pattern: {Pattern}", pricePattern);
            
            var priceKeys = server.Keys(pattern: pricePattern).ToList();
            _logger.LogInformation("[TokenMetadata] Found {Count} price keys in Redis", priceKeys.Count);
            
            var loadedPrices = 0;
            
            foreach (var key in priceKeys)
            {
                try
                {
                    var value = await db.StringGetAsync(key);
                    if (!value.HasValue) continue;
                    
                    if (decimal.TryParse(value!, out var price))
                    {
                        var identifier = key.ToString().Substring(PRICE_PREFIX.Length);
                        _memoryPrices[identifier] = price;
                        loadedPrices++;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[TokenMetadata] Failed to load price key: {Key}", key);
                }
            }
            
            _isInitialized = true;
            
            var totalLoaded = loadedByAddress + loadedBySymbolName;
            
            if (totalLoaded == 0 && loadedPrices == 0)
            {
                _logger.LogWarning(
                    "[TokenMetadata] ?? WARMUP EMPTY: No metadata or prices found in Redis! " +
                    "This is expected on first run. Data will be populated as wallets are aggregated.");
            }
            else
            {
                _logger.LogInformation(
                    "[TokenMetadata] SUCCESS: Loaded {MetadataCount} metadata entries ({AddressCount} by address, {CompositeCount} by symbol+name) and {PriceCount} prices into memory. " +
                    "Indexed: {ByAddress} addresses, {BySymbol} symbols, {BySymbolName} symbol+name pairs. " +
                    "Skipped {SkippedCount} invalid/legacy entries.",
                    totalLoaded, loadedByAddress, loadedBySymbolName, loadedPrices, 
                    _memoryByAddress.Count, _memoryBySymbol.Count, _memoryBySymbolName.Count, skippedInvalid);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] ERROR: Failed to load metadata into memory");
            _isInitialized = true; // Mark as initialized to avoid blocking the app
        }
        finally
        {
            _loadingSemaphore.Release();
        }
    }
    
    /// <summary>
    /// Tries to deserialize token metadata from JSON, handling legacy formats gracefully.
    /// Returns null if the data is invalid or incompatible.
    /// </summary>
    private TokenMetadata? TryDeserializeMetadata(string json)
    {
        try
        {
            // First, try standard deserialization
            var metadata = JsonSerializer.Deserialize<TokenMetadata>(json, JsonOptions);
            if (metadata != null && (!string.IsNullOrEmpty(metadata.Symbol) || !string.IsNullOrEmpty(metadata.Name)))
            {
                return metadata;
            }
            
            // If that fails, try to parse as a generic JSON object and extract known fields
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            
            var symbol = root.TryGetProperty("Symbol", out var symProp) ? symProp.GetString() : 
                         root.TryGetProperty("symbol", out var symProp2) ? symProp2.GetString() : null;
            
            var name = root.TryGetProperty("Name", out var nameProp) ? nameProp.GetString() :
                       root.TryGetProperty("name", out var nameProp2) ? nameProp2.GetString() : null;
            
            var logoUrl = root.TryGetProperty("LogoUrl", out var logoProp) ? logoProp.GetString() :
                          root.TryGetProperty("logoUrl", out var logoProp2) ? logoProp2.GetString() :
                          root.TryGetProperty("logo", out var logoProp3) ? logoProp3.GetString() : null;
            
            // Valid metadata must have at least symbol or name
            if (!string.IsNullOrEmpty(symbol) || !string.IsNullOrEmpty(name))
            {
                return new TokenMetadata
                {
                    Symbol = symbol ?? string.Empty,
                    Name = name ?? string.Empty,
                    LogoUrl = logoUrl
                };
            }
            
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "[TokenMetadata] Could not deserialize metadata, skipping entry");
            return null;
        }
    }

    public async Task<TokenMetadata?> GetTokenMetadataAsync(string mintAddress)
    {
        if (string.IsNullOrWhiteSpace(mintAddress))
            return null;

        // Ensure cache is initialized
        if (!_isInitialized)
            await LoadAllMetadataIntoMemoryAsync();

        var normalizedAddress = mintAddress.ToLowerInvariant();

        try
        {
            // 1. Check in-memory cache (FASTEST - no network)
            if (_memoryByAddress.TryGetValue(normalizedAddress, out var memoryMetadata))
            {
                _logger.LogDebug("[TokenMetadata] MEMORY HIT for address={Address}", mintAddress);
                return memoryMetadata;
            }
            
            _logger.LogDebug("[TokenMetadata] Memory cache MISS for address={Address}, checking Redis...", mintAddress);

            // 2. Check Redis cache (FALLBACK - network call)
            string key = $"{METADATA_PREFIX}{normalizedAddress}";
            string? cached = await _cache.GetAsync<string>(key);
            
            if (cached != null)
            {
                var metadata = TryDeserializeMetadata(cached);
                if (metadata != null)
                {
                    // Add to memory cache for next time
                    _memoryByAddress[normalizedAddress] = metadata;
                    
                    if (!string.IsNullOrEmpty(metadata.Symbol))
                        _memoryBySymbol.TryAdd(metadata.Symbol, metadata);
                    
                    if (!string.IsNullOrEmpty(metadata.Symbol) && !string.IsNullOrEmpty(metadata.Name))
                    {
                        var compositeKey = $"{metadata.Symbol}:{metadata.Name}";
                        _memoryBySymbolName.TryAdd(compositeKey, metadata);
                    }
                    
                    _logger.LogDebug("[TokenMetadata] Redis cache HIT for address={Address}, added to memory", mintAddress);
                    return metadata;
                }
            }
            
            _logger.LogDebug("[TokenMetadata] Redis cache MISS for address={Address}", mintAddress);

            // 3. Try CoinMarketCap (LAST RESORT - external API)
            if (_enableCoinMarketCapLookup)
            {
                var cmcMetadata = await FetchMetadataFromCMCByAddressAsync(normalizedAddress);
                
                if (cmcMetadata != null)
                {
                    await SetTokenMetadataAsync(normalizedAddress, cmcMetadata);
                    _logger.LogDebug("[TokenMetadata] Fetched from CMC for address={Address}, symbol={Symbol}", 
                        mintAddress, cmcMetadata.Symbol);
                    return cmcMetadata;
                }
            }
            
            _logger.LogDebug("[TokenMetadata] No metadata found for address={Address}", mintAddress);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Failed to get metadata for address={Address}", mintAddress);
            return null;
        }
    }
    
    public async Task<TokenMetadata?> GetTokenMetadataBySymbolAndNameAsync(string symbol, string name)
    {
        if (string.IsNullOrWhiteSpace(symbol) || string.IsNullOrWhiteSpace(name))
            return null;

        // Ensure cache is initialized
        if (!_isInitialized)
            await LoadAllMetadataIntoMemoryAsync();

        var compositeKey = $"{symbol.ToUpperInvariant()}:{name.ToUpperInvariant()}";

        try
        {
            // 1. Check in-memory cache by symbol+name (FASTEST)
            if (_memoryBySymbolName.TryGetValue(compositeKey, out var memoryMetadata))
            {
                _logger.LogDebug("[TokenMetadata] MEMORY HIT for symbol+name={Symbol}/{Name}", symbol, name);
                return memoryMetadata;
            }
            
            // 2. Check in-memory cache by symbol only (FALLBACK)
            if (_memoryBySymbol.TryGetValue(symbol, out var symbolMetadata))
            {
                if (symbolMetadata.Name?.Equals(name, StringComparison.OrdinalIgnoreCase) == true)
                {
                    _logger.LogDebug("[TokenMetadata] Memory cache HIT by symbol for {Symbol}/{Name}", symbol, name);
                    _memoryBySymbolName.TryAdd(compositeKey, symbolMetadata);
                    return symbolMetadata;
                }
            }
            
            _logger.LogDebug("[TokenMetadata] Memory cache MISS for symbol+name={Symbol}/{Name}, checking Redis...", symbol, name);

            // 3. Check Redis cache (FALLBACK)
            string redisKey = $"{METADATA_BY_SYMBOL_PREFIX}{compositeKey}";
            string? cached = await _cache.GetAsync<string>(redisKey);
            
            if (cached != null)
            {
                var metadata = TryDeserializeMetadata(cached);
                if (metadata != null)
                {
                    // Add to memory cache
                    _memoryBySymbolName[compositeKey] = metadata;
                    if (!string.IsNullOrEmpty(metadata.Symbol))
                        _memoryBySymbol.TryAdd(metadata.Symbol, metadata);
                    
                    _logger.LogDebug("[TokenMetadata] Redis cache HIT for symbol+name={Symbol}/{Name}, added to memory", symbol, name);
                    return metadata;
                }
            }
            
            _logger.LogDebug("[TokenMetadata] Redis cache MISS for symbol+name={Symbol}/{Name}", symbol, name);
            
            // 4. Try CoinMarketCap (LAST RESORT)
            if (_enableCoinMarketCapLookup)
            {
                var cmcMetadata = await FetchMetadataFromCMCBySymbolAsync(symbol);
                
                if (cmcMetadata != null && cmcMetadata.Name?.Equals(name, StringComparison.OrdinalIgnoreCase) == true)
                {
                    // Save to Redis and memory
                    string json = JsonSerializer.Serialize(cmcMetadata, JsonOptions);
                    await _cache.SetAsync(redisKey, json, METADATA_TTL);
                    
                    _memoryBySymbolName[compositeKey] = cmcMetadata;
                    if (!string.IsNullOrEmpty(cmcMetadata.Symbol))
                        _memoryBySymbol.TryAdd(cmcMetadata.Symbol, cmcMetadata);
                    
                    _logger.LogDebug("[TokenMetadata] Fetched from CMC by symbol+name: {Symbol}/{Name}", symbol, name);
                    return cmcMetadata;
                }
            }
            
            _logger.LogDebug("[TokenMetadata] No metadata found for symbol+name={Symbol}/{Name}", symbol, name);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Failed to get metadata by symbol={Symbol}, name={Name}", symbol, name);
            return null;
        }
    }
    
    private async Task<TokenMetadata?> FetchMetadataFromCMCByAddressAsync(string mintAddress)
    {
        try
        {
            // CMC API does not support direct address lookup
            _logger.LogDebug("[TokenMetadata] CMC does not support address lookup: {Address}", mintAddress);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Error in CMC address lookup for address={Address}", mintAddress);
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
                    _logger.LogDebug("[TokenMetadata] Cached price for symbol={Symbol}: ${Price}", symbol, usdQuote.Price.Value);
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

        // Ensure cache is initialized
        if (!_isInitialized)
            await LoadAllMetadataIntoMemoryAsync();

        var normalizedId = identifier.ToLowerInvariant();

        try
        {
            // 1. Check in-memory cache (FASTEST)
            if (_memoryPrices.TryGetValue(normalizedId, out var memoryPrice))
            {
                _logger.LogDebug("[TokenPrice] MEMORY HIT for identifier={Identifier}, price={Price}", identifier, memoryPrice);
                return memoryPrice;
            }
            
            _logger.LogDebug("[TokenPrice] Memory cache MISS for identifier={Identifier}, checking Redis...", identifier);

            // 2. Check Redis cache (FALLBACK)
            string key = $"{PRICE_PREFIX}{normalizedId}";
            var cached = await _cache.GetAsync<string>(key);
            
            if (cached != null && decimal.TryParse(cached, out decimal price))
            {
                // Add to memory cache
                _memoryPrices[normalizedId] = price;
                _logger.LogDebug("[TokenPrice] Redis cache HIT for identifier={Identifier}, price={Price}, added to memory", identifier, price);
                return price;
            }
            
            _logger.LogDebug("[TokenPrice] Redis cache MISS for identifier={Identifier}", identifier);
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

        var normalizedAddress = mintAddress.ToLowerInvariant();

        try
        {
            // 1. Save to Redis for persistence
            string key = $"{METADATA_PREFIX}{normalizedAddress}";
            string json = JsonSerializer.Serialize(metadata, JsonOptions);
            await _cache.SetAsync(key, json, METADATA_TTL);
            
            // 2. Add to memory cache immediately
            _memoryByAddress[normalizedAddress] = metadata;
            
            if (!string.IsNullOrEmpty(metadata.Symbol))
            {
                _memoryBySymbol.TryAdd(metadata.Symbol, metadata);
            }
            
            // 3. Save composite symbol+name key
            if (!string.IsNullOrWhiteSpace(metadata.Symbol) && !string.IsNullOrWhiteSpace(metadata.Name))
            {
                var compositeKey = $"{metadata.Symbol.ToUpperInvariant()}:{metadata.Name}";
                string compositeRedisKey = $"{METADATA_BY_SYMBOL_PREFIX}{compositeKey}";
                await _cache.SetAsync(compositeRedisKey, json, METADATA_TTL);
                
                _memoryBySymbolName.TryAdd(compositeKey, metadata);
                
                _logger.LogDebug("[TokenMetadata] Cached metadata for address={Address}, symbol={Symbol}, name={Name} (Redis + Memory)", 
                    mintAddress, metadata.Symbol, metadata.Name);
            }
            else
            {
                _logger.LogDebug("[TokenMetadata] Cached metadata for address={Address} (Redis + Memory)", mintAddress);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Failed to cache metadata for address={Address}", mintAddress);
        }
    }

    public async Task SetTokenPriceAsync(string identifier, decimal priceUsd)
    {
        if (string.IsNullOrWhiteSpace(identifier))
            return;

        var normalizedId = identifier.ToLowerInvariant();

        try
        {
            // 1. Save to Redis for persistence
            string key = $"{PRICE_PREFIX}{normalizedId}";
            await _cache.SetAsync(key, priceUsd.ToString(System.Globalization.CultureInfo.InvariantCulture), PRICE_TTL);
            
            // 2. Add to memory cache immediately
            _memoryPrices[normalizedId] = priceUsd;
            
            _logger.LogDebug("[TokenPrice] Cached price for identifier={Identifier}, price={Price} (Redis + Memory)", identifier, priceUsd);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenPrice] Failed to cache price for identifier={Identifier}", identifier);
        }
    }
    
    public (int addresses, int symbols, int symbolNames, int prices) GetCacheStats()
    {
        return (
            _memoryByAddress.Count,
            _memoryBySymbol.Count,
            _memoryBySymbolName.Count,
            _memoryPrices.Count
        );
    }
}
