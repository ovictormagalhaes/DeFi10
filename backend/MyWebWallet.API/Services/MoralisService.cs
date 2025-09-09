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

        public async Task<GetERC20TokenMoralisResponse> GetERC20TokenBalanceAsync(string address, string chain)
        {
            GetERC20TokenMoralisResponse? moralisResponse = null;

            try
            {
                // Construct the API URL
                var url = $"{_baseUrl}/wallets/{address}/tokens?chain={chain}";

                Console.WriteLine($"Fetching tokens from Moralis for wallet {address} on chain {chain}: {url}");

                // Configure the request headers
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
                _httpClient.DefaultRequestHeaders.Add("X-API-Key", _apiKey);

                // Make the HTTP request
                var response = await _httpClient.GetAsync(url);

                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    moralisResponse = JsonSerializer.Deserialize<GetERC20TokenMoralisResponse>(responseJson);
                }
                else
                {
                    Console.WriteLine($"HTTP error fetching tokens: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching tokens from Moralis: {ex.Message}");
            }

            return moralisResponse ?? new GetERC20TokenMoralisResponse();
        }

        public async Task<GetDeFiPositionsMoralisResponse> GetDeFiPositionsAsync(string address, string chain)
        {
            GetDeFiPositionsMoralisResponse? moralisResponse = null;

            try
            {
                // Construct the API URL
                var url = $"{_baseUrl}/wallets/{address}/defi/positions?chain={chain}";

                Console.WriteLine($"Fetching DeFi positions from Moralis for wallet {address} on chain {chain}: {url}");

                // Configure the request headers
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
                _httpClient.DefaultRequestHeaders.Add("X-API-Key", _apiKey);

                // Make the HTTP request
                var response = await _httpClient.GetAsync(url);

                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync();
                    moralisResponse = JsonSerializer.Deserialize<GetDeFiPositionsMoralisResponse>(responseJson);
                }
                else
                {
                    Console.WriteLine($"HTTP error fetching DeFi positions: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching DeFi positions from Moralis: {ex.Message}");
            }

            return moralisResponse ?? new GetDeFiPositionsMoralisResponse();
        }
    }
}