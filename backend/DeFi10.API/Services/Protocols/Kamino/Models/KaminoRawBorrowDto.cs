using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Kamino.Models;

internal class KaminoRawBorrowDto
{
    [JsonPropertyName("borrowReserve")]
    public string? BorrowReserve { get; set; }

    [JsonPropertyName("borrowedAmountSf")]
    public string? BorrowedAmountSf { get; set; }

    [JsonPropertyName("borrowedAmountOutsideElevationGroups")]
    public string? BorrowedAmountOutsideElevationGroups { get; set; }

    [JsonPropertyName("marketValueSf")]
    public string? MarketValueSf { get; set; }
}
