using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace MyWebWallet.API.Services;

public class UniswapV3Service : IUniswapV3Service
{
    private readonly HttpClient _httpClient;
    private readonly string _graphqlEndpoint;
    private readonly string? _apiKey;

    public UniswapV3Service(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _graphqlEndpoint = configuration["UniswapV3:GraphQLEndpoint"];
        _apiKey = configuration["UniswapV3:ApiKey"];
    }

    public async Task<UniswapV3GetActivePoolsResponse> GetActivePoolsAsync(string account)
    {
        try
        {
            var request = new { 
                query = @"
                    {
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
                        }
                    }
                }".Replace("$owner", $"\"{account}\"")
            };

            _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);

            var response = await _httpClient.PostAsJsonAsync(_graphqlEndpoint, request);
                        
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"ERROR: UniswapV3Service: HTTP Error - Status: {response.StatusCode}, Content: {errorContent}");
                response.EnsureSuccessStatusCode();
            }

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<UniswapV3GetActivePoolsResponse>(jsonResponse);
            
            return data ?? new UniswapV3GetActivePoolsResponse();
        }
        catch (HttpRequestException ex)
        {
            Console.WriteLine($"ERROR: UniswapV3Service: HTTP Request failed - {ex.Message}");
            throw new Exception($"UniswapV3Service HTTP error: {ex.Message}", ex);
        }
        catch (JsonException ex)
        {
            Console.WriteLine($"ERROR: UniswapV3Service: JSON Deserialization failed - {ex.Message}");
            throw new Exception($"UniswapV3Service JSON error: {ex.Message}", ex);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: UniswapV3Service: Unexpected error - {ex.Message}");
            throw new Exception($"UniswapV3Service unexpected error: {ex.Message}", ex);
        }
    }
}