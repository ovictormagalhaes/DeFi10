using System.Net.Http.Headers;
using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Options;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Infrastructure.CoinMarketCap.Models;

namespace DeFi10.API.Services.Infrastructure.CoinMarketCap;

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
            _logger.LogInformation("[CMC] Service initialized - Enabled=true, BaseUrl={BaseUrl}, Timeout={Timeout}ms", _opts.BaseUrl, _opts.TimeoutMs);
        }
        else
        {
            _opts.Enabled = false;
            _logger.LogWarning("[CMC] Service disabled (missing api key or disabled flag) - Enabled={Enabled}, HasApiKey={HasKey}", 
                _opts.Enabled, !string.IsNullOrWhiteSpace(_opts.ApiKey));
        }
    }

    public async Task<CmcQuotesLatestV2Response?> GetQuotesLatestV2Async(IEnumerable<string> symbols, CancellationToken ct = default)
    {
        var list = symbols.Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        
        if (!_opts.Enabled)
        {
            _logger.LogWarning("[CMC] Service is disabled, returning empty response");
            return new CmcQuotesLatestV2Response();
        }
        
        if (list.Length == 0)
        {
            _logger.LogDebug("[CMC] No symbols provided, returning empty response");
            return new CmcQuotesLatestV2Response();
        }
        
        var joined = string.Join(',', list.Select(s => s.ToUpperInvariant()));
        var url = $"{_opts.BaseUrl}/cryptocurrency/quotes/latest?symbol={joined}";
        
        _logger.LogDebug("[CMC] Requesting prices: symbols={Symbols} url={Url}", joined, url);
        
        try
        {
            using var resp = await _http.GetAsync(url, ct);
            
            _logger.LogDebug("[CMC] Response status: {StatusCode}", resp.StatusCode);
            
            if (resp.StatusCode == (HttpStatusCode)429)
            {
                _logger.LogWarning("[CMC] Rate limited (429) - symbols={Count}", list.Length);
                return new CmcQuotesLatestV2Response();
            }
            if (!resp.IsSuccessStatusCode)
            {
                var errorContent = await resp.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("[CMC] Request failed - status={Status} symbols={Count} error={Error}", 
                    resp.StatusCode, list.Length, errorContent);
                return new CmcQuotesLatestV2Response();
            }
            
            var json = await resp.Content.ReadAsStringAsync(ct);
            _logger.LogDebug("[CMC] Response body length: {Length} bytes", json.Length);
            
            var node = JsonNode.Parse(json);
            if (node == null) 
            {
                _logger.LogWarning("[CMC] Failed to parse JSON response");
                return new CmcQuotesLatestV2Response();
            }
            
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
                
                if (result.Status.ErrorCode != 0)
                {
                    _logger.LogWarning("[CMC] API returned error - code={Code} message={Message}", 
                        result.Status.ErrorCode, result.Status.ErrorMessage);
                }
            }
            
            var dataNode = node["data"] as JsonObject;
            if (dataNode != null)
            {
                _logger.LogDebug("[CMC] Processing {Count} assets from response", dataNode.Count);
                
                var returnedKeys = string.Join(", ", dataNode.Select(kv => $"\"{kv.Key}\""));
                _logger.LogDebug("[CMC] Keys returned by CMC: {Keys}", returnedKeys);
                
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
                            
                            _logger.LogDebug("[CMC] Asset parsed: symbol={Symbol} name={Name} price={Price} currency={Currency}", 
                                asset.Symbol, asset.Name, fq.Price, qkv.Key);
                        }
                    }
                    result.Data[kv.Key] = asset;
                }
                
                _logger.LogDebug("[CMC] Successfully parsed {Count} assets with prices", result.Data.Count);
            }
            else
            {
                _logger.LogWarning("[CMC] No 'data' node found in response");
            }
            
            return result;
        }
        catch (TaskCanceledException) when (ct.IsCancellationRequested)
        {
            _logger.LogDebug("[CMC] Request canceled symbols={Count}", symbols.Count());
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[CMC] Exception while fetching prices for symbols={Symbols}", joined);
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
