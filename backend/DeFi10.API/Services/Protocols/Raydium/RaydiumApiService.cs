using DeFi10.API.Services.Protocols.Raydium.Models;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace DeFi10.API.Services.Protocols.Raydium
{
    public interface IRaydiumApiService
    {
        Task<Dictionary<string, decimal>> GetPoolAprsAsync(IEnumerable<string> poolIds);
    }

    public class RaydiumApiService : IRaydiumApiService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<RaydiumApiService> _logger;
        private const string BASE_URL = "https://api-v3.raydium.io";

        public RaydiumApiService(HttpClient httpClient, ILogger<RaydiumApiService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _httpClient.BaseAddress = new Uri(BASE_URL);
        }

        public async Task<Dictionary<string, decimal>> GetPoolAprsAsync(IEnumerable<string> poolIds)
        {
            var result = new Dictionary<string, decimal>();
            
            if (!poolIds.Any())
                return result;

            try
            {
                var idsParam = string.Join(",", poolIds);
                var url = $"/pools/info/ids?ids={idsParam}";
                
                _logger.LogInformation("[Raydium API] Fetching pool APRs for {Count} pools", poolIds.Count());
                
                var response = await _httpClient.GetFromJsonAsync<RaydiumPoolStatsResponse>(url);
                
                if (response?.Data != null && response.Success)
                {
                    // API returns array of pool stats in Data property
                    foreach (var pool in response.Data)
                    {
                        if (!string.IsNullOrEmpty(pool.Id) && pool.Day != null)
                        {
                            // Use day APR as the primary metric
                            result[pool.Id] = pool.Day.Apr;
                            _logger.LogDebug("[Raydium API] Pool {PoolId}: APR={Apr}%, TVL=${Tvl}", 
                                pool.Id, pool.Day.Apr, pool.Tvl);
                        }
                    }
                    
                    _logger.LogInformation("[Raydium API] Successfully fetched APRs for {Count} pools", result.Count);
                }
                else
                {
                    _logger.LogWarning("[Raydium API] No data returned or request failed");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Raydium API] Failed to fetch pool APRs");
            }

            return result;
        }
    }
}
