using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Aave.Models.Supplies;

public class UserSupply
{
    [JsonPropertyName("market")]
    public AaveSupplyMarket Market { get; set; } = new();

    [JsonPropertyName("currency")]
    public AaveSupplyCurrency Currency { get; set; } = new();

    [JsonPropertyName("balance")]
    public AaveSupplyBalance Balance { get; set; } = new();

    [JsonPropertyName("apy")]
    public AaveSupplyApy Apy { get; set; } = new();

    [JsonPropertyName("isCollateral")]
    public bool IsCollateral { get; set; }

    [JsonPropertyName("canBeCollateral")]
    public bool CanBeCollateral { get; set; }
}
