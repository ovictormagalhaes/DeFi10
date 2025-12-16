using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using StackExchange.Redis;
using System.Text.Json;

namespace DeFi10.API.Services.Core;

public class RedisCacheService : ICacheService
{
    private readonly IDatabase _database;
    private readonly IConfiguration _configuration;
    private readonly ILogger<RedisCacheService> _logger;
    private readonly TimeSpan _defaultExpiration;
    private readonly string _walletCacheKeyPrefix;
    private readonly string _strategyKeyPrefix;

    public RedisCacheService(IConnectionMultiplexer redis, IConfiguration configuration, ILogger<RedisCacheService> logger)
    {
        _database = redis.GetDatabase();
        _configuration = configuration;
        _logger = logger;

        var expirationConfig = configuration["Redis:DefaultExpiration"];
        _defaultExpiration = !string.IsNullOrEmpty(expirationConfig) 
            ? TimeSpan.Parse(expirationConfig) 
            : TimeSpan.FromMinutes(30);
            
        _walletCacheKeyPrefix = configuration["Redis:WalletCacheKeyPrefix"] ?? "wallet:";
        _strategyKeyPrefix = configuration["Redis:StrategyKeyPrefix"] ?? "strategy:";
    }

    public async Task<T?> GetAsync<T>(string key) where T : class
    {
        try
        {            
            var value = await _database.StringGetAsync(key);
            
            if (!value.HasValue)
            {
                _logger.LogDebug("Cache miss for key: {Key}", key);
                return null;
            }

            return JsonSerializer.Deserialize<T>(value!);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get cache for key {Key}", key);
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
            _logger.LogError(ex, "Failed to set cache for key {Key}", key);

        }
    }

    public async Task SetPersistentAsync<T>(string key, T value) where T : class
    {
        try
        {
            var serializedValue = JsonSerializer.Serialize(value);

            await _database.StringSetAsync(key, serializedValue, expiry: null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to set persistent value for key {Key}", key);
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
            _logger.LogError(ex, "Failed to remove cache for key {Key}", key);
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

    public string GenerateStrategyCacheKey(string accountId)
    {
        return $"{_strategyKeyPrefix}{accountId.ToLowerInvariant()}";
    }
}