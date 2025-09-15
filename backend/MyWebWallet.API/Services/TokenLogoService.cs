using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using StackExchange.Redis;
using System.Collections.Concurrent;

namespace MyWebWallet.API.Services;

public class TokenLogoService : ITokenLogoService
{
    private readonly IDatabase _database;
    private readonly IConfiguration _configuration;
    
    // In-memory cache using ConcurrentDictionary for thread safety
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, string>> _memoryCache;
    private readonly SemaphoreSlim _loadingSemaphore;
    private readonly string _tokenLogoKeyPrefix;
    private readonly TimeSpan _tokenLogoExpiration;
    private volatile bool _isInitialized = false;

    public TokenLogoService(IConnectionMultiplexer redis, IConfiguration configuration)
    {
        _database = redis.GetDatabase();
        _configuration = configuration;
        _memoryCache = new ConcurrentDictionary<string, ConcurrentDictionary<string, string>>();
        _loadingSemaphore = new SemaphoreSlim(1, 1);
        _tokenLogoKeyPrefix = configuration["Redis:TokenLogoKeyPrefix"] ?? "token_logo:";
        
        // Get token logo expiration from configuration or default to 7 days
        var tokenLogoExpirationConfig = configuration["Redis:TokenLogoExpiration"];
        _tokenLogoExpiration = !string.IsNullOrEmpty(tokenLogoExpirationConfig) 
            ? TimeSpan.Parse(tokenLogoExpirationConfig) 
            : TimeSpan.FromDays(7);
    }

    public async Task<string?> GetTokenLogoAsync(string tokenAddress, Chain chain)
    {
        if (!_isInitialized)
        {
            await LoadAllTokensIntoMemoryAsync();
        }

        var chainKey = GetChainKey(chain);
        var normalizedAddress = NormalizeAddress(tokenAddress);

        // Try memory cache first (fastest)
        if (_memoryCache.TryGetValue(chainKey, out var chainCache) && 
            chainCache.TryGetValue(normalizedAddress, out var logoUrl))
        {
            return logoUrl;
        }

        // Try Redis if not in memory (fallback)
        try
        {
            var redisKey = GenerateRedisKey(tokenAddress, chain);
            var redisValue = await _database.StringGetAsync(redisKey);
            
            if (redisValue.HasValue)
            {
                // Add to memory cache for future requests
                EnsureChainCache(chainKey);
                _memoryCache[chainKey][normalizedAddress] = redisValue!;
                return redisValue!;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: TokenLogoService: Failed to get from Redis: {ex.Message}");
        }

        return null;
    }

    public async Task SetTokenLogoAsync(string tokenAddress, Chain chain, string logoUrl)
    {
        var chainKey = GetChainKey(chain);
        var normalizedAddress = NormalizeAddress(tokenAddress);
        
        try
        {
            // Save to Redis first with configurable expiration for token logos
            var redisKey = GenerateRedisKey(tokenAddress, chain);
            await _database.StringSetAsync(redisKey, logoUrl, _tokenLogoExpiration);
            
            // Update memory cache
            EnsureChainCache(chainKey);
            _memoryCache[chainKey][normalizedAddress] = logoUrl;
            
            Console.WriteLine($"INFO: TokenLogoService: Added new token logo - {normalizedAddress} on {chain}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: TokenLogoService: Failed to set token logo: {ex.Message}");
            throw;
        }
    }

    public async Task<Dictionary<string, string>> GetAllTokenLogosAsync(Chain chain)
    {
        if (!_isInitialized)
        {
            await LoadAllTokensIntoMemoryAsync();
        }

        var chainKey = GetChainKey(chain);
        
        if (_memoryCache.TryGetValue(chainKey, out var chainCache))
        {
            return new Dictionary<string, string>(chainCache);
        }
        
        return new Dictionary<string, string>();
    }

    public async Task LoadAllTokensIntoMemoryAsync()
    {
        if (_isInitialized) return;

        await _loadingSemaphore.WaitAsync();
        try
        {
            if (_isInitialized) return; // Double-check after acquiring semaphore

            Console.WriteLine("INFO: TokenLogoService: Loading all tokens into memory...");
            
            var server = _database.Multiplexer.GetServer(_database.Multiplexer.GetEndPoints().First());
            var pattern = $"{_tokenLogoKeyPrefix}*";
            var totalLoaded = 0;

            var keys = server.Keys(pattern: pattern);
            foreach (var key in keys)
            {
                try
                {
                    var logoUrl = await _database.StringGetAsync(key);
                    if (logoUrl.HasValue)
                    {
                        var (tokenAddress, chain) = ParseRedisKey(key!);
                        if (tokenAddress != null && chain.HasValue)
                        {
                            var chainKey = GetChainKey(chain.Value);
                            var normalizedAddress = NormalizeAddress(tokenAddress);
                            
                            EnsureChainCache(chainKey);
                            _memoryCache[chainKey][normalizedAddress] = logoUrl!;
                            totalLoaded++;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"ERROR: TokenLogoService: Failed to load key {key}: {ex.Message}");
                }
            }

            _isInitialized = true;
            Console.WriteLine($"SUCCESS: TokenLogoService: Loaded {totalLoaded} token logos into memory");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: TokenLogoService: Failed to load tokens into memory: {ex.Message}");
            _isInitialized = true; // Mark as initialized even on failure to prevent infinite retry
        }
        finally
        {
            _loadingSemaphore.Release();
        }
    }

    public async Task<int> GetCachedTokenCountAsync(Chain chain)
    {
        if (!_isInitialized)
        {
            await LoadAllTokensIntoMemoryAsync();
        }

        var chainKey = GetChainKey(chain);
        return _memoryCache.TryGetValue(chainKey, out var chainCache) ? chainCache.Count : 0;
    }

    private void EnsureChainCache(string chainKey)
    {
        _memoryCache.TryAdd(chainKey, new ConcurrentDictionary<string, string>());
    }

    private string GetChainKey(Chain chain) => chain.ToChainId();

    private string NormalizeAddress(string address) => address.ToLowerInvariant();

    private string GenerateRedisKey(string tokenAddress, Chain chain)
    {
        return $"{_tokenLogoKeyPrefix}{chain.ToChainId()}:{NormalizeAddress(tokenAddress)}";
    }

    private (string? tokenAddress, Chain? chain) ParseRedisKey(string redisKey)
    {
        try
        {
            var keyWithoutPrefix = redisKey.Substring(_tokenLogoKeyPrefix.Length);
            var parts = keyWithoutPrefix.Split(':', 2);
            
            if (parts.Length == 2)
            {
                var chainId = parts[0];
                var tokenAddress = parts[1];
                
                // Find chain by chainId
                foreach (Chain chain in Enum.GetValues<Chain>())
                {
                    if (chain.ToChainId() == chainId)
                    {
                        return (tokenAddress, chain);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: TokenLogoService: Failed to parse Redis key {redisKey}: {ex.Message}");
        }

        return (null, null);
    }

    public async Task<Dictionary<string, string?>> GetTokenLogosAsync(IEnumerable<string> tokenAddresses, Chain chain)
    {
        if (!_isInitialized)
        {
            await LoadAllTokensIntoMemoryAsync();
        }

        var chainKey = GetChainKey(chain);
        var result = new Dictionary<string, string?>();
        var missingTokens = new List<string>();

        // Check memory cache for all tokens first
        foreach (var tokenAddress in tokenAddresses)
        {
            var normalizedAddress = NormalizeAddress(tokenAddress);
            
            if (_memoryCache.TryGetValue(chainKey, out var chainCache) && 
                chainCache.TryGetValue(normalizedAddress, out var logoUrl))
            {
                result[normalizedAddress] = logoUrl;
            }
            else
            {
                result[normalizedAddress] = null;
                missingTokens.Add(normalizedAddress);
            }
        }

        // Batch fetch missing tokens from Redis
        if (missingTokens.Any())
        {
            try
            {
                var redisKeys = missingTokens.Select(address => (RedisKey)GenerateRedisKey(address, chain)).ToArray();
                var redisValues = await _database.StringGetAsync(redisKeys);
                
                EnsureChainCache(chainKey);
                
                for (int i = 0; i < missingTokens.Count; i++)
                {
                    if (redisValues[i].HasValue)
                    {
                        var tokenAddress = missingTokens[i];
                        var logoUrl = redisValues[i]!;
                        
                        // Update memory cache
                        _memoryCache[chainKey][tokenAddress] = logoUrl;
                        result[tokenAddress] = logoUrl;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: TokenLogoService: Failed batch get from Redis: {ex.Message}");
            }
        }

        return result;
    }

    public async Task SetTokenLogosAsync(Dictionary<string, string> tokenLogos, Chain chain)
    {
        if (!tokenLogos.Any()) return;

        var chainKey = GetChainKey(chain);
        EnsureChainCache(chainKey);

        try
        {
            // Prepare batch Redis operations
            var redisBatch = _database.CreateBatch();
            var tasks = new List<Task>();

            foreach (var kvp in tokenLogos)
            {
                var normalizedAddress = NormalizeAddress(kvp.Key);
                var logoUrl = kvp.Value;
                var redisKey = GenerateRedisKey(normalizedAddress, chain);
                
                // Add to batch with configurable expiration for token logos
                tasks.Add(redisBatch.StringSetAsync(redisKey, logoUrl, _tokenLogoExpiration));
                
                // Update memory cache immediately
                _memoryCache[chainKey][normalizedAddress] = logoUrl;
            }

            // Execute batch
            redisBatch.Execute();
            await Task.WhenAll(tasks);
            
            Console.WriteLine($"INFO: TokenLogoService: Batch updated {tokenLogos.Count} token logos on {chain}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: TokenLogoService: Failed batch set to Redis: {ex.Message}");
            throw;
        }
    }
}