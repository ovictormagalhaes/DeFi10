using System.Net.Http.Headers;
using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using MyWebWallet.API.Services.Interfaces;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services;

public sealed class CoinMarketCapOptions
{
    public string? ApiKey { get; set; }
    public string BaseUrl { get; set; } = "https://pro-api.coinmarketcap.com/v1";
    public bool Enabled { get; set; } = true;
    public int TimeoutMs { get; set; } = 5000;
}

public class CoinMarketCapService : ICoinMarketCapService
{
    private readonly HttpClient _http;
    private readonly ILogger<CoinMarketCapService> _logger;
    private readonly CoinMarketCapOptions _opts;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public CoinMarketCapService(HttpClient http, IOptions<CoinMarketCapOptions> options, ILogger<CoinMarketCapService> logger)
    {
        _http = http;
        _logger = logger;
        _opts = options.Value;
        if (_opts.Enabled && !string.IsNullOrWhiteSpace(_opts.ApiKey))
        {
            _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            if (!_http.DefaultRequestHeaders.Contains("X-CMC_PRO_API_KEY"))
                _http.DefaultRequestHeaders.Add("X-CMC_PRO_API_KEY", _opts.ApiKey);
            _http.Timeout = TimeSpan.FromMilliseconds(_opts.TimeoutMs);
        }
        else
        {
            _opts.Enabled = false;
            _logger.LogWarning("CoinMarketCap service disabled (missing api key or disabled flag)");
        }
    }

    public async Task<CmcQuotesLatestV2Response?> GetQuotesLatestV2Async(IEnumerable<string> symbols, CancellationToken ct = default)
    {
        var list = symbols.Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        if (!_opts.Enabled || list.Length == 0)
        {
            return new CmcQuotesLatestV2Response();
        }
        var joined = string.Join(',', list.Select(s => s.ToUpperInvariant()));
        var url = $"{_opts.BaseUrl}/cryptocurrency/quotes/latest?symbol={joined}"; // v2 uses same endpoint with multiple symbols
        try
        {
            using var resp = await _http.GetAsync(url, ct);
            if (resp.StatusCode == (HttpStatusCode)429)
            {
                _logger.LogWarning("CMC v2 rate limited 429 symbols={Count}", list.Length);
                return new CmcQuotesLatestV2Response();
            }
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("CMC v2 failure status={Status} symbols={Count}", resp.StatusCode, list.Length);
                return new CmcQuotesLatestV2Response();
            }
            var json = await resp.Content.ReadAsStringAsync(ct);
            var node = JsonNode.Parse(json);
            if (node == null) return new CmcQuotesLatestV2Response();
            var result = new CmcQuotesLatestV2Response();
            var statusNode = node["status"];
            if (statusNode != null)
            {
                result.Status = new CmcStatus
                {
                    Timestamp = TryParseDate(statusNode["timestamp"]?.GetValue<string>()),
                    ErrorCode = statusNode["error_code"]?.GetValue<int?>() ?? 0,
                    ErrorMessage = statusNode["error_message"]?.GetValue<string>(),
                    Elapsed = statusNode["elapsed"]?.GetValue<int?>() ?? 0,
                    CreditCount = statusNode["credit_count"]?.GetValue<int?>() ?? 0,
                    Notice = statusNode["notice"]?.GetValue<string>()
                };
            }
            var dataNode = node["data"] as JsonObject;
            if (dataNode != null)
            {
                foreach (var kv in dataNode)
                {
                    if (kv.Value is not JsonObject assetObj) continue;
                    var asset = new CmcAssetQuote
                    {
                        Id = assetObj["id"]?.GetValue<int?>() ?? 0,
                        Name = assetObj["name"]?.GetValue<string>() ?? string.Empty,
                        Symbol = assetObj["symbol"]?.GetValue<string>() ?? kv.Key,
                        Slug = assetObj["slug"]?.GetValue<string>() ?? string.Empty,
                        IsActive = assetObj["is_active"]?.GetValue<int?>() ?? 0,
                        IsFiat = assetObj["is_fiat"]?.GetValue<int?>() ?? 0,
                        CirculatingSupply = assetObj["circulating_supply"]?.GetValue<decimal?>(),
                        TotalSupply = assetObj["total_supply"]?.GetValue<decimal?>(),
                        MaxSupply = assetObj["max_supply"]?.GetValue<decimal?>(),
                        DateAdded = TryParseDate(assetObj["date_added"]?.GetValue<string>()),
                        NumMarketPairs = assetObj["num_market_pairs"]?.GetValue<int?>(),
                        CmcRank = assetObj["cmc_rank"]?.GetValue<int?>(),
                        LastUpdated = TryParseDate(assetObj["last_updated"]?.GetValue<string>())
                    };
                    if (assetObj["tags"] is JsonArray tagArr)
                    {
                        asset.Tags = tagArr.Select(t => t?.GetValue<string>() ?? string.Empty).Where(t => !string.IsNullOrEmpty(t)).ToList();
                    }
                    if (assetObj["quote"] is JsonObject quoteObj)
                    {
                        foreach (var qkv in quoteObj)
                        {
                            if (qkv.Value is not JsonObject fiatObj) continue;
                            var fq = new CmcFiatQuote
                            {
                                Price = fiatObj["price"]?.GetValue<decimal?>(),
                                Volume24h = fiatObj["volume_24h"]?.GetValue<decimal?>(),
                                VolumeChange24h = fiatObj["volume_change_24h"]?.GetValue<decimal?>(),
                                PercentChange1h = fiatObj["percent_change_1h"]?.GetValue<decimal?>(),
                                PercentChange24h = fiatObj["percent_change_24h"]?.GetValue<decimal?>(),
                                PercentChange7d = fiatObj["percent_change_7d"]?.GetValue<decimal?>(),
                                PercentChange30d = fiatObj["percent_change_30d"]?.GetValue<decimal?>(),
                                MarketCap = fiatObj["market_cap"]?.GetValue<decimal?>(),
                                MarketCapDominance = fiatObj["market_cap_dominance"]?.GetValue<decimal?>(),
                                FullyDilutedMarketCap = fiatObj["fully_diluted_market_cap"]?.GetValue<decimal?>(),
                                LastUpdated = TryParseDate(fiatObj["last_updated"]?.GetValue<string>())
                            };
                            asset.Quote[qkv.Key] = fq;
                        }
                    }
                    result.Data[kv.Key] = asset;
                }
            }
            return result;
        }
        catch (TaskCanceledException) when (ct.IsCancellationRequested)
        {
            _logger.LogInformation("CMC v2 request canceled symbols={Count}", symbols.Count());
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "CMC v2 exception symbols={Count}", symbols.Count());
            return null;
        }
    }

    private static DateTime? TryParseDate(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        if (DateTime.TryParse(s, out var dt)) return DateTime.SpecifyKind(dt, DateTimeKind.Utc);
        return null;
    }
}
