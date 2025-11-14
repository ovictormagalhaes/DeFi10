using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using System.Text.Json.Serialization;
using Chain = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Solana
{
    /// <summary>
    /// Kamino Finance Service
    /// Uses official Kamino API via Hubble Protocol: https://api.hubbleprotocol.io
    /// 
    /// API Documentation: https://github.com/Kamino-Finance/kamino-api-docs
    /// 
    /// Benefits:
    /// - No RPC rate limiting issues (dedicated API)
    /// - Pre-computed positions (no Borsh deserialization needed)
    /// - Clean JSON responses
    /// - Reliable and fast
    /// </summary>
    public class KaminoService : ISolanaService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<KaminoService> _logger;
        private readonly int _rateLimitDelayMs;
        private const string KaminoApiBaseUrl = "https://api.kamino.finance";
        private const string MainMarketPubkey = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";

        // Hardcoded reserve mapping for Kamino Main Market
        // TODO: Future improvement - fetch from API dynamically
        private static readonly Dictionary<string, (string Symbol, int Decimals, string? Name)> ReserveMapping = new()
        {
            ["d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q"] = ("SOL", 9, "Wrapped SOL"),
            ["D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59"] = ("USDC", 6, "USD Coin"),
            ["FzwZWRMc1FbZLYjRkMf5YjKyecdmzoo6GQeYRDwSaEtz"] = ("USDT", 6, "Tether USD"),
            ["5guv5xt2we2FKHHaVR966mNvDVDHWJYd6bofbnsJTgmJ"] = ("USDS", 6, "USDS Stablecoin"),
            ["Gqu3TFmJXfnfSX84kqbZ5u9JjSBVoesaHjfTsaPjRSnZ"] = ("JitoSOL", 9, "Jito Staked SOL"),
            ["5sjkv6HD8wycocJ4tC4U36HHbvgcXYqcyiPRUkncnwWs"] = ("mSOL", 9, "Marinade Staked SOL"),
            ["ERNbDCASbqnGSaaSDiZiHBzmsbgZZnRdJKTBYXNfRRZK"] = ("bSOL", 9, "BlazeStake SOL"),
            ["Ez2coQZiHYJfS54vVjKFmq7YAp8TiNqs9EHy93JbZXDE"] = ("JLP", 6, "Jupiter LP Token"),
            // Add more as needed
        };

        public KaminoService(
            HttpClient httpClient,
            IConfiguration configuration, 
            ILogger<KaminoService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            
            _httpClient.BaseAddress = new System.Uri(KaminoApiBaseUrl);
            _httpClient.Timeout = System.TimeSpan.FromSeconds(30);
            
            // Read rate limit delay from config
            _rateLimitDelayMs = int.TryParse(configuration["Solana:RateLimitDelayMs"], out var delay) 
                ? delay / 2 
                : 1000;
            
            _logger.LogInformation("KaminoService initialized - API: {ApiUrl}, Market: {Market}, Reserves: {Count}", 
                KaminoApiBaseUrl, MainMarketPubkey, ReserveMapping.Count);
        }

        public string GetProtocolName() => "Kamino Finance";

        public IEnumerable<Chain> GetSupportedChains() => new[] { Chain.Solana };

        public bool SupportsChain(Chain chain) => chain == Chain.Solana;

        public Task<SolanaTokenResponse> GetTokensAsync(string address, Chain chain)
        {
            // This service focuses on Kamino lending positions
            return Task.FromResult(new SolanaTokenResponse());
        }

        public async Task<IEnumerable<KaminoPosition>> GetKaminoPositionsAsync(string address, Chain chain)
        {
            if (!SupportsChain(chain))
            {
                _logger.LogWarning("Chain {Chain} not supported by KaminoService", chain);
                return Enumerable.Empty<KaminoPosition>();
            }

            // Apply rate limiting
            if (_rateLimitDelayMs > 0)
            {
                await Task.Delay(_rateLimitDelayMs);
            }

            _logger.LogInformation("========== KAMINO: Fetching positions for address {Address} ==========", address);

            // Endpoint: /kamino-market/{marketPubkey}/users/{wallet}/obligations
            var endpoint = $"kamino-market/{MainMarketPubkey}/users/{address}/obligations";
            
            try
            {
                _logger.LogInformation("KAMINO: GET {Endpoint}", endpoint);
                
                var response = await _httpClient.GetAsync(endpoint);
                
                _logger.LogInformation("KAMINO: Response status: {StatusCode}", response.StatusCode);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    
                    if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                    {
                        _logger.LogInformation("KAMINO: No obligations found for address {Address} (404)", address);
                        return Enumerable.Empty<KaminoPosition>();
                    }
                    
                    _logger.LogError("KAMINO: API error - Status: {Status}, Content: {Content}", 
                        response.StatusCode, errorContent);
                    return Enumerable.Empty<KaminoPosition>();
                }

                var responseContent = await response.Content.ReadAsStringAsync();
                _logger.LogDebug("KAMINO: Raw response: {Content}", 
                    responseContent.Substring(0, Math.Min(1000, responseContent.Length)));

                // Parse as array of obligations directly
                var obligations = await response.Content.ReadFromJsonAsync<List<KaminoObligationDto>>();
                
                if (obligations == null || !obligations.Any())
                {
                    _logger.LogInformation("KAMINO: No obligations found for address {Address}", address);
                    return Enumerable.Empty<KaminoPosition>();
                }

                _logger.LogInformation("KAMINO: Found {Count} obligations", obligations.Count);

                // Map obligations to positions
                var positions = obligations.Select(MapObligationToPosition).ToList();

                _logger.LogInformation("KAMINO: Successfully mapped {Count} positions", positions.Count);
                return positions;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "KAMINO: HTTP error for address {Address}", address);
                return Enumerable.Empty<KaminoPosition>();
            }
            catch (System.Text.Json.JsonException ex)
            {
                _logger.LogError(ex, "KAMINO: JSON parsing error");
                return Enumerable.Empty<KaminoPosition>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "KAMINO: Unexpected error for address {Address}", address);
                return Enumerable.Empty<KaminoPosition>();
            }
        }

        private KaminoPosition MapObligationToPosition(KaminoObligationDto obligation)
        {
            var tokens = new List<SplToken>();

            _logger.LogInformation("KAMINO Mapping obligation: {Id}, State: {HasState}, Deposits: {DepCount}, Borrows: {BorCount}",
                obligation.ObligationAddress,
                obligation.State != null,
                obligation.State?.Deposits?.Count ?? 0,
                obligation.State?.Borrows?.Count ?? 0);

            // Parse stats FIRST to calculate accurate prices
            var stats = obligation.RefreshedStats;
            var totalDepositUsd = ParseDecimal(stats?.UserTotalDeposit);
            var totalBorrowUsd = ParseDecimal(stats?.UserTotalBorrow);
            
            _logger.LogDebug("KAMINO Stats: TotalDeposit=${Dep}, TotalBorrow=${Bor}", totalDepositUsd, totalBorrowUsd);

            // Map deposits from RAW state data (with reserve mapping)
            if (obligation.State?.Deposits != null)
            {
                _logger.LogDebug("KAMINO Processing {Count} deposits from state", obligation.State.Deposits.Count);
                
                foreach (var deposit in obligation.State.Deposits)
                {
                    _logger.LogDebug("KAMINO Deposit raw: Reserve={Reserve}, Amount={Amount}",
                        deposit.DepositReserve, deposit.DepositedAmount);

                    // Skip empty reserves (11111111111111111111111111111111)
                    if (string.IsNullOrEmpty(deposit.DepositReserve) || 
                        deposit.DepositReserve == "11111111111111111111111111111111")
                    {
                        _logger.LogDebug("KAMINO Skipping empty reserve");
                        continue;
                    }

                    var rawAmount = deposit.DepositedAmount ?? "0";
                    if (rawAmount == "0")
                    {
                        _logger.LogDebug("KAMINO Skipping zero amount deposit");
                        continue;
                    }

                    // Get reserve info from mapping
                    var (symbol, decimals, name) = ReserveMapping.TryGetValue(deposit.DepositReserve, out var info) 
                        ? info 
                        : ($"Token-{deposit.DepositReserve.Substring(0, 4)}", 9, null);

                    // Convert raw amount to human-readable
                    var humanAmount = ConvertRawToHuman(rawAmount, decimals);
                    
                    _logger.LogDebug("KAMINO Deposit - humanAmount={Amount}, marketValueSf={MarketValueSf}",
                        humanAmount, deposit.MarketValueSf);
                    
                    // Calculate proportional value from total deposits
                    decimal depositValueUsd = 0;
                    decimal unitPriceUsd = 0;
                    
                    if (humanAmount > 0 && !string.IsNullOrEmpty(deposit.MarketValueSf) && totalDepositUsd > 0)
                    {
                        if (decimal.TryParse(deposit.MarketValueSf, out var marketValueSf))
                        {
                            // Calculate this deposit's proportion of total using scaled factor
                            decimal totalScaledValue = 0;
                            foreach (var d in obligation.State.Deposits)
                            {
                                if (decimal.TryParse(d.MarketValueSf, out var sf))
                                    totalScaledValue += sf;
                            }
                            
                            if (totalScaledValue > 0)
                            {
                                var proportion = marketValueSf / totalScaledValue;
                                depositValueUsd = totalDepositUsd * proportion;
                                unitPriceUsd = SafeDivide(depositValueUsd, humanAmount);
                                
                                _logger.LogDebug("KAMINO Deposit - proportion={Prop:F4}, depositValue=${Value:F2}, unitPrice=${Price:F2}",
                                    proportion, depositValueUsd, unitPriceUsd);
                            }
                        }
                    }

                    tokens.Add(new SplToken
                    {
                        Mint = deposit.DepositReserve,
                        Symbol = symbol,
                        Name = name ?? symbol,
                        Decimals = decimals,
                        Amount = humanAmount,
                        PriceUsd = unitPriceUsd,
                        Logo = null,
                        Type = TokenType.Supplied
                    });

                    _logger.LogInformation("KAMINO Deposit added: {Symbol} = {Amount}, PriceUsd=${Price:F2} (raw: {Raw}, decimals: {Dec})",
                        symbol, humanAmount, unitPriceUsd, rawAmount, decimals);
                }
            }
            else
            {
                _logger.LogWarning("KAMINO No deposits in state!");
            }

            // Map borrows from RAW state data (with reserve mapping)
            if (obligation.State?.Borrows != null)
            {
                _logger.LogDebug("KAMINO Processing {Count} borrows from state", obligation.State.Borrows.Count);
                
                foreach (var borrow in obligation.State.Borrows)
                {
                    // Skip empty reserves
                    if (string.IsNullOrEmpty(borrow.BorrowReserve) || 
                        borrow.BorrowReserve == "11111111111111111111111111111111")
                    {
                        _logger.LogDebug("KAMINO Skipping empty borrow reserve");
                        continue;
                    }

                    // Use borrowedAmountOutsideElevationGroups or fallback to borrowedAmountSf
                    var rawAmount = borrow.BorrowedAmountOutsideElevationGroups 
                                    ?? borrow.BorrowedAmountSf 
                                    ?? "0";
                    
                    _logger.LogDebug("KAMINO Borrow raw: Reserve={Reserve}, Amount={Amount}, AmountSf={AmountSf}",
                        borrow.BorrowReserve, borrow.BorrowedAmountOutsideElevationGroups, borrow.BorrowedAmountSf);

                    if (rawAmount == "0")
                    {
                        _logger.LogDebug("KAMINO Skipping zero amount borrow");
                        continue;
                    }

                    // Get reserve info from mapping
                    var (symbol, decimals, name) = ReserveMapping.TryGetValue(borrow.BorrowReserve, out var info) 
                        ? info 
                        : ($"Token-{borrow.BorrowReserve.Substring(0, 4)}", 9, null);

                    // Convert raw amount to human-readable
                    var humanAmount = ConvertRawToHuman(rawAmount, decimals);
                    
                    _logger.LogDebug("KAMINO Borrow - humanAmount={Amount}, marketValueSf={MarketValueSf}",
                        humanAmount, borrow.MarketValueSf);
                    
                    // Calculate proportional value from total borrows
                    decimal borrowValueUsd = 0;
                    decimal unitPriceUsd = 0;
                    
                    if (humanAmount > 0 && !string.IsNullOrEmpty(borrow.MarketValueSf) && totalBorrowUsd > 0)
                    {
                        if (decimal.TryParse(borrow.MarketValueSf, out var marketValueSf))
                        {
                            // Calculate this borrow's proportion of total using scaled factor
                            decimal totalScaledValue = 0;
                            foreach (var b in obligation.State.Borrows)
                            {
                                if (decimal.TryParse(b.MarketValueSf, out var sf))
                                    totalScaledValue += sf;
                            }
                            
                            if (totalScaledValue > 0)
                            {
                                var proportion = marketValueSf / totalScaledValue;
                                borrowValueUsd = totalBorrowUsd * proportion;
                                unitPriceUsd = SafeDivide(borrowValueUsd, humanAmount);
                                
                                _logger.LogDebug("KAMINO Borrow - proportion={Prop:F4}, borrowValue=${Value:F2}, unitPrice=${Price:F2}",
                                    proportion, borrowValueUsd, unitPriceUsd);
                            }
                        }
                    }

                    tokens.Add(new SplToken
                    {
                        Mint = borrow.BorrowReserve,
                        Symbol = symbol,
                        Name = name ?? symbol,
                        Decimals = decimals,
                        Amount = humanAmount,
                        PriceUsd = unitPriceUsd,
                        Logo = null,
                        Type = TokenType.Borrowed
                    });

                    _logger.LogInformation("KAMINO Borrow added: {Symbol} = {Amount}, PriceUsd=${Price:F2} (raw: {Raw}, decimals: {Dec})",
                        symbol, humanAmount, unitPriceUsd, rawAmount, decimals);
                }
            }
            else
            {
                _logger.LogWarning("KAMINO No borrows in state!");
            }

            _logger.LogInformation("KAMINO Total tokens mapped: {Count}", tokens.Count);
            
            // Log each token before adding to position
            foreach (var token in tokens)
            {
                _logger.LogInformation("KAMINO Token in list before return: Symbol={Symbol}, Amount={Amount}, PriceUsd={Price}, Type={Type}",
                    token.Symbol, token.Amount, token.PriceUsd, token.Type);
            }

            // Calculate health factor using existing logic
            var loanToValue = ParseDecimal(stats?.LoanToValue);
            var liquidationLtv = ParseDecimal(stats?.LiquidationLtv);

            var healthFactor = CalculateHealthFactor(totalDepositUsd, totalBorrowUsd, liquidationLtv);

            _logger.LogDebug("KAMINO Summary: Deposited=${Dep:F2}, Borrowed=${Bor:F2}, HF={HF:F2}, LTV={LTV:F4}",
                totalDepositUsd, totalBorrowUsd, healthFactor, loanToValue);

            var position = new KaminoPosition
            {
                Id = obligation.ObligationAddress ?? "unknown",
                Market = "Kamino Main Market", // User-friendly name instead of pubkey
                SuppliedUsd = totalDepositUsd,
                BorrowedUsd = totalBorrowUsd,
                HealthFactor = healthFactor,
                Tokens = tokens
            };
            
            _logger.LogInformation("KAMINO Position created: ID={Id}, Market={Market}, TokensCount={Count}, HealthFactor={HF}",
                position.Id, position.Market, position.Tokens.Count, position.HealthFactor);
            
            // Verify tokens are in the position
            foreach (var token in position.Tokens)
            {
                _logger.LogInformation("KAMINO Token in position object: Symbol={Symbol}, Amount={Amount}, PriceUsd={Price}, Type={Type}",
                    token.Symbol, token.Amount, token.PriceUsd, token.Type);
            }
            
            return position;
        }

        private static decimal ConvertRawToHuman(string rawAmount, int decimals)
        {
            if (string.IsNullOrEmpty(rawAmount) || !decimal.TryParse(rawAmount, out var raw))
                return 0;

            if (decimals == 0)
                return raw;

            var divisor = (decimal)Math.Pow(10, decimals);
            return raw / divisor;
        }

        private static decimal SafeDivide(decimal numerator, decimal denominator)
        {
            if (denominator == 0) return 0;
            try
            {
                return numerator / denominator;
            }
            catch (OverflowException)
            {
                return 0;
            }
        }

        private static decimal ParseDecimal(string? value)
        {
            if (string.IsNullOrEmpty(value))
                return 0;

            return decimal.TryParse(value, System.Globalization.NumberStyles.Float, 
                System.Globalization.CultureInfo.InvariantCulture, out var result) ? result : 0;
        }

        private static decimal CalculateHealthFactor(decimal deposited, decimal borrowed, decimal liquidationLtv)
        {
            // Health factor calculation from Kamino
            // HF = (Deposited * Liquidation LTV) / Borrowed
            if (borrowed <= 0)
                return decimal.MaxValue; // No borrows = infinite health

            if (deposited <= 0)
                return 0;

            // Use liquidation LTV from stats (already a percentage/decimal)
            var healthFactor = (deposited * liquidationLtv) / borrowed;
            
            // Cap at 999.99 for display purposes
            return Math.Min(healthFactor, 999.99m);
        }

        public Task<IEnumerable<RaydiumPosition>> GetRaydiumPositionsAsync(string address, Chain chain)
        {
            return Task.FromResult(Enumerable.Empty<RaydiumPosition>());
        }

        #region Kamino API Models
        
        /// <summary>
        /// Kamino Obligation DTO - matches REAL API response structure
        /// Based on actual API response from: /kamino-market/{market}/users/{wallet}/obligations
        /// </summary>
        private class KaminoObligationDto
        {
            [JsonPropertyName("obligationAddress")]
            public string? ObligationAddress { get; set; }

            [JsonPropertyName("state")]
            public KaminoStateDto? State { get; set; }

            [JsonPropertyName("refreshedStats")]
            public KaminoRefreshedStatsDto? RefreshedStats { get; set; }

            [JsonPropertyName("obligationTag")]
            public int? ObligationTag { get; set; }

            [JsonPropertyName("humanTag")]
            public string? HumanTag { get; set; }
        }

        private class KaminoStateDto
        {
            [JsonPropertyName("lendingMarket")]
            public string? LendingMarket { get; set; }

            [JsonPropertyName("owner")]
            public string? Owner { get; set; }

            [JsonPropertyName("deposits")]
            public List<KaminoRawDepositDto>? Deposits { get; set; }

            [JsonPropertyName("borrows")]
            public List<KaminoRawBorrowDto>? Borrows { get; set; }
        }

        private class KaminoRawDepositDto
        {
            [JsonPropertyName("depositReserve")]
            public string? DepositReserve { get; set; }

            [JsonPropertyName("depositedAmount")]
            public string? DepositedAmount { get; set; }

            [JsonPropertyName("marketValueSf")]
            public string? MarketValueSf { get; set; }
        }

        private class KaminoRawBorrowDto
        {
            [JsonPropertyName("borrowReserve")]
            public string? BorrowReserve { get; set; }

            [JsonPropertyName("borrowedAmountSf")]
            public string? BorrowedAmountSf { get; set; }

            [JsonPropertyName("borrowedAmountOutsideElevationGroups")]
            public string? BorrowedAmountOutsideElevationGroups { get; set; }

            [JsonPropertyName("marketValueSf")]
            public string? MarketValueSf { get; set; }
        }

        private class KaminoRefreshedStatsDto
        {
            [JsonPropertyName("userTotalDeposit")]
            public string? UserTotalDeposit { get; set; }

            [JsonPropertyName("userTotalBorrow")]
            public string? UserTotalBorrow { get; set; }

            [JsonPropertyName("netAccountValue")]
            public string? NetAccountValue { get; set; }

            [JsonPropertyName("leverage")]
            public string? Leverage { get; set; }

            [JsonPropertyName("loanToValue")]
            public string? LoanToValue { get; set; }

            [JsonPropertyName("liquidationLtv")]
            public string? LiquidationLtv { get; set; }
        }

        #endregion
    }
}
