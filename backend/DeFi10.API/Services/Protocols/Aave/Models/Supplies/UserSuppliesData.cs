using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Aave.Models.Supplies;

public class UserSuppliesData
{
    [JsonPropertyName("userSupplies")]
    public List<UserSupply> UserSupplies { get; set; } = new();
}
