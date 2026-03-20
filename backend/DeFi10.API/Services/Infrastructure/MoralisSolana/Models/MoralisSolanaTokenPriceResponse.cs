using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Infrastructure.MoralisSolana.Models;

public class MoralisSolanaTokenPriceResponse
{
    [JsonPropertyName("tokenAddress")]
    public string TokenAddress { get; set; } = string.Empty;

    [JsonPropertyName("pairAddress")]
    public string? PairAddress { get; set; }

    [JsonPropertyName("exchangeName")]
    public string? ExchangeName { get; set; }

    [JsonPropertyName("exchangeAddress")]
    public string? ExchangeAddress { get; set; }

    [JsonPropertyName("nativePrice")]
    public NativePrice? NativePrice { get; set; }

    [JsonPropertyName("usdPrice")]
    public decimal? UsdPrice { get; set; }

    [JsonPropertyName("usdPrice24h")]
    public decimal? UsdPrice24h { get; set; }

    [JsonPropertyName("usdPrice24hrUsdChange")]
    public decimal? UsdPrice24hrUsdChange { get; set; }

    [JsonPropertyName("usdPrice24hrPercentChange")]
    public decimal? UsdPrice24hrPercentChange { get; set; }

    [JsonPropertyName("logo")]
    public string? Logo { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("symbol")]
    public string? Symbol { get; set; }

    [JsonPropertyName("score")]
    public int? Score { get; set; }

    [JsonPropertyName("isVerifiedContract")]
    public bool IsVerifiedContract { get; set; }
}

public class NativePrice
{
    [JsonPropertyName("value")]
    public string Value { get; set; } = string.Empty;

    [JsonPropertyName("symbol")]
    public string Symbol { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("decimals")]
    public int Decimals { get; set; }
}
