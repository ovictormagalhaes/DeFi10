using System.Collections.Concurrent;
using System.Linq;
using System.Text.Json;
using DeFi10.API.Configuration;
using DeFi10.API.Events;
using DeFi10.API.Models;
using DeFi10.API.Models.Persistence;
using DeFi10.API.Repositories.Interfaces;
using DeFi10.API.Services.Events;
using DeFi10.API.Services.Infrastructure.CoinMarketCap;
using DeFi10.API.Services.Interfaces;
using Microsoft.Extensions.Options;
using System.Threading;

namespace DeFi10.API.Services.Helpers;

public sealed class TokenMetadataService : ITokenMetadataService
{
    private readonly ITokenMetadataRepository _repository;
    private readonly ICacheService _priceCache; // Still use Redis for prices (short TTL)
    private readonly ICoinMarketCapService _cmcService;
    private readonly ITokenPriceUpdatePublisher _priceUpdatePublisher;
    private readonly ILogger<TokenMetadataService> _logger;
    private readonly bool _enableCoinMarketCapLookup;
    private readonly TokenCacheOptions _cacheOptions;

    // In-memory caches for fast lookup (single pod optimization)
    private readonly ConcurrentDictionary<string, TokenMetadata> _memoryByChainAddress; // "chainId:address" -> metadata
    private readonly ConcurrentDictionary<string, TokenMetadata> _memoryBySymbol; // "SYMBOL" -> metadata
    private readonly ConcurrentDictionary<string, TokenMetadata> _memoryBySymbolName; // "SYMBOL:NAME" -> metadata
    private readonly ConcurrentDictionary<string, decimal> _memoryPrices;
    private readonly SemaphoreSlim _loadingSemaphore;
    private volatile bool _isInitialized = false;

    private readonly ConcurrentDictionary<string, TokenPriceUpdateRequest> _staleTokens;

    private const string PRICE_PREFIX = "token:price:";
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
        ITokenMetadataRepository repository,
        ICacheService priceCache,
        ICoinMarketCapService cmcService,
        ITokenPriceUpdatePublisher priceUpdatePublisher,
        ILogger<TokenMetadataService> logger,
        IOptions<AggregationOptions> aggregationOptions,
        IOptions<TokenCacheOptions> cacheOptions)
    {
        _repository = repository;
        _priceCache = priceCache;
        _cmcService = cmcService;
        _priceUpdatePublisher = priceUpdatePublisher;
        _logger = logger;
        _enableCoinMarketCapLookup = aggregationOptions.Value.EnableCoinMarketCapLookup;
        _cacheOptions = cacheOptions.Value;

        _memoryByChainAddress = new ConcurrentDictionary<string, TokenMetadata>(StringComparer.OrdinalIgnoreCase);
        _memoryBySymbol = new ConcurrentDictionary<string, TokenMetadata>(StringComparer.OrdinalIgnoreCase);
        _memoryBySymbolName = new ConcurrentDictionary<string, TokenMetadata>(StringComparer.OrdinalIgnoreCase);
        _memoryPrices = new ConcurrentDictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        _loadingSemaphore = new SemaphoreSlim(1, 1);

        _staleTokens = new ConcurrentDictionary<string, TokenPriceUpdateRequest>(StringComparer.OrdinalIgnoreCase);
    }

    public async Task LoadAllMetadataIntoMemoryAsync()
    {
        if (_isInitialized) return;

        await _loadingSemaphore.WaitAsync();
        try
        {
            if (_isInitialized) return;

            _logger.LogInformation("[TokenMetadata] Loading all metadata from MongoDB into memory...");

            var allTokens = await _repository.GetAllAsync();

            if (allTokens.Count == 0)
            {
                _logger.LogWarning("[TokenMetadata] WARMUP EMPTY: No metadata found in MongoDB. This is expected on first run.");
                _isInitialized = true;
                return;
            }

            var loadedByChainAddress = 0;
            var loadedBySymbolName = 0;
            var loadedBySymbol = 0;

            foreach (var doc in allTokens)
            {
                try
                {
                    var metadata = new TokenMetadata
                    {
                        Symbol = doc.Symbol,
                        Name = doc.Name,
                        LogoUrl = doc.LogoUrl,
                        PriceUsd = doc.PriceUsd,
                        UpdatedAt = doc.UpdatedAt
                    };

                    // Index by chain + address
                    var chainAddressKey = $"{doc.ChainId}:{doc.Address}";
                    _memoryByChainAddress[chainAddressKey] = metadata;
                    loadedByChainAddress++;

                    // Index by symbol
                    if (!string.IsNullOrEmpty(doc.Symbol))
                    {
                        _memoryBySymbol.TryAdd(doc.Symbol, metadata);
                        loadedBySymbol++;
                    }

                    // Index by symbol + name
                    if (!string.IsNullOrEmpty(doc.Symbol) && !string.IsNullOrEmpty(doc.Name))
                    {
                        var compositeKey = $"{doc.Symbol}:{doc.Name}";
                        _memoryBySymbolName.TryAdd(compositeKey, metadata);
                        loadedBySymbolName++;
                    }

                    _logger.LogDebug("[TokenMetadata] Loaded: chain={ChainId}, address={Address}, symbol={Symbol}, price={Price}",
                        doc.ChainId, doc.Address, doc.Symbol, doc.PriceUsd);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[TokenMetadata] Failed to load token: chain={ChainId}, address={Address}",
                        doc.ChainId, doc.Address);
                }
            }

            _isInitialized = true;

            _logger.LogInformation(
                "[TokenMetadata] SUCCESS: Loaded {TotalCount} tokens into memory. Indexed: {ByChainAddress} by chain+address, {BySymbol} by symbol, {BySymbolName} by symbol+name.",
                allTokens.Count, loadedByChainAddress, _memoryBySymbol.Count, _memoryBySymbolName.Count);
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

    public async Task<TokenMetadata?> GetTokenMetadataAsync(Chain chain, string address)
    {
        if (string.IsNullOrWhiteSpace(address))
            return null;

        if (!_isInitialized)
            await LoadAllMetadataIntoMemoryAsync();

        var normalizedAddress = address.ToLowerInvariant();
        var chainAddressKey = $"{(int)chain}:{normalizedAddress}";

        try
        {
            if (_memoryByChainAddress.TryGetValue(chainAddressKey, out var memoryMetadata))
            {
                _logger.LogDebug("[TokenMetadata] MEMORY HIT for chain={Chain}, address={Address}", chain, address);

                if (ShouldUpdatePrice(memoryMetadata))
                {
                    // collect for batch publishing
                    var key = chainAddressKey;
                    _staleTokens.TryAdd(key, new TokenPriceUpdateRequest
                    {
                        Chain = chain,
                        Address = normalizedAddress,
                        Symbol = memoryMetadata.Symbol ?? string.Empty,
                        CurrentPrice = memoryMetadata.PriceUsd ?? 0m
                    });
                }

                return memoryMetadata;
            }

            _logger.LogDebug("[TokenMetadata] Memory MISS for chain={Chain}, address={Address}, checking MongoDB...", chain, address);

            var doc = await _repository.GetByChainAndAddressAsync((int)chain, normalizedAddress);

            if (doc != null)
            {
                var metadata = new TokenMetadata
                {
                    Symbol = doc.Symbol,
                    Name = doc.Name,
                    LogoUrl = doc.LogoUrl,
                    PriceUsd = doc.PriceUsd,
                    UpdatedAt = doc.UpdatedAt
                };

                _memoryByChainAddress[chainAddressKey] = metadata;

                if (!string.IsNullOrEmpty(metadata.Symbol))
                    _memoryBySymbol.TryAdd(metadata.Symbol, metadata);

                if (!string.IsNullOrEmpty(metadata.Symbol) && !string.IsNullOrEmpty(metadata.Name))
                {
                    var compositeKey = $"{metadata.Symbol}:{metadata.Name}";
                    _memoryBySymbolName.TryAdd(compositeKey, metadata);
                }

                if (ShouldUpdatePrice(metadata))
                {
                    var key = chainAddressKey;
                    _staleTokens.TryAdd(key, new TokenPriceUpdateRequest
                    {
                        Chain = chain,
                        Address = normalizedAddress,
                        Symbol = metadata.Symbol ?? string.Empty,
                        CurrentPrice = metadata.PriceUsd ?? 0m
                    });
                }

                _logger.LogDebug("[TokenMetadata] MongoDB HIT for chain={Chain}, address={Address}, added to memory", 
                    chain, address);
                return metadata;
            }

            _logger.LogDebug("[TokenMetadata] MongoDB MISS for chain={Chain}, address={Address}", chain, address);

            if (_enableCoinMarketCapLookup)
            {
                _logger.LogDebug("[TokenMetadata] CMC does not support address lookup");
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Failed to get metadata for chain={Chain}, address={Address}", 
                chain, address);
            return null;
        }
    }

    private bool ShouldUpdatePrice(TokenMetadata metadata)
    {
        if (!_cacheOptions.EnableAutoPriceUpdate)
            return false;

        if (!metadata.UpdatedAt.HasValue)
            return true;

        if (!metadata.PriceUsd.HasValue || metadata.PriceUsd.Value <= 0)
            return true;

        var elapsed = DateTime.UtcNow - metadata.UpdatedAt.Value;
        return elapsed >= TimeSpan.FromMinutes(_cacheOptions.PriceUpdateIntervalMinutes);
    }

    public async Task FlushStaleTokensAsync()
    {
        // Snapshot tokens to process
        var tokens = _staleTokens.Values.ToList();
        if (tokens == null || tokens.Count == 0)
        {
            _logger.LogDebug("[TokenMetadata] No stale tokens to flush");
            return;
        }

        // Remove entries from the pending dictionary (we'll re-add on failure)
        foreach (var k in tokens.Select(t => $"{(int)t.Chain}:{t.Address}"))
            _staleTokens.TryRemove(k, out _);

        // Ensure cache is initialized
        if (!_isInitialized)
            await LoadAllMetadataIntoMemoryAsync();

        try
        {
            // Prepare symbol list for CMC lookup
            var symbols = tokens
                .Select(t => t.Symbol)
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var cmcResp = symbols.Count > 0 ? await _cmcService.GetQuotesLatestV2Async(symbols) : null;
            var cmcData = cmcResp?.Data;

            var updatesForEvent = new List<TokenPriceUpdateRequest>();

            foreach (var t in tokens)
            {
                try
                {
                    if (string.IsNullOrWhiteSpace(t.Symbol))
                    {
                        _logger.LogDebug("[TokenMetadata] Skipping stale token without symbol: {Chain}:{Address}", (int)t.Chain, t.Address);
                        continue;
                    }

                    var keySym = t.Symbol.ToUpperInvariant();
                    decimal? price = null;

                    if (cmcData != null && cmcData.TryGetValue(keySym, out var quote))
                    {
                        if (quote.Quote.TryGetValue("USD", out var usdQuote) && usdQuote.Price.HasValue)
                        {
                            price = usdQuote.Price.Value;
                        }
                    }

                    if (!price.HasValue || price.Value <= 0)
                    {
                        _logger.LogDebug("[TokenMetadata] No valid CMC price for {Symbol}, skipping update", t.Symbol);
                        continue;
                    }

                    // 1) Update memory first
                    var chainAddressKey = $"{(int)t.Chain}:{t.Address}";
                    if (_memoryByChainAddress.TryGetValue(chainAddressKey, out var mem))
                    {
                        mem.PriceUsd = price.Value;
                        mem.UpdatedAt = DateTime.UtcNow;
                        _memoryByChainAddress[chainAddressKey] = mem;
                    }

                    // also update price caches (Redis + memory)
                    try { await SetTokenPriceAsync(t.Symbol, price.Value); } catch (Exception ex) { _logger.LogDebug(ex, "[TokenMetadata] Failed to set token price cache for {Symbol}", t.Symbol); }

                    // 2) Add to event list to update DB
                    updatesForEvent.Add(new TokenPriceUpdateRequest
                    {
                        Chain = t.Chain,
                        Address = t.Address,
                        Symbol = t.Symbol,
                        CurrentPrice = price.Value
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[TokenMetadata] Error processing stale token {Token}", t.GetDeduplicationKey());
                }
            }

            if (updatesForEvent.Count == 0)
            {
                _logger.LogDebug("[TokenMetadata] No valid price updates to publish");
                return;
            }

            // Deduplicate
            var unique = updatesForEvent.GroupBy(x => x.GetDeduplicationKey(), StringComparer.OrdinalIgnoreCase).Select(g => g.First()).ToList();

            var evt = new TokenPriceUpdateEvent
            {
                Tokens = unique,
                RequestedAt = DateTime.UtcNow,
                Source = "UserRequest"
            };

            await _priceUpdatePublisher.PublishPriceUpdateEventAsync(evt);
            _logger.LogInformation("[TokenMetadata] Published batch event with {Count} tokens", unique.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Failed to publish batch price update event");

            // On failure, restore tokens so they'll be retried later
            foreach (var t in tokens)
            {
                var k = $"{(int)t.Chain}:{t.Address}";
                _staleTokens.TryAdd(k, t);
            }
        }
    }

    public async Task<TokenMetadata?> GetTokenMetadataBySymbolAndNameAsync(string symbol, string name)
    {
        if (string.IsNullOrWhiteSpace(symbol) || string.IsNullOrWhiteSpace(name))
            return null;

        if (!_isInitialized)
            await LoadAllMetadataIntoMemoryAsync();

        var compositeKey = $"{symbol.ToUpperInvariant()}:{name.ToUpperInvariant()}";

        try
        {
            if (_memoryBySymbolName.TryGetValue(compositeKey, out var memoryMetadata))
            {
                _logger.LogDebug("[TokenMetadata] MEMORY HIT for symbol+name={Symbol}/{Name}", symbol, name);
                return memoryMetadata;
            }

            if (_memoryBySymbol.TryGetValue(symbol, out var symbolMetadata) &&
                symbolMetadata.Name?.Equals(name, StringComparison.OrdinalIgnoreCase) == true)
            {
                _memoryBySymbolName.TryAdd(compositeKey, symbolMetadata);
                return symbolMetadata;
            }

            var docs = await _repository.GetBySymbolAndNameAsync(symbol, name);

            if (docs.Count > 0)
            {
                var doc = docs.First();
                var metadata = new TokenMetadata
                {
                    Symbol = doc.Symbol,
                    Name = doc.Name,
                    LogoUrl = doc.LogoUrl,
                    PriceUsd = doc.PriceUsd,
                    UpdatedAt = doc.UpdatedAt
                };

                _memoryBySymbolName[compositeKey] = metadata;
                if (!string.IsNullOrEmpty(metadata.Symbol))
                    _memoryBySymbol.TryAdd(metadata.Symbol, metadata);

                return metadata;
            }

            if (_enableCoinMarketCapLookup)
            {
                var cmcMetadata = await FetchMetadataFromCMCBySymbolAsync(symbol);

                if (cmcMetadata != null && cmcMetadata.Name?.Equals(name, StringComparison.OrdinalIgnoreCase) == true)
                {
                    _memoryBySymbolName[compositeKey] = cmcMetadata;
                    if (!string.IsNullOrEmpty(cmcMetadata.Symbol))
                        _memoryBySymbol.TryAdd(cmcMetadata.Symbol, cmcMetadata);

                    return cmcMetadata;
                }
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Failed to get metadata by symbol={Symbol}, name={Name}", symbol, name);
            return null;
        }
    }

    private async Task<TokenMetadata?> FetchMetadataFromCMCBySymbolAsync(string symbol)
    {
        try
        {
            var cleanSymbol = symbol;
            if (symbol.Contains(':'))
            {
                cleanSymbol = symbol.Split(':')[0];
            }

            if (string.IsNullOrWhiteSpace(cleanSymbol) || !IsAlphanumeric(cleanSymbol))
            {
                return null;
            }

            var cmcResponse = await _cmcService.GetQuotesLatestV2Async(new[] { cleanSymbol });

            if (cmcResponse?.Data != null &&
                cmcResponse.Data.TryGetValue(cleanSymbol.ToUpperInvariant(), out var quote))
            {
                var metadata = new TokenMetadata
                {
                    Symbol = quote.Symbol,
                    Name = quote.Name,
                    LogoUrl = null,
                    PriceUsd = quote.Quote.TryGetValue("USD", out var usdQuote) ? usdQuote.Price : null,
                    UpdatedAt = DateTime.UtcNow
                };

                if (metadata.PriceUsd.HasValue)
                {
                    await SetTokenPriceAsync(cleanSymbol, metadata.PriceUsd.Value);
                }

                return metadata;
            }

            return null;
        }
        catch (Exception)
        {
            return null;
        }
    }

    private static bool IsAlphanumeric(string value) =>
        !string.IsNullOrEmpty(value) && value.All(char.IsLetterOrDigit);

    public async Task<decimal?> GetTokenPriceAsync(string identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier))
            return null;

        if (!_isInitialized)
            await LoadAllMetadataIntoMemoryAsync();

        var normalizedId = identifier.ToLowerInvariant();

        try
        {
            if (_memoryPrices.TryGetValue(normalizedId, out var memoryPrice))
            {
                return memoryPrice;
            }

            string key = $"{PRICE_PREFIX}{normalizedId}";
            var cached = await _priceCache.GetAsync<string>(key);

            if (cached != null && decimal.TryParse(cached, out decimal price))
            {
                _memoryPrices[normalizedId] = price;
                return price;
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenPrice] Failed to get price for identifier={Identifier}", identifier);
            return null;
        }
    }

    public async Task SetTokenMetadataAsync(Chain chain, string address, TokenMetadata metadata)
    {
        if (string.IsNullOrWhiteSpace(address) || metadata == null)
            return;

        if (metadata.PriceUsd == null || metadata.PriceUsd <= 0)
        {
            _logger.LogDebug("[TokenMetadata] Skipping MongoDB save for token with zero/null price: chain={Chain}, address={Address}, symbol={Symbol}", 
                chain, address, metadata.Symbol);
            return;
        }

        var normalizedAddress = address.ToLowerInvariant();
        var chainAddressKey = $"{(int)chain}:{normalizedAddress}";

        try
        {
            var now = DateTime.UtcNow;
            var doc = new TokenMetadataDocument
            {
                Id = Guid.NewGuid(),
                Symbol = metadata.Symbol?.ToUpperInvariant() ?? string.Empty,
                Name = metadata.Name?.ToUpperInvariant() ?? string.Empty,
                LogoUrl = metadata.LogoUrl,
                ChainId = (int)chain,
                Address = normalizedAddress,
                PriceUsd = metadata.PriceUsd,
                CreatedAt = now,
                UpdatedAt = now
            };

            await _repository.UpsertAsync(doc);

            metadata.UpdatedAt = now;
            _memoryByChainAddress[chainAddressKey] = metadata;

            if (!string.IsNullOrEmpty(metadata.Symbol))
            {
                _memoryBySymbol.TryAdd(metadata.Symbol, metadata);
            }

            if (!string.IsNullOrWhiteSpace(metadata.Symbol) && !string.IsNullOrWhiteSpace(metadata.Name))
            {
                var compositeKey = $"{metadata.Symbol.ToUpperInvariant()}:{metadata.Name.ToUpperInvariant()}";
                _memoryBySymbolName.TryAdd(compositeKey, metadata);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadata] Failed to cache metadata for chain={Chain}, address={Address}", chain, address);
        }
    }

    public async Task SetTokenPriceAsync(string identifier, decimal priceUsd)
    {
        if (string.IsNullOrWhiteSpace(identifier))
            return;

        var normalizedId = identifier.ToLowerInvariant();

        try
        {
            string key = $"{PRICE_PREFIX}{normalizedId}";
            await _priceCache.SetAsync(key, priceUsd.ToString(System.Globalization.CultureInfo.InvariantCulture), PRICE_TTL);

            _memoryPrices[normalizedId] = priceUsd;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenPrice] Failed to cache price for identifier={Identifier}", identifier);
        }
    }
}
