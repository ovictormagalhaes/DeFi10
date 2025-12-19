namespace DeFi10.API.Models;

public sealed class TokenMetadata
{
    public string Symbol { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }    
    public decimal? PriceUsd { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
