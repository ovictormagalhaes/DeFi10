using DeFi10.API.Models;

namespace DeFi10.API.Services.Helpers;

public interface ITokenMetadataService
{
    /// <summary>
    /// Loads all token metadata from Redis into in-memory cache on startup.
    /// This reduces Redis calls significantly (1 pod scenario).
    /// </summary>
    Task LoadAllMetadataIntoMemoryAsync();
    
    Task<TokenMetadata?> GetTokenMetadataAsync(string mintAddress);
    Task<TokenMetadata?> GetTokenMetadataBySymbolAndNameAsync(string symbol, string name);
    Task<decimal?> GetTokenPriceAsync(string identifier);
    Task SetTokenMetadataAsync(string mintAddress, TokenMetadata metadata);
    Task SetTokenPriceAsync(string identifier, decimal priceUsd);
    
    /// <summary>
    /// Gets current in-memory cache statistics for monitoring.
    /// Returns: (addresses, symbols, symbolNames, prices)
    /// </summary>
    (int addresses, int symbols, int symbolNames, int prices) GetCacheStats();
}
