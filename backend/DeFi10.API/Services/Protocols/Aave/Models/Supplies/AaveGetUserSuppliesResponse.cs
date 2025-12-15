using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Aave.Models.Supplies;

public class AaveGetUserSuppliesResponse
{
    [JsonPropertyName("data")]
    public UserSuppliesData Data { get; set; } = new();
}
