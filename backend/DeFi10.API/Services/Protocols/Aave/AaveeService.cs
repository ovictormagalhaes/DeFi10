using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Options;
using DeFi10.API.Configuration;
using DeFi10.API.Models.Cache;
using DeFi10.API.Services.Cache;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Protocols.Aave.Models;
using DeFi10.API.Services.Protocols.Aave.Models.Borrows;
using DeFi10.API.Services.Protocols.Aave.Models.Supplies;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Protocols.Aave;

public class AaveeService : IAaveeService
{
    private readonly HttpClient _httpClient;
    private readonly string _graphqlEndpoint;
    private readonly GraphOptions _graphOptions;
    private readonly ProtocolCacheHelper? _cacheHelper;
    private readonly ILogger<AaveeService>? _logger;

    private const string NETWORK_BASE_ADDRESS = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";
    private const int NETWORK_BASE_CHAIN_ID = 8453;

    private static readonly Dictionary<ChainEnum, (DateTime ts, HashSet<string> addrs)> _wrappersCache = new();
    private static readonly TimeSpan _wrappersTtl = TimeSpan.FromMinutes(60);

    public AaveeService(
        HttpClient httpClient, 
        IOptions<AaveOptions> options,
        IOptions<GraphOptions> graphOptions,
        ProtocolCacheHelper? cacheHelper = null,
        ILogger<AaveeService>? logger = null)
    {
        _httpClient = httpClient;
        _graphqlEndpoint = options.Value.GraphQLEndpoint;
        _graphOptions = graphOptions.Value;
        _cacheHelper = cacheHelper;
        _logger = logger;
    }

    public async Task<AaveGetUserSuppliesResponse> GetUserSupplies(string address, string chain)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        
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
            var result = JsonSerializer.Deserialize<AaveGetUserSuppliesResponse>(json) ?? new AaveGetUserSuppliesResponse();
            sw.Stop();

            return result;
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException)
        {
            Console.WriteLine($"ERROR: AaveeService GetUserSupplies - {ex.Message}");
            throw;
        }
    }

    public async Task<AaveGetUserBorrowsResponse> GetUserBorrows(string address, string chain)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        
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
            var result = JsonSerializer.Deserialize<AaveGetUserBorrowsResponse>(json) ?? new AaveGetUserBorrowsResponse();
            sw.Stop();

            return result;
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

        var marketAddress = NETWORK_BASE_ADDRESS;
        var chainId = NETWORK_BASE_CHAIN_ID;
        if (chain != ChainEnum.Base)
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var requestBody = new
        {
            query = @"
                query GetReserve($marketAddress: String!, $chainId: Int!) {
                  reserve(request: { market: { address: $marketAddress, chainId: $chainId } }) {
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
                && data.TryGetProperty("reserve", out var reserve) && reserve.ValueKind == JsonValueKind.Object)
            {
                if (reserve.TryGetProperty("tokenAddresses", out var ta) && ta.ValueKind == JsonValueKind.Object)
                {
                    if (ta.TryGetProperty("aTokenAddress", out var a) && a.ValueKind == JsonValueKind.String) set.Add(a.GetString()!);
                    if (ta.TryGetProperty("variableDebtTokenAddress", out var v) && v.ValueKind == JsonValueKind.String) set.Add(v.GetString()!);
                    if (ta.TryGetProperty("stableDebtTokenAddress", out var s) && s.ValueKind == JsonValueKind.String) set.Add(s.GetString()!);
                }
            }
            else
            {

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

    /// <summary>
    /// Obtém posições do usuário (supplies e borrows)
    /// </summary>
    public async Task<(AaveGetUserSuppliesResponse supplies, AaveGetUserBorrowsResponse borrows)> GetUserPositionsWithCacheAsync(
        string address, 
        string chain)
    {
        // Buscar dados sempre frescos da API (posições não são cacheadas no MongoDB)
        var suppliesTask = GetUserSupplies(address, chain);
        var borrowsTask = GetUserBorrows(address, chain);
        await Task.WhenAll(suppliesTask, borrowsTask);
        
        return (suppliesTask.Result, borrowsTask.Result);
    }

    public async Task<AaveTransactionHistoryResponse> GetUserTransactionHistoryAsync(string address, string chain)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var protocolId = $"{NETWORK_BASE_ADDRESS}_{address}";
        
        // Tentar buscar do cache primeiro
        if (_cacheHelper != null)
        {
            try
            {
                var cachedDto = await _cacheHelper.GetFromCacheAsync<AaveTransactionHistoryResponse>(
                    protocol: "aave",
                    protocolId: protocolId,
                    walletAddress: address,
                    dataType: "transaction_history",
                    currentValidationHash: new Dictionary<string, object>() // Não validamos hash para transaction history
                );

                if (cachedDto != null)
                {
                    _logger?.LogInformation(
                        "AAVE: ✓ Cache HIT for transaction history {Address} - {Count} transactions",
                        address.Substring(0, 10), cachedDto.Data?.Transactions?.Count ?? 0);
                    return cachedDto;
                }
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "AAVE: Error reading transaction history cache for {Address}", address);
            }
        }
        
        try
        {
            // Mapear chain para subgraph ID (aceita "base", "8453", "Base", etc)
            var chainNormalized = chain.ToLowerInvariant();
            var subgraphId = chainNormalized switch
            {
                "8453" or "base" => _graphOptions.Subgraphs.AaveV3Base,
                "1" or "ethereum" or "eth" => _graphOptions.Subgraphs.AaveV3Ethereum,
                "42161" or "arbitrum" or "arb" => _graphOptions.Subgraphs.AaveV3Arbitrum,
                _ => ""
            };
            
            if (string.IsNullOrEmpty(subgraphId))
            {
                _logger?.LogWarning("AAVE: No subgraph ID configured for chain {Chain}", chain);
                return new AaveTransactionHistoryResponse 
                { 
                    Data = new AaveTransactionHistoryData() 
                };
            }
            
            var graphUrl = _graphOptions.UrlTemplate
                .Replace("{API_KEY}", _graphOptions.ApiKey)
                .Replace("{ID}", subgraphId);
            
            var userLower = address.ToLowerInvariant();
            
            // Query GraphQL para buscar transações do usuário via The Graph
            // Nota: Aave V3 subgraph usa entidades separadas: supplies, redeemUnderlyings, borrows, repays
            var query = @"
                query GetUserTransactions($user: Bytes!) {
                  supplies(
                    where: { user: $user }
                    orderBy: timestamp
                    orderDirection: desc
                    first: 100
                  ) {
                    id
                    timestamp
                    amount
                    reserve {
                      symbol
                      name
                      underlyingAsset
                      decimals
                    }
                  }
                  redeemUnderlyings(
                    where: { user: $user }
                    orderBy: timestamp
                    orderDirection: desc
                    first: 100
                  ) {
                    id
                    timestamp
                    amount
                    reserve {
                      symbol
                      name
                      underlyingAsset
                      decimals
                    }
                  }
                  borrows(
                    where: { user: $user }
                    orderBy: timestamp
                    orderDirection: desc
                    first: 100
                  ) {
                    id
                    timestamp
                    amount
                    reserve {
                      symbol
                      name
                      underlyingAsset
                      decimals
                    }
                  }
                  repays(
                    where: { user: $user }
                    orderBy: timestamp
                    orderDirection: desc
                    first: 100
                  ) {
                    id
                    timestamp
                    amount
                    reserve {
                      symbol
                      name
                      underlyingAsset
                      decimals
                    }
                  }
                }";
            
            var requestBody = new
            {
                query = query,
                variables = new { user = userLower }
            };
            
            var response = await _httpClient.PostAsJsonAsync(graphUrl, requestBody);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger?.LogError(
                    "AAVE: The Graph API error - Status: {Status}, Body: {Body}",
                    response.StatusCode, errorContent);
                    
                // Retornar vazio ao invés de falhar
                return new AaveTransactionHistoryResponse 
                { 
                    Data = new AaveTransactionHistoryData() 
                };
            }
            
            var json = await response.Content.ReadAsStringAsync();
            
            // Parse response
            var graphResponse = JsonSerializer.Deserialize<AaveTransactionHistoryResponse>(json);
            
            if (graphResponse?.Data != null)
            {
                _logger?.LogInformation(
                    "AAVE: Transaction history fetched for {Address} - Deposits: {Deposits}, Withdraws: {Withdraws}, Borrows: {Borrows}, Repays: {Repays}",
                    address.Substring(0, 10),
                    graphResponse.Data.Deposits.Count,
                    graphResponse.Data.Withdraws.Count,
                    graphResponse.Data.Borrows.Count,
                    graphResponse.Data.Repays.Count);
                
                // Salvar no cache
                if (_cacheHelper != null && graphResponse.Data.Transactions.Any())
                {
                    try
                    {
                        await _cacheHelper.SaveToCacheAsync(
                            protocol: "aave",
                            protocolId: protocolId,
                            walletAddress: address,
                            dataType: "transaction_history",
                            chain: chain,
                            body: graphResponse,
                            validationHash: new Dictionary<string, object>(),
                            apiCallDuration: (int)sw.ElapsedMilliseconds,
                            ttlHours: 24 // 24 horas de cache para histórico
                        );
                        
                        _logger?.LogDebug("AAVE: Saved transaction history to cache for {Address}", address);
                    }
                    catch (Exception cacheEx)
                    {
                        _logger?.LogWarning(cacheEx, "AAVE: Failed to save transaction history to cache");
                    }
                }
            }
            
            sw.Stop();
            _logger?.LogInformation(
                "AAVE: Transaction history completed for {Address} - duration: {Duration}ms",
                address, sw.ElapsedMilliseconds);

            return graphResponse ?? new AaveTransactionHistoryResponse 
            { 
                Data = new AaveTransactionHistoryData() 
            };
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "ERROR: AaveeService GetUserTransactionHistoryAsync for address {Address}", address);
            throw;
        }
    }
}
