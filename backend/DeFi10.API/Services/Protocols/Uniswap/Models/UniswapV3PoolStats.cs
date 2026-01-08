using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Uniswap.Models;

public class UniswapV3PoolStatsResponse
{
    [JsonPropertyName("data")]
    public UniswapV3PoolStatsData? Data { get; set; }
}

public class UniswapV3PoolStatsData
{
    [JsonPropertyName("pools")]
    public List<UniswapV3PoolStats> Pools { get; set; } = new();
}

public class UniswapV3PoolStats
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("feeTier")]
    public string FeeTier { get; set; } = string.Empty;

    [JsonPropertyName("volumeUSD")]
    public string VolumeUSD { get; set; } = string.Empty;

    [JsonPropertyName("totalValueLockedUSD")]
    public string TotalValueLockedUSD { get; set; } = string.Empty;

    [JsonPropertyName("feesUSD")]
    public string FeesUSD { get; set; } = string.Empty;

    // Calculated APR = (24h fees * 365 / TVL) * 100
    public decimal? Apr { get; set; }
}
