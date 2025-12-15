using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Aave.Models.Supplies;

public class AaveSupplyAmount
{
    [JsonPropertyName("value")]
    public string Value { get; set; } = string.Empty;
}
