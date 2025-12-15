using DeFi10.API.Services.Protocols.Aave.Models.Supplies;
using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Aave.Models.Borrows;

public class UserBorrow
{
    [JsonPropertyName("market")]
    public AaveSupplyMarket Market { get; set; } = new();

    [JsonPropertyName("currency")]
    public AaveSupplyCurrency Currency { get; set; } = new();

    [JsonPropertyName("debt")]
    public AaveBorrowDebt Debt { get; set; } = new();

    [JsonPropertyName("apy")]
    public AaveSupplyApy Apy { get; set; } = new();
}
