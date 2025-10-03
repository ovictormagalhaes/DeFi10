using System.Globalization;
using System.Text.Json;
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

    public bool IsValidAddress(string account) => !string.IsNullOrEmpty(account) && account.StartsWith("0x") && account.Length == 42;

    public async Task<AaveGetUserSuppliesResponse> GetUserSupplies(string address, string chain)
    {
        try
        {
            var requestBody = new
            {
                query = @"
                    query UserSupplies($marketAddress: String!, $chainId: Int!, $user: String!) {
                      userSupplies( request: { markets: [ { address: $marketAddress, chainId: $chainId } ] user: $user }) {
                        market { name chain { chainId } }
                        currency { symbol name address }
                        balance { amount { value } usd }
                        apy { raw decimals value formatted }
                        isCollateral
                        canBeCollateral
                      }
                    }",
                variables = new { marketAddress = NETWORK_BASE_ADDRESS, chainId = NETWORK_BASE_CHAIN_ID, user = address }
            };

            var response = await _httpClient.PostAsJsonAsync(_graphqlEndpoint, requestBody);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync();
                response.EnsureSuccessStatusCode();
            }
            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<AaveGetUserSuppliesResponse>(json) ?? new AaveGetUserSuppliesResponse();
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException)
        {
            Console.WriteLine($"ERROR: AaveeService GetUserSupplies - {ex.Message}");
            throw;
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
                      userBorrows(request: { markets: [{ address: $marketAddress, chainId: $chainId } ] user: $user }) {
                        market { name chain { chainId } }
                        currency { symbol name address }
                        debt { amount { value } usd }
                        apy { raw decimals value formatted }
                      }
                    }",
                variables = new { marketAddress = NETWORK_BASE_ADDRESS, chainId = NETWORK_BASE_CHAIN_ID, user = address }
            };

            var response = await _httpClient.PostAsJsonAsync(_graphqlEndpoint, requestBody);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync();
                response.EnsureSuccessStatusCode();
            }
            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<AaveGetUserBorrowsResponse>(json) ?? new AaveGetUserBorrowsResponse();
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException)
        {
            Console.WriteLine($"ERROR: AaveeService GetUserBorrows - {ex.Message}");
            throw;
        }
    }
}