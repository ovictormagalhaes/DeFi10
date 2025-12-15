using DeFi10.API.Services.Core.Solana;
using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Infrastructure.MoralisSolana.Models;

public sealed class SolanaTokenResponse
{
    [JsonPropertyName("tokens")] 
    public List<SplToken> Tokens { get; set; } = new();
    
    [JsonPropertyName("nativeBalanceUsd")] 
    public decimal? NativeBalanceUsd { get; set; }
}
