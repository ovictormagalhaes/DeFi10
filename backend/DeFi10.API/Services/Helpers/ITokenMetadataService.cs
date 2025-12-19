using DeFi10.API.Models;

namespace DeFi10.API.Services.Helpers;

public interface ITokenMetadataService
{
    Task LoadAllMetadataIntoMemoryAsync();
    Task<TokenMetadata?> GetTokenMetadataAsync(Chain chain, string address);
    Task<TokenMetadata?> GetTokenMetadataBySymbolAndNameAsync(string symbol, string name);
    Task<decimal?> GetTokenPriceAsync(string identifier);
    Task SetTokenMetadataAsync(Chain chain, string address, TokenMetadata metadata);
    Task SetTokenPriceAsync(string identifier, decimal priceUsd);
    Task FlushStaleTokensAsync();
}
