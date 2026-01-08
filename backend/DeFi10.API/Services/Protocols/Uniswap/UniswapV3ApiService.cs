using DeFi10.API.Services.Protocols.Uniswap.Models;
using System.Text.Json;

namespace DeFi10.API.Services.Protocols.Uniswap;

public interface IUniswapV3ApiService
{
    Task<Dictionary<string, decimal>> GetPoolAprsAsync(IEnumerable<string> poolIds, string graphqlEndpoint);
}

public class UniswapV3ApiService : IUniswapV3ApiService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<UniswapV3ApiService> _logger;

    public UniswapV3ApiService(HttpClient httpClient, ILogger<UniswapV3ApiService> logger)
    {
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<Dictionary<string, decimal>> GetPoolAprsAsync(IEnumerable<string> poolIds, string graphqlEndpoint)
    {
        var result = new Dictionary<string, decimal>();

        if (!poolIds.Any())
        {
            _logger.LogDebug("[Uniswap V3 API] No pool IDs provided");
            return result;
        }

        if (string.IsNullOrEmpty(graphqlEndpoint))
        {
            _logger.LogWarning("[Uniswap V3 API] GraphQL endpoint is null or empty");
            return result;
        }

        try
        {
            var poolIdsArray = poolIds.ToArray();
            _logger.LogInformation("[Uniswap V3 API] Fetching pool stats for {Count} pools from {Endpoint}", poolIdsArray.Length, graphqlEndpoint);

            // Build GraphQL query to get pool day data (24h stats)
            var poolIdsFilter = string.Join("\",\"", poolIdsArray.Select(id => id.ToLowerInvariant()));
            var query = $@"
            {{
                pools(where: {{id_in: [""{poolIdsFilter}""]}}) {{
                    id
                    feeTier
                    totalValueLockedUSD
                    poolDayData(first: 1, orderBy: date, orderDirection: desc) {{
                        volumeUSD
                        feesUSD
                    }}
                }}
            }}";

            var requestBody = new
            {
                query = query.Trim()
            };

            var response = await _httpClient.PostAsJsonAsync(graphqlEndpoint, requestBody);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("[Uniswap V3 API] GraphQL request failed with status {Status}", response.StatusCode);
                return result;
            }

            var content = await response.Content.ReadAsStringAsync();
            var jsonDoc = JsonDocument.Parse(content);

            if (!jsonDoc.RootElement.TryGetProperty("data", out var dataElement) ||
                !dataElement.TryGetProperty("pools", out var poolsElement))
            {
                _logger.LogWarning("[Uniswap V3 API] Invalid response structure");
                return result;
            }

            foreach (var poolElement in poolsElement.EnumerateArray())
            {
                try
                {
                    var poolId = poolElement.GetProperty("id").GetString();
                    if (string.IsNullOrEmpty(poolId)) continue;

                    var tvlStr = poolElement.GetProperty("totalValueLockedUSD").GetString();
                    if (!decimal.TryParse(tvlStr, out var tvl) || tvl <= 0) continue;

                    // Get 24h fees from most recent pool day data
                    if (!poolElement.TryGetProperty("poolDayData", out var dayDataArray)) continue;
                    
                    var dayDataList = dayDataArray.EnumerateArray().ToList();
                    if (!dayDataList.Any()) continue;

                    var latestDay = dayDataList.First();
                    var feesStr = latestDay.GetProperty("feesUSD").GetString();
                    
                    if (!decimal.TryParse(feesStr, out var fees24h) || fees24h <= 0) continue;

                    // Calculate APR: (24h fees * 365 / TVL) * 100
                    var apr = (fees24h * 365m / tvl) * 100m;
                    
                    result[poolId] = apr;
                    
                    _logger.LogDebug("[Uniswap V3 API] Pool {PoolId}: TVL=${TVL}, 24h Fees=${Fees}, APR={APR}%", 
                        poolId, tvl, fees24h, apr);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[Uniswap V3 API] Failed to parse pool data");
                }
            }

            _logger.LogInformation("[Uniswap V3 API] Successfully calculated APRs for {Count}/{Total} pools", 
                result.Count, poolIdsArray.Length);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Uniswap V3 API] Failed to fetch pool APRs");
        }

        return result;
    }
}
