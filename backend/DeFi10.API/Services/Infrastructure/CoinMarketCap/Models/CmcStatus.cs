using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Infrastructure.CoinMarketCap.Models;

public sealed class CmcStatus
{
    [JsonPropertyName("timestamp")] public DateTime? Timestamp { get; set; }
    [JsonPropertyName("error_code")] public int ErrorCode { get; set; }
    [JsonPropertyName("error_message")] public string? ErrorMessage { get; set; }
    [JsonPropertyName("elapsed")] public int Elapsed { get; set; }
    [JsonPropertyName("credit_count")] public int CreditCount { get; set; }
    [JsonPropertyName("notice")] public string? Notice { get; set; }
}
