using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Infrastructure.MoralisSolana.Models;

public class MoralisSolanaPortfolioResponse
{
    [JsonPropertyName("nativeBalance")]
    public PortfolioNativeBalance NativeBalance { get; set; } = new();

    [JsonPropertyName("tokens")]
    public List<PortfolioToken> Tokens { get; set; } = new();

    [JsonPropertyName("nfts")]
    public List<PortfolioNft> Nfts { get; set; } = new();
}
