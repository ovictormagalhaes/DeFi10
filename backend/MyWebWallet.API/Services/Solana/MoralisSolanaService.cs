using System.Text.Json;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Solana
{
    /// <summary>
    /// Moralis service for Solana blockchain
    /// Uses Moralis Solana Web3 Data API: https://docs.moralis.com/web3-data-api/solana
    /// </summary>
    public class MoralisSolanaService : IMoralisSolanaService
    {
        private readonly HttpClient _httpClient;
        private readonly string _apiKey;
        private readonly string _baseUrl;
        private readonly ILogger<MoralisSolanaService> _logger;

        public MoralisSolanaService(HttpClient httpClient, IConfiguration configuration, ILogger<MoralisSolanaService> logger)
        {
            _httpClient = httpClient;
            _apiKey = configuration["Moralis:ApiKey"] ?? throw new InvalidOperationException("Moralis:ApiKey is required");
            _baseUrl = configuration["Moralis:SolanaBaseUrl"] ?? configuration["Moralis:BaseUrl"] ?? "https://solana-gateway.moralis.io";
            _logger = logger;
        }

        public string GetProtocolName() => "Moralis Solana";

        public bool SupportsChain(ChainEnum chain) => chain == ChainEnum.Solana;

        public IEnumerable<ChainEnum> GetSupportedChains() => new[] { ChainEnum.Solana };

        public async Task<SolanaTokenResponse> GetTokensAsync(string address, ChainEnum chain)
        {
            if (chain != ChainEnum.Solana)
                throw new NotSupportedException($"MoralisSolanaService only supports Solana chain, got {chain}");

            try
            {
                // Use the /portfolio endpoint for a consolidated view
                var url = $"{_baseUrl}/account/mainnet/{address}/portfolio?nftMetadata=false&mediaItems=false&excludeSpam=true";
                
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
                _httpClient.DefaultRequestHeaders.Add("X-API-Key", _apiKey);

                _logger.LogInformation("Fetching Solana portfolio for address {Address}", address);
                
                var response = await _httpClient.GetAsync(url);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Moralis Solana API error - Status: {Status}, Content: {Content}", response.StatusCode, errorContent);
                    throw new HttpRequestException($"Moralis Solana API returned {response.StatusCode}: {errorContent}");
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                _logger.LogDebug("Moralis Solana Portfolio API response: {Response}", responseJson);
                
                var portfolio = JsonSerializer.Deserialize<MoralisSolanaPortfolioResponse>(responseJson);

                if (portfolio == null)
                {
                    _logger.LogWarning("Failed to deserialize Solana portfolio response for address {Address}", address);
                    return new SolanaTokenResponse { Tokens = new List<SplToken>() };
                }

                var tokens = new List<SplToken>();

                // Add native SOL from the portfolio response
                if (portfolio.NativeBalance != null && decimal.TryParse(portfolio.NativeBalance.Solana, out var nativeBalanceSol) && nativeBalanceSol > 0)
                {
                    // Price can be hydrated later by the price service
                    tokens.Add(new SplToken
                    {
                        Mint = "So11111111111111111111111111111111111111112",
                        Symbol = "SOL",
                        Name = "Solana",
                        Decimals = 9,
                        Amount = nativeBalanceSol,
                        Logo = "https://moralis.com/wp-content/uploads/2022/12/Solana.svg"
                    });
                    _logger.LogDebug("Added native SOL balance: {Balance} SOL", nativeBalanceSol);
                }

                // Add SPL tokens from the portfolio response
                foreach (var token in portfolio.Tokens)
                {
                    if (decimal.TryParse(token.Amount, out var amount) && amount > 0)
                    {
                        tokens.Add(new SplToken
                        {
                            Mint = token.Mint,
                            Symbol = token.Symbol,
                            Name = token.Name,
                            Decimals = token.Decimals,
                            Amount = amount,
                            Logo = token.Logo
                        });
                    }
                }

                _logger.LogInformation("Successfully fetched {Count} Solana tokens from portfolio for address {Address}", tokens.Count, address);

                return new SolanaTokenResponse
                {
                    Tokens = tokens,
                    NativeBalanceUsd = null // Price service will handle this
                };
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "HTTP error fetching Solana portfolio for address {Address}", address);
                throw new Exception($"MoralisSolanaService HTTP error: {ex.Message}", ex);
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "JSON parsing error for Solana portfolio response");
                throw new Exception($"MoralisSolanaService JSON error: {ex.Message}", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error fetching Solana portfolio for address {Address}", address);
                throw;
            }
        }
    }
}
