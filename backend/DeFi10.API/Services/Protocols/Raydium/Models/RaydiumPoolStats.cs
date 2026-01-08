using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Raydium.Models;

public class RaydiumPoolStatsResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("data")]
    public List<RaydiumPoolStats> Data { get; set; } = new();
}

public class RaydiumPoolStats
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("tvl")]
    public decimal Tvl { get; set; }

    [JsonPropertyName("day")]
    public RaydiumTimeframeStats? Day { get; set; }

    [JsonPropertyName("week")]
    public RaydiumTimeframeStats? Week { get; set; }

    [JsonPropertyName("month")]
    public RaydiumTimeframeStats? Month { get; set; }
}

public class RaydiumTimeframeStats
{
    [JsonPropertyName("volume")]
    public decimal Volume { get; set; }

    [JsonPropertyName("volumeFee")]
    public decimal VolumeFee { get; set; }

    [JsonPropertyName("apr")]
    public decimal Apr { get; set; }

    [JsonPropertyName("feeApr")]
    public decimal FeeApr { get; set; }
}
