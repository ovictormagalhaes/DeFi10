using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using StackExchange.Redis;
using System.Collections.Concurrent;

namespace DeFi10.API.Services.Core;

public class TokenLogoService : ITokenLogoService
{
    private readonly IDatabase _database;
    private readonly IConfiguration _configuration;

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

            var redisKey = GenerateRedisKey(tokenAddress);
            await _database.StringSetAsync(redisKey, logoUrl, _tokenLogoExpiration);

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

        return new Dictionary<string, string>(_memoryCache);
    }

    public async Task LoadAllTokensIntoMemoryAsync()
    {
        if (_isInitialized) return;

        await _loadingSemaphore.WaitAsync();
        try
        {
            if (_isInitialized) return;

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
            _isInitialized = true;
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

    private string GenerateRedisKey(string tokenAddress)
    {
        return $"{_tokenLogoKeyPrefix}{NormalizeAddress(tokenAddress)}";
    }

    private (string? tokenAddress, Chain? chain) ParseRedisKey(string redisKey)
    {
        try
        {
            var keyWithoutPrefix = redisKey.Substring(_tokenLogoKeyPrefix.Length);

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

                    return (tokenAddr, null);
                }
            }

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

            var redisBatch = _database.CreateBatch();
            var tasks = new List<Task>();

            foreach (var kvp in tokenLogos)
            {
                var normalizedAddress = NormalizeAddress(kvp.Key);
                var logoUrl = kvp.Value;
                var redisKey = GenerateRedisKey(normalizedAddress);
                
                tasks.Add(redisBatch.StringSetAsync(redisKey, logoUrl, _tokenLogoExpiration));

                _memoryCache[normalizedAddress] = logoUrl;
            }

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