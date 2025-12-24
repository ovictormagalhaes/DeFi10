using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Kamino.Models;

internal class KaminoRawDepositDto
{
    [JsonPropertyName("depositReserve")]
    public string? DepositReserve { get; set; }

    [JsonPropertyName("depositedAmount")]
    public string? DepositedAmount { get; set; }

    [JsonPropertyName("marketValueSf")]
    public string? MarketValueSf { get; set; }

    /// <summary>
    /// Supply APY enriched from reserves data (not from API response)
    /// </summary>
    [JsonIgnore]
    public decimal? Apy { get; set; }
}
