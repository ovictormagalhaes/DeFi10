using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Aave.Models.Supplies;

public class AaveSupplyMarket
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("chain")]
    public AaveSupplyChain Chain { get; set; } = new();
}
