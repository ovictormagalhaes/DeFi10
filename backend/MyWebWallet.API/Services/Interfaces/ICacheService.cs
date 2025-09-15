using MyWebWallet.API.Models;

namespace MyWebWallet.API.Services.Interfaces;

public interface ICacheService
{
    Task<T?> GetAsync<T>(string key) where T : class;
    Task SetAsync<T>(string key, T value, TimeSpan? expiration = null) where T : class;
    Task RemoveAsync(string key);
    Task<bool> ExistsAsync(string key);
    string GenerateWalletCacheKey(string address, Chain? chain = null);
    string GenerateWalletCacheKey(string address, IEnumerable<Chain> chains);
}