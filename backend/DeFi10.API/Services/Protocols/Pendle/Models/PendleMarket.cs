using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Pendle.Models;

internal class PendleMarket
{
    public string Address { get; set; } = string.Empty;
    
    [JsonPropertyName("expiry")]
    public string? ExpiryString { get; set; }
    
    [JsonIgnore]
    public long? Expiry => long.TryParse(ExpiryString, out var exp) ? exp : null;
    
    public PendleToken? Pt { get; set; }
    public PendleToken? Sy { get; set; }
    public PendleToken? Yt { get; set; }
    public PendleToken? UnderlyingAsset { get; set; }
}
