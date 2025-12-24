using DeFi10.API.Infrastructure.Http;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Protocols.Uniswap.Models;

namespace DeFi10.API.Services.Protocols.Uniswap;

public class UniswapV3Service : BaseHttpService, IUniswapV3Service
{
    private readonly string _graphqlEndpoint;
    private readonly string? _apiKey;

    public UniswapV3Service(
        HttpClient httpClient, 
        IConfiguration configuration, 
        ILogger<UniswapV3Service> logger)
        : base(httpClient, logger)
    {
        _graphqlEndpoint = configuration["UniswapV3:GraphQLEndpoint"];
        _apiKey = configuration["UniswapV3:ApiKey"];
    }

    public async Task<UniswapV3GetActivePoolsResponse> GetActivePoolsAsync(string account)
    {
        var request = new { query = BuildGraphQLQuery(account) };

        var headers = string.IsNullOrEmpty(_apiKey) 
            ? null 
            : new Dictionary<string, string> { ["Authorization"] = $"Bearer {_apiKey}" };

        var response = await PostAsync<object, UniswapV3GetActivePoolsResponse>(_graphqlEndpoint, request, headers);
        
        if (response?.Data?.Positions != null && response.Data.Positions.Any())
        {
            // Check if pool metadata is available
            var firstPos = response.Data.Positions.First();
            if (firstPos.Pool != null)
            {
                bool hasTickSpacing = !string.IsNullOrEmpty(firstPos.Pool.TickSpacing);
                bool hasCreatedAt = !string.IsNullOrEmpty(firstPos.Pool.CreatedAtUnix);
                
                if (!hasTickSpacing || !hasCreatedAt)
                {
                    Logger.LogInformation("[UniswapV3Service] Pool metadata partially available - TickSpacing: {HasTickSpacing}, CreatedAt: {HasCreatedAt}",
                        hasTickSpacing, hasCreatedAt);
                }
            }
        }
        
        return response;
    }

    private static string BuildGraphQLQuery(string account)
    {
        return @"{
                bundles(first: 1) {
                    nativePriceUSD
                }
                positions(
                    where: { owner: $owner, liquidity_gt: 0 }
                ) {
                    id
                    liquidity
                    depositedToken0
                    depositedToken1
                    withdrawnToken0
                    withdrawnToken1
                    collectedFeesToken0
                    collectedFeesToken1
                    liquidity
                    feeGrowthInside0LastX128
                    feeGrowthInside1LastX128
                    tickLower
                    tickUpper
                    transaction {
                        timestamp
                    }
                    token0 {
                        id
                        symbol
                        name
                        decimals
                        feesUSD
                        tokenAddress
                        derivedNative
                    }
                    token1{
                        id
                        symbol
                        name
                        decimals
                        feesUSD
                        tokenAddress
                        derivedNative
                    }
                    pool {
                        id
                        feeTier
                        liquidity
                        feeGrowthGlobal0X128
                        feeGrowthGlobal1X128
                        tick
                        tickSpacing
                        sqrtPriceX96
                        createdAtUnix
                    }
                }
            }".Replace("$owner", $"\"{account}\"");
    }
}