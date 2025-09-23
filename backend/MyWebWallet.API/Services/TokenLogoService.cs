using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using StackExchange.Redis;
using System.Collections.Concurrent;

namespace MyWebWallet.API.Services;

public class TokenLogoService : ITokenLogoService
{
    private readonly IDatabase _database;
    private readonly IConfiguration _configuration;
    
    // In-memory cache (global by token address)
    private readonly ConcurrentDictionary<string, string> _memoryCache;
    private readonly SemaphoreSlim _loadingSemaphore;
    private readonly string _tokenLogoKeyPrefix;
    private readonly TimeSpan _tokenLogoExpiration;
    private volatile bool _isInitialized = false;

    public TokenLogoService(IConnectionMultiplexer redis, IConfiguration configuration)
    {
        _database = redis.GetDatabase();
        _configuration = configuration;
        _memoryCache = new ConcurrentDictionary<string, string>();
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
            await LoadAllTokensIntoMemoryAsync();

        var normalizedAddress = NormalizeAddress(tokenAddress);

        if (_memoryCache.TryGetValue(normalizedAddress, out var logoUrl))
            return logoUrl;

        try
        {
            var redisKey = GenerateRedisKey(tokenAddress);
            var redisValue = await _database.StringGetAsync(redisKey);
            
            if (redisValue.HasValue)
            {
                _memoryCache[normalizedAddress] = redisValue!;
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
        var normalizedAddress = NormalizeAddress(tokenAddress);
        
        try
        {
            // Save to Redis (global, without chain)
            var redisKey = GenerateRedisKey(tokenAddress);
            await _database.StringSetAsync(redisKey, logoUrl, _tokenLogoExpiration);
            
            // Update memory cache
            _memoryCache[normalizedAddress] = logoUrl;            
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
            await LoadAllTokensIntoMemoryAsync();

        // Return global cache (chain ignored)
        return new Dictionary<string, string>(_memoryCache);
    }

    public async Task LoadAllTokensIntoMemoryAsync()
    {
        if (_isInitialized) return;

        await _loadingSemaphore.WaitAsync();
        try
        {
            if (_isInitialized) return; // Double-check after acquiring semaphore

            Console.WriteLine("INFO: TokenLogoService: Loading all tokens into memory (global cache)...");
            
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
                        var (address, _) = ParseRedisKey(key!);
                        if (!string.IsNullOrEmpty(address))
                        {
                            var normalizedAddress = NormalizeAddress(address);
                            _memoryCache[normalizedAddress] = logoUrl!;
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
            Console.WriteLine($"SUCCESS: TokenLogoService: Loaded {totalLoaded} token logos into memory (global cache)");
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

        return _memoryCache.Count;
    }

    private string NormalizeAddress(string address) => address.ToLowerInvariant();

    // New: key without chain (global)
    private string GenerateRedisKey(string tokenAddress)
    {
        return $"{_tokenLogoKeyPrefix}{NormalizeAddress(tokenAddress)}";
    }

    // Parse key to address (supports old and new formats)
    private (string? tokenAddress, Chain? chain) ParseRedisKey(string redisKey)
    {
        try
        {
            var keyWithoutPrefix = redisKey.Substring(_tokenLogoKeyPrefix.Length);
            // Old format: {prefix}{chainId}:{address}
            if (keyWithoutPrefix.Contains(':'))
            {
                var parts = keyWithoutPrefix.Split(':', 2);
                if (parts.Length == 2)
                {
                    var chainId = parts[0];
                    var tokenAddr = parts[1];
                    foreach (Chain c in Enum.GetValues<Chain>())
                    {
                        if (c.ToChainId() == chainId)
                        {
                            return (tokenAddr, c);
                        }
                    }
                    // Unknown chain; still return address
                    return (tokenAddr, null);
                }
            }
            // New format: {prefix}{address}
            return (keyWithoutPrefix, null);
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

        var result = new Dictionary<string, string?>();
        var missingTokens = new List<string>();

        // Check memory cache for all tokens first (global)
        foreach (var tokenAddress in tokenAddresses)
        {
            var normalizedAddress = NormalizeAddress(tokenAddress);
            
            if (_memoryCache.TryGetValue(normalizedAddress, out var logoUrl))
            {
                result[normalizedAddress] = logoUrl;
            }
            else
            {
                result[normalizedAddress] = null;
                missingTokens.Add(normalizedAddress);
            }
        }

        // Batch fetch missing tokens from Redis (global)
        if (missingTokens.Any())
        {
            try
            {
                var redisKeys = missingTokens.Select(address => (RedisKey)GenerateRedisKey(address)).ToArray();
                var redisValues = await _database.StringGetAsync(redisKeys);
                
                for (int i = 0; i < missingTokens.Count; i++)
                {
                    if (redisValues[i].HasValue)
                    {
                        var tokenAddress = missingTokens[i];
                        var logoUrl = redisValues[i]!;
                        
                        // Update memory cache
                        _memoryCache[tokenAddress] = logoUrl;
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

        try
        {
            // Prepare batch Redis operations (global)
            var redisBatch = _database.CreateBatch();
            var tasks = new List<Task>();

            foreach (var kvp in tokenLogos)
            {
                var normalizedAddress = NormalizeAddress(kvp.Key);
                var logoUrl = kvp.Value;
                var redisKey = GenerateRedisKey(normalizedAddress);
                
                tasks.Add(redisBatch.StringSetAsync(redisKey, logoUrl, _tokenLogoExpiration));
                
                // Update memory cache immediately
                _memoryCache[normalizedAddress] = logoUrl;
            }

            // Execute batch
            redisBatch.Execute();
            await Task.WhenAll(tasks);
            
            Console.WriteLine($"INFO: TokenLogoService: Batch updated {tokenLogos.Count} token logos (global)");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: TokenLogoService: Failed batch set to Redis: {ex.Message}");
            throw;
        }
    }
}