using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Infrastructure.CoinMarketCap.Models;

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

    [JsonPropertyName("quote")] public Dictionary<string, CmcFiatQuote> Quote { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}
