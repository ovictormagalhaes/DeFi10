using System.Text.Json;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Models.Solana.Common;
using MyWebWallet.API.Services.Models.Solana.Moralis;
using MyWebWallet.API.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Solana
{
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

                if (portfolio.NativeBalance != null && decimal.TryParse(portfolio.NativeBalance.Solana, out var nativeBalanceSol) && nativeBalanceSol > 0)
                {
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
                    NativeBalanceUsd = null
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

        public async Task<SolanaNFTResponse> GetNFTsAsync(string address, ChainEnum chain)
        {
            if (chain != ChainEnum.Solana)
                throw new NotSupportedException($"MoralisSolanaService only supports Solana chain, got {chain}");

            try
            {
                // Moralis NFT endpoint for Solana
                var url = $"{_baseUrl}/account/mainnet/{address}/nft?network=mainnet";
                
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
                _httpClient.DefaultRequestHeaders.Add("X-API-Key", _apiKey);

                _logger.LogInformation("Fetching Solana NFTs for address {Address}", address);
                
                var response = await _httpClient.GetAsync(url);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Moralis Solana NFT API error - Status: {Status}, Content: {Content}", response.StatusCode, errorContent);
                    
                    // Return empty list on error instead of throwing
                    return new SolanaNFTResponse { Nfts = new List<SolanaNftDetail>() };
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                _logger.LogDebug("Moralis Solana NFT API response: {Response}", responseJson);
                
                // Try to parse as generic object first to understand structure
                var genericResponse = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(responseJson);
                
                if (genericResponse == null || !genericResponse.Any())
                {
                    _logger.LogWarning("Failed to deserialize Solana NFT response for address {Address}", address);
                    return new SolanaNFTResponse { Nfts = new List<SolanaNftDetail>() };
                }

                // Check if response is an array or has nfts property
                SolanaNFTResponse? nftResponse = null;
                
                if (genericResponse.ContainsKey("result") && genericResponse["result"].ValueKind == JsonValueKind.Array)
                {
                    // Format: { "result": [...] }
                    var nfts = JsonSerializer.Deserialize<List<SolanaNftDetail>>(genericResponse["result"].GetRawText());
                    nftResponse = new SolanaNFTResponse { Nfts = nfts ?? new List<SolanaNftDetail>() };
                }
                else if (genericResponse.ContainsKey("nfts") && genericResponse["nfts"].ValueKind == JsonValueKind.Array)
                {
                    // Format: { "nfts": [...] }
                    var nfts = JsonSerializer.Deserialize<List<SolanaNftDetail>>(genericResponse["nfts"].GetRawText());
                    nftResponse = new SolanaNFTResponse { Nfts = nfts ?? new List<SolanaNftDetail>() };
                }
                else
                {
                    // Try direct array parse
                    var directParse = JsonSerializer.Deserialize<List<SolanaNftDetail>>(responseJson);
                    nftResponse = new SolanaNFTResponse { Nfts = directParse ?? new List<SolanaNftDetail>() };
                }

                if (nftResponse == null)
                {
                    _logger.LogWarning("Failed to deserialize Solana NFT response for address {Address}", address);
                    return new SolanaNFTResponse { Nfts = new List<SolanaNftDetail>() };
                }

                _logger.LogInformation("Successfully fetched {Count} Solana NFTs for address {Address}", 
                    nftResponse.Nfts.Count, address);
                
                return nftResponse;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "HTTP error fetching Solana NFTs for address {Address}", address);
                return new SolanaNFTResponse { Nfts = new List<SolanaNftDetail>() };
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "JSON parsing error for Solana NFT response");
                return new SolanaNFTResponse { Nfts = new List<SolanaNftDetail>() };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error fetching Solana NFTs for address {Address}", address);
                return new SolanaNFTResponse { Nfts = new List<SolanaNftDetail>() };
            }
        }
    }
}
