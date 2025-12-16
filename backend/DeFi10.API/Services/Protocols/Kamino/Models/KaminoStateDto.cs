using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Kamino.Models;

internal class KaminoStateDto
{
    [JsonPropertyName("lendingMarket")]
    public string? LendingMarket { get; set; }

    [JsonPropertyName("owner")]
    public string? Owner { get; set; }

    [JsonPropertyName("deposits")]
    public List<KaminoRawDepositDto>? Deposits { get; set; }

    [JsonPropertyName("borrows")]
    public List<KaminoRawBorrowDto>? Borrows { get; set; }
}
