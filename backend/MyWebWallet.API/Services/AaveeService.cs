using System.Globalization;
using System.Text.Json;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services;

public class AaveeService : IAaveeService
{
    private readonly HttpClient _httpClient;
    private readonly string _graphqlEndpoint;

    private const string NETWORK_BASE_ADDRESS = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";
    private const int NETWORK_BASE_CHAIN_ID = 8453;

    // simple in-memory cache per chain
    private static readonly Dictionary<ChainEnum, (DateTime ts, HashSet<string> addrs)> _wrappersCache = new();
    private static readonly TimeSpan _wrappersTtl = TimeSpan.FromMinutes(60);

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

    public async Task<HashSet<string>> GetWrapperTokenAddressesAsync(ChainEnum chain)
    {
        if (_wrappersCache.TryGetValue(chain, out var cached) && (DateTime.UtcNow - cached.ts) < _wrappersTtl)
            return cached.addrs;

        // For now only Base is supported with constants; extend with other chains later
        var marketAddress = NETWORK_BASE_ADDRESS;
        var chainId = NETWORK_BASE_CHAIN_ID;
        if (chain != ChainEnum.Base)
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var requestBody = new
        {
            query = @"
                query GetReserves($marketAddress: String!, $chainId: Int!) {
                  reserve(request: { markets: [{ address: $marketAddress, chainId: $chainId }] }) {
                    currency { address }
                    tokenAddresses {
                      aTokenAddress
                      variableDebtTokenAddress
                      stableDebtTokenAddress
                    }
                  }
                }",
            variables = new { marketAddress, chainId }
        };

        try
        {
            var response = await _httpClient.PostAsJsonAsync(_graphqlEndpoint, requestBody);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            // Handle GraphQL error payloads like { "errors": [...], "data": null }
            if (doc.RootElement.TryGetProperty("errors", out var errorsEl) && errorsEl.ValueKind == JsonValueKind.Array)
            {
                try
                {
                    var firstErr = errorsEl.EnumerateArray().FirstOrDefault();
                    var msg = firstErr.ValueKind == JsonValueKind.Object && firstErr.TryGetProperty("message", out var msgEl) && msgEl.ValueKind == JsonValueKind.String
                        ? msgEl.GetString()
                        : errorsEl.ToString();
                    Console.WriteLine($"ERROR: AaveeService GetWrapperTokenAddressesAsync - GraphQL errors: {msg}");
                }
                catch
                {
                    Console.WriteLine("ERROR: AaveeService GetWrapperTokenAddressesAsync - GraphQL errors present");
                }
                return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            }

            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (doc.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Object
                && data.TryGetProperty("reserve", out var reserve) && reserve.ValueKind == JsonValueKind.Array)
            {
                foreach (var r in reserve.EnumerateArray())
                {
                    if (r.ValueKind != JsonValueKind.Object) continue;
                    if (r.TryGetProperty("tokenAddresses", out var ta) && ta.ValueKind == JsonValueKind.Object)
                    {
                        if (ta.TryGetProperty("aTokenAddress", out var a) && a.ValueKind == JsonValueKind.String) set.Add(a.GetString()!);
                        if (ta.TryGetProperty("variableDebtTokenAddress", out var v) && v.ValueKind == JsonValueKind.String) set.Add(v.GetString()!);
                        if (ta.TryGetProperty("stableDebtTokenAddress", out var s) && s.ValueKind == JsonValueKind.String) set.Add(s.GetString()!);
                    }
                }
            }
            else
            {
                // Unexpected shape or data is null
                Console.WriteLine("ERROR: AaveeService GetWrapperTokenAddressesAsync - Unexpected GraphQL response shape (data null or not object)");
            }

            _wrappersCache[chain] = (DateTime.UtcNow, set);
            return set;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: AaveeService GetWrapperTokenAddressesAsync - {ex.Message}");
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }
    }
}