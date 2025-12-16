using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Infrastructure.MoralisSolana.Models;

public class PortfolioNft
{
    [JsonPropertyName("mint")]
    public string Mint { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}
