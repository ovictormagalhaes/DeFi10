using System.Text.Json;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services
{
    public class MoralisService : IMoralisService, IChainSupportService
    {
        private readonly HttpClient _httpClient;
        private readonly string _apiKey;
        private readonly string _baseUrl;

        public MoralisService(HttpClient httpClient, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _apiKey = configuration["Moralis:ApiKey"];
            _baseUrl = configuration["Moralis:BaseUrl"];
        }

        public string GetProtocolName() => "Moralis";

        public bool SupportsChain(ChainEnum chain)
        {
            return GetSupportedChains().Contains(chain);
        }

        public IEnumerable<ChainEnum> GetSupportedChains()
        {
            return new[] { ChainEnum.Base, ChainEnum.BNB };
        }

        public async Task<MoralisGetERC20TokenResponse> GetERC20TokenBalanceAsync(string address, ChainEnum chain)
        {
            if (!SupportsChain(chain))
                throw new NotSupportedException($"Chain {chain} is not supported by {GetProtocolName()}");

            return await GetERC20TokenBalanceAsync(address, chain.ToChainId());
        }

        public async Task<MoralisGetERC20TokenResponse> GetERC20TokenBalanceAsync(string address, string chain)
        {
            try
            {
                // Construct the API URL
                var url = $"{_baseUrl}/wallets/{address}/tokens?chain={chain}&exclude_spam=true";

                // Configure the request headers
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
                _httpClient.DefaultRequestHeaders.Add("X-API-Key", _apiKey);

                // Make the HTTP request
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
                    Console.WriteLine($"ERROR: MoralisService: HTTP error - Status: {response.StatusCode}, Content: {errorContent}");
                    throw new HttpRequestException($"Moralis API returned {response.StatusCode}: {errorContent}");
                }
            }
            catch (HttpRequestException ex)
            {
                Console.WriteLine($"ERROR: MoralisService: HTTP Request failed in GetERC20TokenBalanceAsync - {ex.Message}");
                throw new Exception($"MoralisService HTTP error: {ex.Message}", ex);
            }
            catch (JsonException ex)
            {
                Console.WriteLine($"ERROR: MoralisService: JSON Deserialization failed in GetERC20TokenBalanceAsync - {ex.Message}");
                throw new Exception($"MoralisService JSON error: {ex.Message}", ex);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: MoralisService: Unexpected error in GetERC20TokenBalanceAsync - {ex.Message}");
                Console.WriteLine($"ERROR: MoralisService: Stack trace - {ex.StackTrace}");
                throw new Exception($"MoralisService unexpected error: {ex.Message}", ex);
            }
        }

        public async Task<MoralisGetDeFiPositionsResponse> GetDeFiPositionsAsync(string address, string chain)
        {
            try
            {
                // Construct the API URL
                var url = $"{_baseUrl}/wallets/{address}/defi/positions?chain={chain}";
                
                // Configure the request headers
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
                _httpClient.DefaultRequestHeaders.Add("X-API-Key", _apiKey);

                // Make the HTTP request
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
                    Console.WriteLine($"ERROR: MoralisService: HTTP error - Status: {response.StatusCode}, Content: {errorContent}");
                    throw new HttpRequestException($"Moralis API returned {response.StatusCode}: {errorContent}");
                }
            }
            catch (HttpRequestException ex)
            {
                Console.WriteLine($"ERROR: MoralisService: HTTP Request failed in GetDeFiPositionsAsync - {ex.Message}");
                throw new Exception($"MoralisService HTTP error: {ex.Message}", ex);
            }
            catch (JsonException ex)
            {
                Console.WriteLine($"ERROR: MoralisService: JSON Deserialization failed in GetDeFiPositionsAsync - {ex.Message}");
                throw new Exception($"MoralisService JSON error: {ex.Message}", ex);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: MoralisService: Unexpected error in GetDeFiPositionsAsync - {ex.Message}");
                throw new Exception($"MoralisService unexpected error: {ex.Message}", ex);
            }
        }
    }
}