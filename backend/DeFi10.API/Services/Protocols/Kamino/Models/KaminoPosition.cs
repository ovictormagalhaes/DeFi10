using DeFi10.API.Services.Core.Solana;
using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Kamino.Models;

public sealed class KaminoPosition
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;
    
    [JsonPropertyName("market")]
    public string Market { get; set; } = string.Empty;
    
    [JsonPropertyName("suppliedUsd")]
    public decimal SuppliedUsd { get; set; }
    
    [JsonPropertyName("borrowedUsd")]
    public decimal BorrowedUsd { get; set; }
    
    [JsonPropertyName("healthFactor")]
    public decimal HealthFactor { get; set; }
    
    [JsonPropertyName("tokens")]
    public List<SplToken> Tokens { get; set; } = new();
}
