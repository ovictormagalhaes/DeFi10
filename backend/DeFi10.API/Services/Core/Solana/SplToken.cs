using DeFi10.API.Models;
using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Core.Solana;

public sealed class SplToken
{
    [JsonPropertyName("mint")] 
    public string Mint { get; set; } = string.Empty;
    
    [JsonPropertyName("symbol")] 
    public string? Symbol { get; set; }
    
    [JsonPropertyName("name")] 
    public string? Name { get; set; }
    
    [JsonPropertyName("decimals")] 
    public int Decimals { get; set; }
    
    [JsonPropertyName("amount")] 
    public decimal Amount { get; set; }
    
    [JsonPropertyName("priceUsd")] 
    public decimal? PriceUsd { get; set; }
    
    [JsonPropertyName("logo")] 
    public string? Logo { get; set; }
    
    [JsonPropertyName("type")] 
    public TokenType? Type { get; set; }

    [JsonPropertyName("apy")]
    public decimal? Apy { get; set; }
}
