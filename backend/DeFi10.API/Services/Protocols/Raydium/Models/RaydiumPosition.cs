using DeFi10.API.Services.Core.Solana;
using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Raydium.Models;

public sealed class RaydiumPosition
{
    [JsonPropertyName("pool")]
    public string Pool { get; set; } = string.Empty;
    
    [JsonPropertyName("tokens")]
    public List<SplToken> Tokens { get; set; } = new();
    
    [JsonPropertyName("totalValueUsd")]
    public decimal TotalValueUsd { get; set; }
    
    [JsonPropertyName("apr")]
    public decimal? Apr { get; set; }
    
    [JsonPropertyName("fees24h")]
    public decimal? Fees24h { get; set; }

    [JsonPropertyName("sqrtPriceX96")]
    public string? SqrtPriceX96 { get; set; }
    
    [JsonPropertyName("tickLower")]
    public int TickLower { get; set; }
    
    [JsonPropertyName("tickUpper")]
    public int TickUpper { get; set; }
    
    [JsonPropertyName("tickCurrent")]
    public int TickCurrent { get; set; }
}
