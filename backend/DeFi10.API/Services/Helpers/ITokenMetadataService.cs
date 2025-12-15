using DeFi10.API.Models;

namespace DeFi10.API.Services.Helpers;


public interface ITokenMetadataService
{
    Task<TokenMetadata?> GetTokenMetadataAsync(string mintAddress);
    Task<TokenMetadata?> GetTokenMetadataBySymbolAndNameAsync(string symbol, string name);
    Task<decimal?> GetTokenPriceAsync(string identifier);
    Task SetTokenMetadataAsync(string mintAddress, TokenMetadata metadata);
    Task SetTokenPriceAsync(string identifier, decimal priceUsd);
}
