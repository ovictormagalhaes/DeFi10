using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Kamino.Models;

internal class KaminoRefreshedStatsDto
{
    [JsonPropertyName("userTotalDeposit")]
    public string? UserTotalDeposit { get; set; }

    [JsonPropertyName("userTotalBorrow")]
    public string? UserTotalBorrow { get; set; }

    [JsonPropertyName("netAccountValue")]
    public string? NetAccountValue { get; set; }

    [JsonPropertyName("leverage")]
    public string? Leverage { get; set; }

    [JsonPropertyName("loanToValue")]
    public string? LoanToValue { get; set; }

    [JsonPropertyName("liquidationLtv")]
    public string? LiquidationLtv { get; set; }
}
