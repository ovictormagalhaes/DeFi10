using DeFi10.API.Services.Protocols.Aave.Models.Supplies;
using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Aave.Models.Borrows;

public class AaveBorrowDebt
{
    [JsonPropertyName("amount")]
    public AaveSupplyAmount Amount { get; set; } = new();
    
    [JsonPropertyName("usd")]
    public string Usd { get; set; } = string.Empty;
}
