using Microsoft.Extensions.Options;
using MyWebWallet.API.Configuration;
using MyWebWallet.API.Infrastructure.Http;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services;


public class MoralisEVMService : BaseHttpService, IMoralisService, IChainSupportService
{
    private readonly string _apiKey;
    private readonly string _baseUrl;
    private readonly IProtocolConfigurationService _protocolConfig;

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
        var moralis = _protocolConfig.GetProtocol("moralis");
        if (moralis != null)
        {
            var entry = moralis.ChainSupports.FirstOrDefault(c => string.Equals(c.Chain, chain.ToString(), StringComparison.OrdinalIgnoreCase));
            if (entry != null && entry.Settings.TryGetValue("chainId", out var cid) && !string.IsNullOrWhiteSpace(cid))
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
        var url = $"{_baseUrl}/wallets/{address}/tokens?chain={apiChain}&exclude_spam=true";
        var headers = new Dictionary<string, string> { ["X-API-Key"] = _apiKey };
        
        return await GetAsync<MoralisGetERC20TokenResponse>(url, headers);
    }

    public async Task<MoralisGetDeFiPositionsResponse> GetDeFiPositionsAsync(string address, string chain)
    {
        var apiChain = ResolveApiChain(chain);
        var url = $"{_baseUrl}/wallets/{address}/defi/positions?chain={apiChain}";
        var headers = new Dictionary<string, string> { ["X-API-Key"] = _apiKey };
        
        return await GetAsync<MoralisGetDeFiPositionsResponse>(url, headers);
    }
}
