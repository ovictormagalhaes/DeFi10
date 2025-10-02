using System.Text.Json.Serialization;
using MyWebWallet.API.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Interfaces;

public interface ICoinMarketCapService
{
    Task<CmcQuotesLatestV2Response?> GetQuotesLatestV2Async(IEnumerable<string> symbols, CancellationToken ct = default);
}

// DTOs for CMC Quotes Latest v2
public sealed class CmcQuotesLatestV2Response
{
    [JsonPropertyName("data")] public Dictionary<string, CmcAssetQuote> Data { get; set; } = new();
    [JsonPropertyName("status")] public CmcStatus Status { get; set; } = new();
}

public sealed class CmcStatus
{
    [JsonPropertyName("timestamp")] public DateTime? Timestamp { get; set; }
    [JsonPropertyName("error_code")] public int ErrorCode { get; set; }
    [JsonPropertyName("error_message")] public string? ErrorMessage { get; set; }
    [JsonPropertyName("elapsed")] public int Elapsed { get; set; }
    [JsonPropertyName("credit_count")] public int CreditCount { get; set; }
    [JsonPropertyName("notice")] public string? Notice { get; set; }
}

public sealed class CmcAssetQuote
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
    [JsonPropertyName("symbol")] public string Symbol { get; set; } = string.Empty;
    [JsonPropertyName("slug")] public string Slug { get; set; } = string.Empty;
    [JsonPropertyName("is_active")] public int IsActive { get; set; }
    [JsonPropertyName("is_fiat")] public int IsFiat { get; set; }
    [JsonPropertyName("circulating_supply")] public decimal? CirculatingSupply { get; set; }
    [JsonPropertyName("total_supply")] public decimal? TotalSupply { get; set; }
    [JsonPropertyName("max_supply")] public decimal? MaxSupply { get; set; }
    [JsonPropertyName("date_added")] public DateTime? DateAdded { get; set; }
    [JsonPropertyName("num_market_pairs")] public int? NumMarketPairs { get; set; }
    [JsonPropertyName("cmc_rank")] public int? CmcRank { get; set; }
    [JsonPropertyName("last_updated")] public DateTime? LastUpdated { get; set; }
    [JsonPropertyName("tags")] public List<string>? Tags { get; set; }
    // quote map e.g. { "USD": { ... } }
    [JsonPropertyName("quote")] public Dictionary<string, CmcFiatQuote> Quote { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed class CmcFiatQuote
{
    [JsonPropertyName("price")] public decimal? Price { get; set; }
    [JsonPropertyName("volume_24h")] public decimal? Volume24h { get; set; }
    [JsonPropertyName("volume_change_24h")] public decimal? VolumeChange24h { get; set; }
    [JsonPropertyName("percent_change_1h")] public decimal? PercentChange1h { get; set; }
    [JsonPropertyName("percent_change_24h")] public decimal? PercentChange24h { get; set; }
    [JsonPropertyName("percent_change_7d")] public decimal? PercentChange7d { get; set; }
    [JsonPropertyName("percent_change_30d")] public decimal? PercentChange30d { get; set; }
    [JsonPropertyName("market_cap")] public decimal? MarketCap { get; set; }
    [JsonPropertyName("market_cap_dominance")] public decimal? MarketCapDominance { get; set; }
    [JsonPropertyName("fully_diluted_market_cap")] public decimal? FullyDilutedMarketCap { get; set; }
    [JsonPropertyName("last_updated")] public DateTime? LastUpdated { get; set; }
}
