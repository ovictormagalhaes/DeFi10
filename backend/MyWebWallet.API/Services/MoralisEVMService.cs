using System.Text.Json;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Models;
using MyWebWallet.API.Configuration;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services;

/// <summary>
/// Moralis service for EVM chains (Ethereum, Base, Arbitrum, BNB, etc.)
/// Uses Moralis EVM Web3 Data API
/// </summary>
public class MoralisEVMService : IMoralisService, IChainSupportService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly string _baseUrl;
    private readonly IProtocolConfigurationService _protocolConfig;

    public MoralisEVMService(HttpClient httpClient, IConfiguration configuration, IProtocolConfigurationService protocolConfigurationService)
    {
        _httpClient = httpClient;
        _apiKey = configuration["Moralis:ApiKey"] ?? string.Empty;
        _baseUrl = configuration["Moralis:BaseUrl"] ?? string.Empty;
        _protocolConfig = protocolConfigurationService;
    }

    public string GetProtocolName() => "Moralis";
    public bool SupportsChain(ChainEnum chain) => GetSupportedChains().Contains(chain);
    
    // EVM chains only - Solana handled by MoralisSolanaService
    public IEnumerable<ChainEnum> GetSupportedChains() => new [] 
    { 
        ChainEnum.Base, 
        ChainEnum.BNB, 
        ChainEnum.Arbitrum, 
        ChainEnum.Ethereum 
    };

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
        try
        {
            var url = $"{_baseUrl}/wallets/{address}/tokens?chain={apiChain}&exclude_spam=true";
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
            _httpClient.DefaultRequestHeaders.Add("X-API-Key", _apiKey);
            var response = await _httpClient.GetAsync(url);
            if (response.IsSuccessStatusCode)
            {
                var responseJson = await response.Content.ReadAsStringAsync();
                var moralisResponse = JsonSerializer.Deserialize<MoralisGetERC20TokenResponse>(responseJson);
                return moralisResponse ?? new MoralisGetERC20TokenResponse();
            }
            else
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"ERROR: MoralisEVMService: HTTP error - Status: {response.StatusCode}, Chain={apiChain}, Content: {errorContent}");
                throw new HttpRequestException($"Moralis EVM API returned {response.StatusCode}: {errorContent}");
            }
        }
        catch (HttpRequestException ex)
        {
            Console.WriteLine($"ERROR: MoralisEVMService: HTTP Request failed in GetERC20TokenBalanceAsync - {ex.Message}");
            throw new Exception($"MoralisEVMService HTTP error: {ex.Message}", ex);
        }
        catch (JsonException ex)
        {
            Console.WriteLine($"ERROR: MoralisEVMService: JSON Deserialization failed in GetERC20TokenBalanceAsync - {ex.Message}");
            throw new Exception($"MoralisEVMService JSON error: {ex.Message}", ex);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: MoralisEVMService: Unexpected error in GetERC20TokenBalanceAsync - {ex.Message}");
            throw new Exception($"MoralisEVMService unexpected error: {ex.Message}", ex);
        }
    }

    public async Task<MoralisGetDeFiPositionsResponse> GetDeFiPositionsAsync(string address, string chain)
    {
        var apiChain = ResolveApiChain(chain);
        try
        {
            var url = $"{_baseUrl}/wallets/{address}/defi/positions?chain={apiChain}";
            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
            _httpClient.DefaultRequestHeaders.Add("X-API-Key", _apiKey);
            var response = await _httpClient.GetAsync(url);
            if (response.IsSuccessStatusCode)
            {
                var responseJson = await response.Content.ReadAsStringAsync();
                var moralisResponse = JsonSerializer.Deserialize<MoralisGetDeFiPositionsResponse>(responseJson);
                return moralisResponse ?? new MoralisGetDeFiPositionsResponse();
            }
            else
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"ERROR: MoralisEVMService: HTTP error - Status: {response.StatusCode}, Chain={apiChain}, Content: {errorContent}");
                throw new HttpRequestException($"Moralis EVM API returned {response.StatusCode}: {errorContent}");
            }
        }
        catch (HttpRequestException ex)
        {
            Console.WriteLine($"ERROR: MoralisEVMService: HTTP Request failed in GetDeFiPositionsAsync - {ex.Message}");
            throw new Exception($"MoralisEVMService HTTP error: {ex.Message}", ex);
        }
        catch (JsonException ex)
        {
            Console.WriteLine($"ERROR: MoralisEVMService: JSON Deserialization failed in GetDeFiPositionsAsync - {ex.Message}");
            throw new Exception($"MoralisEVMService JSON error: {ex.Message}", ex);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: MoralisEVMService: Unexpected error in GetDeFiPositionsAsync - {ex.Message}");
            throw new Exception($"MoralisEVMService unexpected error: {ex.Message}", ex);
        }
    }
}
