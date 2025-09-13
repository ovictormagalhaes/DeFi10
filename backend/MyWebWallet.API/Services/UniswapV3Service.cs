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
            Console.WriteLine($"DEBUG: UniswapV3Service: Starting GetActivePoolsAsync for account: {account}");
            Console.WriteLine($"DEBUG: UniswapV3Service: GraphQL Endpoint: {_graphqlEndpoint}");
            Console.WriteLine($"DEBUG: UniswapV3Service: API Key configured: {!string.IsNullOrEmpty(_apiKey)}");

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

            Console.WriteLine($"DEBUG: UniswapV3Service: GraphQL Query prepared");

            _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiKey);

            Console.WriteLine($"DEBUG: UniswapV3Service: Making HTTP POST request...");
            var response = await _httpClient.PostAsJsonAsync(_graphqlEndpoint, request);
            
            Console.WriteLine($"DEBUG: UniswapV3Service: HTTP Response Status: {response.StatusCode}");
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"ERROR: UniswapV3Service: HTTP Error - Status: {response.StatusCode}, Content: {errorContent}");
                response.EnsureSuccessStatusCode();
            }

            var jsonResponse = await response.Content.ReadAsStringAsync();
            Console.WriteLine($"DEBUG: UniswapV3Service: Response received, length: {jsonResponse.Length} characters");

            var data = JsonSerializer.Deserialize<UniswapV3GetActivePoolsResponse>(jsonResponse);
            
            Console.WriteLine($"SUCCESS: UniswapV3Service: Successfully deserialized response");
            Console.WriteLine($"DEBUG: UniswapV3Service: Positions found: {data?.Data?.Positions?.Count ?? 0}");

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
            Console.WriteLine($"ERROR: UniswapV3Service: Stack trace - {ex.StackTrace}");
            throw new Exception($"UniswapV3Service unexpected error: {ex.Message}", ex);
        }
    }
}