namespace MyWebWallet.API.Services.Solana;

/// <summary>
/// Service for resolving token metadata (symbol, name, logo) and prices from cache or external sources
/// </summary>
public interface ITokenMetadataService
{
    /// <summary>
    /// Gets token metadata (symbol, name, logo) for a given mint address
    /// </summary>
    Task<TokenMetadata?> GetTokenMetadataAsync(string mintAddress);
    
    /// <summary>
    /// Gets token price in USD by mint address, symbol, or name
    /// </summary>
    Task<decimal?> GetTokenPriceAsync(string identifier);
    
    /// <summary>
    /// Stores token metadata in cache
    /// </summary>
    Task SetTokenMetadataAsync(string mintAddress, TokenMetadata metadata);
    
    /// <summary>
    /// Stores token price in cache
    /// </summary>
    Task SetTokenPriceAsync(string identifier, decimal priceUsd);
}

public sealed class TokenMetadata
{
    public string Symbol { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
}
