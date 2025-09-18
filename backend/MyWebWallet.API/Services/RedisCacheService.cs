using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using StackExchange.Redis;
using System.Text.Json;

namespace MyWebWallet.API.Services;

public class RedisCacheService : ICacheService
{
    private readonly IDatabase _database;
    private readonly IConfiguration _configuration;
    private readonly TimeSpan _defaultExpiration;
    private readonly string _walletCacheKeyPrefix;

    public RedisCacheService(IConnectionMultiplexer redis, IConfiguration configuration)
    {
        _database = redis.GetDatabase();
        _configuration = configuration;
        
        // Get default expiration from configuration or default to 30 minutes
        var expirationConfig = configuration["Redis:DefaultExpiration"];
        _defaultExpiration = !string.IsNullOrEmpty(expirationConfig) 
            ? TimeSpan.Parse(expirationConfig) 
            : TimeSpan.FromMinutes(30);
            
        _walletCacheKeyPrefix = configuration["Redis:WalletCacheKeyPrefix"] ?? "wallet:";
    }

    public async Task<T?> GetAsync<T>(string key) where T : class
    {
        try
        {            
            var value = await _database.StringGetAsync(key);
            
            if (!value.HasValue)
            {
                Console.WriteLine($"DEBUG: RedisCacheService: Cache miss for key: {key}");
                return null;
            }

            return JsonSerializer.Deserialize<T>(value!);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: RedisCacheService: Failed to get cache for key {key}: {ex.Message}");
            return null;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiration = null) where T : class
    {
        try
        {
            var expirationToUse = expiration ?? _defaultExpiration;
            var serializedValue = JsonSerializer.Serialize(value);
                        
            await _database.StringSetAsync(key, serializedValue, expirationToUse);            
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: RedisCacheService: Failed to set cache for key {key}: {ex.Message}");
            // Don't throw - caching should be non-blocking
        }
    }

    public async Task RemoveAsync(string key)
    {
        try
        {
            await _database.KeyDeleteAsync(key);            
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: RedisCacheService: Failed to remove cache for key {key}: {ex.Message}");
        }
    }

    public async Task<bool> ExistsAsync(string key)
    {
        try
        {
            return await _database.KeyExistsAsync(key);
        }
        catch (Exception ex)
        {
            return false;
        }
    }

    public string GenerateWalletCacheKey(string address, Chain? chain = null)
    {
        var key = $"{_walletCacheKeyPrefix}{address.ToLowerInvariant()}";
        
        if (chain.HasValue)
            key += $":{chain.Value.ToChainId()}";
        
        return key;
    }

    public string GenerateWalletCacheKey(string address, IEnumerable<Chain> chains)
    {
        var chainList = chains.OrderBy(c => c).ToList();
        var chainIds = string.Join(",", chainList.Select(c => c.ToChainId()));
        var key = $"{_walletCacheKeyPrefix}{address.ToLowerInvariant()}:multi:{chainIds}";
        
        return key;
    }
}