using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Solnet.Wallet;

namespace DeFi10.API.Services.Protocols.Raydium.Clmm
{
    public class RaydiumApiService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<RaydiumApiService> _logger;
        private const string API_BASE_URL = "https://api-v3.raydium.io";

        public RaydiumApiService(HttpClient httpClient, ILogger<RaydiumApiService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _httpClient.Timeout = TimeSpan.FromSeconds(10);
        }

        public async Task<RaydiumPoolInfo?> GetPoolInfoAsync(string poolId)
        {
            try
            {
                _logger.LogDebug("Fetching pool info from Raydium API for pool {PoolId}", poolId);
                
                var url = $"{API_BASE_URL}/pools/info/ids?ids={poolId}";
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Raydium API returned status {StatusCode} for pool {PoolId}", 
                        response.StatusCode, poolId);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync();
                var apiResponse = JsonSerializer.Deserialize<RaydiumApiResponse>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (apiResponse?.Success == true && apiResponse.Data?.Count > 0)
                {
                    var poolData = apiResponse.Data[0];
                    _logger.LogDebug("Successfully fetched pool info for {PoolId} from Raydium API", poolId);
                    return poolData;
                }

                _logger.LogWarning("Raydium API returned empty data for pool {PoolId}", poolId);
                return null;
            }
            catch (TaskCanceledException)
            {
                _logger.LogWarning("Raydium API request timed out for pool {PoolId}", poolId);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching pool info from Raydium API for pool {PoolId}", poolId);
                return null;
            }
        }

        public async Task<List<RaydiumPositionInfo>?> GetPositionsByOwnerAsync(string ownerAddress)
        {
            try
            {
                _logger.LogDebug("Fetching positions from Raydium API for owner {Owner}", ownerAddress);
                
                var url = $"{API_BASE_URL}/clmm/positions?owner={ownerAddress}";
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Raydium API positions endpoint returned status {StatusCode}", 
                        response.StatusCode);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync();
                var positions = JsonSerializer.Deserialize<List<RaydiumPositionInfo>>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                return positions;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching positions from Raydium API for owner {Owner}", ownerAddress);
                return null;
            }
        }
    }

    #region API Response Models

    public class RaydiumApiResponse
    {
        [JsonPropertyName("id")]
        public string? Id { get; set; }

        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("data")]
        public List<RaydiumPoolInfo>? Data { get; set; }
    }

    public class RaydiumPoolInfo
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;

        [JsonPropertyName("programId")]
        public string ProgramId { get; set; } = string.Empty;

        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("mintA")]
        public RaydiumTokenMint MintA { get; set; } = new();

        [JsonPropertyName("mintB")]
        public RaydiumTokenMint MintB { get; set; } = new();

        [JsonPropertyName("price")]
        public decimal Price { get; set; }

        [JsonPropertyName("mintAmountA")]
        public decimal MintAmountA { get; set; }

        [JsonPropertyName("mintAmountB")]
        public decimal MintAmountB { get; set; }

        [JsonPropertyName("feeRate")]
        public decimal FeeRate { get; set; }

        [JsonPropertyName("openTime")]
        public string OpenTime { get; set; } = string.Empty;

        [JsonPropertyName("tvl")]
        public decimal Tvl { get; set; }

        [JsonPropertyName("day")]
        public RaydiumPoolStats? Day { get; set; }

        [JsonPropertyName("week")]
        public RaydiumPoolStats? Week { get; set; }

        [JsonPropertyName("month")]
        public RaydiumPoolStats? Month { get; set; }

        [JsonPropertyName("config")]
        public RaydiumPoolConfig? Config { get; set; }

        [JsonPropertyName("rewardDefaultInfos")]
        public List<RaydiumRewardInfo>? RewardDefaultInfos { get; set; }
    }

    public class RaydiumTokenMint
    {
        [JsonPropertyName("chainId")]
        public int ChainId { get; set; }

        [JsonPropertyName("address")]
        public string Address { get; set; } = string.Empty;

        [JsonPropertyName("programId")]
        public string ProgramId { get; set; } = string.Empty;

        [JsonPropertyName("logoURI")]
        public string? LogoUri { get; set; }

        [JsonPropertyName("symbol")]
        public string Symbol { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("decimals")]
        public int Decimals { get; set; }

        [JsonPropertyName("tags")]
        public List<string>? Tags { get; set; }
    }

    public class RaydiumPoolStats
    {
        [JsonPropertyName("volume")]
        public decimal Volume { get; set; }

        [JsonPropertyName("volumeQuote")]
        public decimal VolumeQuote { get; set; }

        [JsonPropertyName("volumeFee")]
        public decimal VolumeFee { get; set; }

        [JsonPropertyName("apr")]
        public decimal Apr { get; set; }

        [JsonPropertyName("feeApr")]
        public decimal FeeApr { get; set; }

        [JsonPropertyName("priceMin")]
        public decimal PriceMin { get; set; }

        [JsonPropertyName("priceMax")]
        public decimal PriceMax { get; set; }

        [JsonPropertyName("rewardApr")]
        public List<decimal>? RewardApr { get; set; }
    }

    public class RaydiumPoolConfig
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("index")]
        public int Index { get; set; }

        [JsonPropertyName("protocolFeeRate")]
        public int ProtocolFeeRate { get; set; }

        [JsonPropertyName("tradeFeeRate")]
        public int TradeFeeRate { get; set; }

        [JsonPropertyName("tickSpacing")]
        public int TickSpacing { get; set; }

        [JsonPropertyName("fundFeeRate")]
        public int FundFeeRate { get; set; }

        [JsonPropertyName("defaultRange")]
        public decimal DefaultRange { get; set; }

        [JsonPropertyName("defaultRangePoint")]
        public List<decimal>? DefaultRangePoint { get; set; }
    }

    public class RaydiumRewardInfo
    {
        [JsonPropertyName("mint")]
        public RaydiumTokenMint? Mint { get; set; }

        [JsonPropertyName("perSecond")]
        public string PerSecond { get; set; } = string.Empty;

        [JsonPropertyName("startTime")]
        public string StartTime { get; set; } = string.Empty;

        [JsonPropertyName("endTime")]
        public string EndTime { get; set; } = string.Empty;
    }

    public class RaydiumPositionInfo
    {
        [JsonPropertyName("nftMint")]
        public string NftMint { get; set; } = string.Empty;

        [JsonPropertyName("poolId")]
        public string PoolId { get; set; } = string.Empty;

        [JsonPropertyName("tickLower")]
        public int TickLower { get; set; }

        [JsonPropertyName("tickUpper")]
        public int TickUpper { get; set; }

        [JsonPropertyName("liquidity")]
        public string Liquidity { get; set; } = string.Empty;

        [JsonPropertyName("feeOwedA")]
        public string FeeOwedA { get; set; } = string.Empty;

        [JsonPropertyName("feeOwedB")]
        public string FeeOwedB { get; set; } = string.Empty;

        [JsonPropertyName("amountA")]
        public string AmountA { get; set; } = string.Empty;

        [JsonPropertyName("amountB")]
        public string AmountB { get; set; } = string.Empty;
    }

    #endregion
}
