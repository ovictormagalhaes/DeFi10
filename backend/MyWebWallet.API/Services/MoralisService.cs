using System.Text.Json;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;

namespace MyWebWallet.API.Services
{
    public class MoralisService : IMoralisService
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

        public async Task<MoralisGetERC20TokenResponse> GetERC20TokenBalanceAsync(string address, string chain)
        {
            try
            {
                Console.WriteLine($"DEBUG: MoralisService: Starting GetERC20TokenBalanceAsync for address: {address}, chain: {chain}");
                Console.WriteLine($"DEBUG: MoralisService: Base URL: {_baseUrl}");
                Console.WriteLine($"DEBUG: MoralisService: API Key configured: {!string.IsNullOrEmpty(_apiKey)}");

                // Construct the API URL
                var url = $"{_baseUrl}/wallets/{address}/tokens?chain={chain}";
                Console.WriteLine($"DEBUG: MoralisService: Request URL: {url}");

                // Configure the request headers
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
                _httpClient.DefaultRequestHeaders.Add("X-API-Key", _apiKey);

                Console.WriteLine($"DEBUG: MoralisService: Making HTTP GET request...");

                // Make the HTTP request
                var response = await _httpClient.GetAsync(url);

                Console.WriteLine($"DEBUG: MoralisService: HTTP Response Status: {response.StatusCode}");

                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"DEBUG: MoralisService: Response received, length: {responseJson.Length} characters");

                    var moralisResponse = JsonSerializer.Deserialize<MoralisGetERC20TokenResponse>(responseJson);
                    Console.WriteLine($"SUCCESS: MoralisService: Successfully deserialized ERC20 token response");
                    Console.WriteLine($"DEBUG: MoralisService: Tokens found: {moralisResponse?.Result?.Count ?? 0}");

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
                Console.WriteLine($"DEBUG: MoralisService: Starting GetDeFiPositionsAsync for address: {address}, chain: {chain}");

                // Construct the API URL
                var url = $"{_baseUrl}/wallets/{address}/defi/positions?chain={chain}";
                Console.WriteLine($"DEBUG: MoralisService: Request URL: {url}");

                // Configure the request headers
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
                _httpClient.DefaultRequestHeaders.Add("X-API-Key", _apiKey);

                Console.WriteLine($"DEBUG: MoralisService: Making HTTP GET request...");

                // Make the HTTP request
                var response = await _httpClient.GetAsync(url);

                Console.WriteLine($"DEBUG: MoralisService: HTTP Response Status: {response.StatusCode}");

                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"DEBUG: MoralisService: Response received, length: {responseJson.Length} characters");

                    var moralisResponse = JsonSerializer.Deserialize<MoralisGetDeFiPositionsResponse>(responseJson);
                    Console.WriteLine($"SUCCESS: MoralisService: Successfully deserialized DeFi positions response");

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
                Console.WriteLine($"ERROR: MoralisService: Stack trace - {ex.StackTrace}");
                throw new Exception($"MoralisService unexpected error: {ex.Message}", ex);
            }
        }
    }
}