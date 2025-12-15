using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Aave.Models.Supplies;

public class AaveSupplyChain
{
    [JsonPropertyName("chainId")]
    public int ChainId { get; set; }
}
