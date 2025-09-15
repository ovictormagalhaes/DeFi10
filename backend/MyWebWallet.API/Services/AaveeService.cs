using System.Net.Http.Json;
using System.Text.Json;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;

namespace MyWebWallet.API.Services;

public class AaveeService : IAaveeService
{
    private readonly HttpClient _httpClient;
    private readonly string _graphqlEndpoint;

    private const string NETWORK_BASE_ADDRESS = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";
    private const int NETWORK_BASE_CHAIN_ID = 8453;

    public AaveeService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _graphqlEndpoint = configuration["Aave:GraphQLEndpoint"];
    }

    public string NetworkName => "Aavee";

    public bool IsValidAddress(string account)
    {
        // Implement validation logic for Aavee wallet addresses
        return !string.IsNullOrEmpty(account) && account.StartsWith("0x") && account.Length == 42;
    }

    public async Task<AaveGetUserSuppliesResponse> GetUserSupplies(string address, string chain)
    {
        try
        {
            var requestBody = new
            {
                query = @"
                    query UserSupplies($marketAddress: String!, $chainId: Int!, $user: String!) {
                      userSupplies(
                        request: {
                          markets: [
                            { address: $marketAddress, chainId: $chainId }
                          ]
                          user: $user
                        }
                      ) {
                        market {
                          name
                          chain {
                            chainId
                          }
                        }
                        currency {
                          symbol
                          name
                          address
                        }
                        balance {
                          amount {
                            value
                          }
                          usd
                        }
                        apy {
                          raw
                          decimals
                          value
                          formatted
                        }
                        isCollateral
                        canBeCollateral
                      }
                    }",
                variables = new
                {
                    marketAddress = NETWORK_BASE_ADDRESS,
                    chainId = NETWORK_BASE_CHAIN_ID,
                    user = address
                }
            };

            var response = await _httpClient.PostAsJsonAsync(_graphqlEndpoint, requestBody);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                response.EnsureSuccessStatusCode();
            }

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<AaveGetUserSuppliesResponse>(jsonResponse);
            
            return data ?? new AaveGetUserSuppliesResponse();
        }
        catch (HttpRequestException ex)
        {
            Console.WriteLine($"ERROR: AaveeService: HTTP Request failed in GetUserSupplies - {ex.Message}");
            throw new Exception($"AaveeService HTTP error: {ex.Message}", ex);
        }
        catch (JsonException ex)
        {
            Console.WriteLine($"ERROR: AaveeService: JSON Deserialization failed in GetUserSupplies - {ex.Message}");
            throw new Exception($"AaveeService JSON error: {ex.Message}", ex);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: AaveeService: Unexpected error in GetUserSupplies - {ex.Message}");
            Console.WriteLine($"ERROR: AaveeService: Stack trace - {ex.StackTrace}");
            throw new Exception($"AaveeService unexpected error: {ex.Message}", ex);
        }
    }

    public async Task<AaveGetUserBorrowsResponse> GetUserBorrows(string address, string chain)
    {
        try
        {
            var requestBody = new
            {
                query = @"
                    query userBorrows($marketAddress: String!, $chainId: Int!, $user: String!) {
                      userBorrows(
                        request: {
                          markets: [
                            { address: $marketAddress, chainId: $chainId }
                          ]
                          user: $user
                        }
                      ) {
                        market {
                          name
                          chain {
                            chainId
                          }
                        }
                        currency {
                          symbol
                          name
                          address
                        }
                        debt {
                          amount {
                            value
                          }
                          usd
                        }
                        apy {
                          raw
                          decimals
                          value
                          formatted
                        }
                      }
                    }",
                variables = new
                {
                    marketAddress = NETWORK_BASE_ADDRESS,
                    chainId = NETWORK_BASE_CHAIN_ID,
                    user = address
                }
            };

            var response = await _httpClient.PostAsJsonAsync(_graphqlEndpoint, requestBody);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                response.EnsureSuccessStatusCode();
            }

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<AaveGetUserBorrowsResponse>(jsonResponse);
            
            return data ?? new AaveGetUserBorrowsResponse();
        }
        catch (HttpRequestException ex)
        {
            Console.WriteLine($"ERROR: AaveeService: HTTP Request failed in GetUserBorrows - {ex.Message}");
            throw new Exception($"AaveeService HTTP error: {ex.Message}", ex);
        }
        catch (JsonException ex)
        {
            Console.WriteLine($"ERROR: AaveeService: JSON Deserialization failed in GetUserBorrows - {ex.Message}");
            throw new Exception($"AaveeService JSON error: {ex.Message}", ex);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: AaveeService: Unexpected error in GetUserBorrows - {ex.Message}");
            Console.WriteLine($"ERROR: AaveeService: Stack trace - {ex.StackTrace}");
            throw new Exception($"AaveeService unexpected error: {ex.Message}", ex);
        }
    }
}