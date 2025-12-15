using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Infrastructure.MoralisSolana.Models;

public class PortfolioToken
{
    [JsonPropertyName("associatedTokenAddress")]
    public string AssociatedTokenAddress { get; set; } = string.Empty;

    [JsonPropertyName("mint")]
    public string Mint { get; set; } = string.Empty;

    [JsonPropertyName("amountRaw")]
    public string AmountRaw { get; set; } = string.Empty;

    [JsonPropertyName("amount")]
    public string Amount { get; set; } = string.Empty;

    [JsonPropertyName("decimals")]
    public int Decimals { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("symbol")]
    public string Symbol { get; set; } = string.Empty;

    [JsonPropertyName("logo")]
    public string? Logo { get; set; }
    
    [JsonPropertyName("usdPrice")]
    public decimal? UsdPrice { get; set; }
    
    [JsonPropertyName("usdValue")]
    public decimal? UsdValue { get; set; }
}
