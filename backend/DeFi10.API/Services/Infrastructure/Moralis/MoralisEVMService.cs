using Microsoft.Extensions.Options;
using DeFi10.API.Configuration;
using DeFi10.API.Infrastructure.Http;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Infrastructure.Moralis.Models;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Infrastructure.Moralis;

public class MoralisEVMService : BaseHttpService, IMoralisEVMService, IChainSupportService
{
    private readonly string _apiKey;
    private readonly string _baseUrl;
    private readonly IProtocolConfigurationService _protocolConfig;
    
    // Default limits to filter noise and scams
    private const int DEFAULT_TOKEN_LIMIT = 100;
    private const decimal MIN_LIQUIDITY_USD = 1000m; // $1000 minimum liquidity to filter out scams/new tokens

    public MoralisEVMService(
        HttpClient httpClient, 
        IOptions<MoralisOptions> options, 
        IProtocolConfigurationService protocolConfigurationService, 
        ILogger<MoralisEVMService> logger)
        : base(httpClient, logger)
    {
        _apiKey = options.Value.ApiKey;
        _baseUrl = options.Value.BaseUrl;
        _protocolConfig = protocolConfigurationService;
    }

    public string GetProtocolName() => "Moralis";
    public bool SupportsChain(ChainEnum chain) => GetSupportedChains().Contains(chain);

    public IEnumerable<ChainEnum> GetSupportedChains() =>
    [
        ChainEnum.Base, 
        ChainEnum.BNB, 
        ChainEnum.Arbitrum, 
        ChainEnum.Ethereum 
    ];

    private string ResolveApiChain(ChainEnum chain)
    {
        var moralis = _protocolConfig.GetProtocol(ProtocolNames.Moralis);
        if (moralis != null)
        {
            var entry = moralis.ChainSupports.FirstOrDefault(c => string.Equals(c.Chain, chain.ToString(), StringComparison.OrdinalIgnoreCase));
            if (entry != null && entry.Options.TryGetValue("chainId", out var cid) && !string.IsNullOrWhiteSpace(cid))
                return cid;
        }
        return chain.ToString().ToLowerInvariant();
    }

    private string ResolveApiChain(string chainText)
    {
        if (Enum.TryParse<ChainEnum>(chainText, true, out var parsed))
            return ResolveApiChain(parsed);
        return chainText.ToLowerInvariant();
    }

    public async Task<MoralisGetERC20TokenResponse> GetERC20TokenBalanceAsync(string address, string chain)
    {
        var apiChain = ResolveApiChain(chain);
        var url = $"{_baseUrl}/wallets/{address}/tokens?chain={apiChain}" +
                  $"&exclude_spam=true" +
                  $"&exclude_unverified_contracts=true" +
                  $"&limit={DEFAULT_TOKEN_LIMIT}" +
                  $"&min_pair_side_liquidity_usd={MIN_LIQUIDITY_USD}";
        
        var headers = new Dictionary<string, string> { ["X-API-Key"] = _apiKey };
        
        try
        {
            var response = await GetAsync<MoralisGetERC20TokenResponse>(url, headers);
            
            Logger.LogDebug("[Moralis] Retrieved {Count} tokens for {Address} on {Chain} (filtered by liquidity >= ${MinLiquidity})", 
                response.Result?.Count ?? 0, address, chain, MIN_LIQUIDITY_USD);
            
            return response;
        }
        catch (HttpRequestException httpEx) when (httpEx.StatusCode == System.Net.HttpStatusCode.BadRequest)
        {
            // Check if error is "too many tokens" - try pagination fallback
            var errorMessage = httpEx.Message;
            if (errorMessage.Contains("too many ERC20 token balances", StringComparison.OrdinalIgnoreCase))
            {
                Logger.LogWarning("[Moralis] Wallet {Address} has too many tokens on {Chain}, attempting paginated fetch (limit=500)", 
                    address, chain);
                
                return await GetERC20TokenBalancePaginatedAsync(address, chain, limit: 500);
            }
            
            // Re-throw if it's a different 400 error
            throw;
        }
    }
    
    /// <summary>
    /// Fetches ERC20 token balances with pagination for wallets that have too many tokens.
    /// Returns first page only to avoid timeout - most relevant tokens are usually in first results.
    /// </summary>
    private async Task<MoralisGetERC20TokenResponse> GetERC20TokenBalancePaginatedAsync(
        string address, 
        string chain, 
        int limit = 500,
        string? cursor = null)
    {
        var apiChain = ResolveApiChain(chain);
        var url = $"{_baseUrl}/wallets/{address}/tokens?chain={apiChain}" +
                  $"&exclude_spam=true" +
                  $"&exclude_unverified_contracts=true" +
                  $"&limit={limit}" +
                  $"&min_pair_side_liquidity_usd={MIN_LIQUIDITY_USD}";
        
        if (!string.IsNullOrEmpty(cursor))
        {
            url += $"&cursor={cursor}";
        }
        
        var headers = new Dictionary<string, string> { ["X-API-Key"] = _apiKey };
        
        try
        {
            var response = await GetAsync<MoralisGetERC20TokenResponse>(url, headers);
            
            Logger.LogInformation("[Moralis] Paginated fetch returned {Count} tokens for {Address} on {Chain} (hasMore={HasMore}, minLiquidity=${MinLiquidity})", 
                response.Result?.Count ?? 0, address, chain, !string.IsNullOrEmpty(response.Cursor), MIN_LIQUIDITY_USD);
            
            // Log warning if there are more pages
            if (!string.IsNullOrEmpty(response.Cursor))
            {
                Logger.LogWarning("[Moralis] Wallet {Address} has MORE than {Limit} tokens on {Chain}. " +
                    "Only first {Count} tokens returned to avoid timeout. Consider implementing full pagination or filtering.",
                    address, limit, chain, response.Result?.Count ?? 0);
            }
            
            return response;
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "[Moralis] Paginated fetch failed for {Address} on {Chain}", address, chain);
            
            // Return empty response instead of throwing to prevent aggregation failure
            Logger.LogWarning("[Moralis] Returning empty token list for {Address} on {Chain} due to fetch error", address, chain);
            return new MoralisGetERC20TokenResponse 
            { 
                Result = new List<TokenDetail>(),
                Cursor = null
            };
        }
    }

    public async Task<MoralisGetDeFiPositionsResponse> GetDeFiPositionsAsync(string address, string chain)
    {
        var apiChain = ResolveApiChain(chain);
        var url = $"{_baseUrl}/wallets/{address}/defi/positions?chain={apiChain}";
        var headers = new Dictionary<string, string> { ["X-API-Key"] = _apiKey };
        
        return await GetAsync<MoralisGetDeFiPositionsResponse>(url, headers);
    }

    public async Task<MoralisGetNFTsResponse> GetNFTsAsync(string address, string chain)
    {
        var apiChain = ResolveApiChain(chain);
        var url = $"{_baseUrl}/{address}/nft?chain={apiChain}&format=decimal&media_items=false&exclude_spam=true";
        var headers = new Dictionary<string, string> { ["X-API-Key"] = _apiKey };
        
        return await GetAsync<MoralisGetNFTsResponse>(url, headers);
    }
}
