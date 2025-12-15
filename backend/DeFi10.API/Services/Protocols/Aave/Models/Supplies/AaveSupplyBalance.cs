using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Aave.Models.Supplies;

public class AaveSupplyBalance
{
    [JsonPropertyName("amount")]
    public AaveSupplyAmount Amount { get; set; } = new();

    [JsonPropertyName("usd")]
    public string Usd { get; set; } = string.Empty;
}
