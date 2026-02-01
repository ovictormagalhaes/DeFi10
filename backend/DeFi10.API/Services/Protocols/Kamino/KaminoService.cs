using Microsoft.Extensions.Options;
using DeFi10.API.Configuration;
using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Protocols.Kamino.Models;
using DeFi10.API.Services.Protocols.Raydium.Models;
using System.Text.Json.Serialization;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Services.Core.Solana;

namespace DeFi10.API.Services.Protocols.Kamino
{
    public class KaminoService : IKaminioService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<KaminoService> _logger;
        private readonly IProtocolConfigurationService _protocolConfig;
        private readonly int _rateLimitDelayMs;
        private readonly string _kaminoApiUrl;
        
        // Known Kamino markets to query
        private static readonly List<(string Pubkey, string Name)> KnownMarkets = new()
        {
            ("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF", "Main Market"),
            ("ByVuX9fRdEHsZomwLVryQQHRhQi3yMXZ6uz6DA4gutja", "JLP Market"),
            ("DxXdAyU3kCjnyggvHmY5nAwg5cRbbmdyX3npfDMjjMek", "Altcoins Market"),
        };
        
        private const string MainMarketPubkey = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
        
        // Cache for reserves data
        private static KaminoReservesResponseDto? _cachedReserves;
        private static DateTime _lastReservesFetch = DateTime.MinValue;
        private static readonly TimeSpan ReservesCacheDuration = TimeSpan.FromMinutes(5);
        private static readonly SemaphoreSlim _reservesLock = new(1, 1);

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
        };

        public KaminoService(
            HttpClient httpClient,
            IOptions<SolanaOptions> solanaOptions,
            IOptions<KaminoOptions> kaminoOptions,
            IProtocolConfigurationService protocolConfig,
            ILogger<KaminoService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _protocolConfig = protocolConfig;
            
            var protocolChain = _protocolConfig.GetProtocolOnChain("kamino", ChainEnum.Solana);
            _kaminoApiUrl = protocolChain?.Options?.TryGetValue("ApiUrl", out var apiUrl) == true 
                ? apiUrl?.ToString() ?? "https://api.kamino.finance"
                : "https://api.kamino.finance";
            
            _httpClient.BaseAddress = new System.Uri(_kaminoApiUrl);
            _httpClient.Timeout = System.TimeSpan.FromSeconds(30);
            
            _rateLimitDelayMs = solanaOptions.Value.RateLimitDelayMs / 2;
            
            _logger.LogInformation("KaminoService initialized - API: {ApiUrl}, Market: {Market}, Reserves: {Count}", 
                _kaminoApiUrl, MainMarketPubkey, ReserveMapping.Count);
        }

        public string GetProtocolName() => "Kamino Finance";

        public IEnumerable<Chain> GetSupportedChains() => new[] { Chain.Solana };

        public bool SupportsChain(Chain chain) => chain == Chain.Solana;

        public async Task<IEnumerable<KaminoPosition>> GetPositionsAsync(string address, Chain chain)
        {
            if (!SupportsChain(chain))
            {
                _logger.LogWarning("Chain {Chain} not supported by KaminoService", chain);
                return Enumerable.Empty<KaminoPosition>();
            }

            _logger.LogInformation("KAMINO: Fetching positions for address {Address} across {MarketCount} markets", 
                address, KnownMarkets.Count);

            var allPositions = new List<KaminoPosition>();
            
            // Query all known markets
            foreach (var (marketPubkey, marketName) in KnownMarkets)
            {
                if (_rateLimitDelayMs > 0 && allPositions.Count > 0) // Skip delay on first iteration
                {
                    await Task.Delay(_rateLimitDelayMs);
                }

                _logger.LogDebug("KAMINO: Querying market {MarketName} ({Pubkey})", marketName, marketPubkey);
                
                var positions = await GetPositionsForMarketAsync(address, marketPubkey, marketName);
                if (positions.Any())
                {
                    _logger.LogInformation("KAMINO: Found {Count} positions in {MarketName}", positions.Count(), marketName);
                    allPositions.AddRange(positions);
                }
            }

            _logger.LogInformation("KAMINO: Total positions found: {Count} across all markets", allPositions.Count);
            return allPositions;
        }

        private async Task<IEnumerable<KaminoPosition>> GetPositionsForMarketAsync(string address, string marketPubkey, string marketName)
        {
            var endpoint = $"kamino-market/{marketPubkey}/users/{address}/obligations";
            
            try
            {
                // Add timeout to prevent individual market queries from hanging
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
                
                // Retry logic with exponential backoff for reliability
                const int maxRetries = 2; // Reduced retries to save time
                HttpResponseMessage? response = null;
                Exception? lastException = null;

                for (int attempt = 1; attempt <= maxRetries; attempt++)
                {
                    try
                    {
                        _logger.LogDebug("KAMINO: GET {Endpoint} (attempt {Attempt}/{MaxRetries})", endpoint, attempt, maxRetries);
                        
                        response = await _httpClient.GetAsync(endpoint, cts.Token);
                        
                        _logger.LogDebug("KAMINO: Response status: {StatusCode}", response.StatusCode);

                        // Success - exit retry loop
                        if (response.IsSuccessStatusCode)
                        {
                            break;
                        }

                        // 404 means no obligations - don't retry
                        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                        {
                            _logger.LogDebug("KAMINO: No obligations found for address {Address} (404)", address);
                            return Enumerable.Empty<KaminoPosition>();
                        }

                        var errorContent = await response.Content.ReadAsStringAsync();
                        _logger.LogWarning("KAMINO: API error on attempt {Attempt} - Status: {Status}, Content: {Content}", 
                            attempt, response.StatusCode, errorContent);

                        // Retry on server errors (500-599)
                        if ((int)response.StatusCode >= 500 && attempt < maxRetries)
                        {
                            var delayMs = (int)Math.Pow(2, attempt) * 500; // 1s, 2s, 4s
                            _logger.LogInformation("KAMINO: Retrying in {Delay}ms due to server error...", delayMs);
                            await Task.Delay(delayMs);
                        }
                        else if (attempt == maxRetries)
                        {
                            _logger.LogError("KAMINO: API error after {MaxRetries} attempts - Status: {Status}, Content: {Content}", 
                                maxRetries, response.StatusCode, errorContent);
                            return Enumerable.Empty<KaminoPosition>();
                        }
                        else
                        {
                            // Non-retryable error (e.g., 400 Bad Request)
                            _logger.LogError("KAMINO: API error (non-retryable) - Status: {Status}, Content: {Content}", 
                                response.StatusCode, errorContent);
                            return Enumerable.Empty<KaminoPosition>();
                        }
                    }
                    catch (HttpRequestException ex)
                    {
                        lastException = ex;
                        _logger.LogWarning(ex, "KAMINO: HTTP request failed on attempt {Attempt}: {Message}", 
                            attempt, ex.Message);
                        
                        if (attempt < maxRetries)
                        {
                            var delayMs = (int)Math.Pow(2, attempt) * 500;
                            _logger.LogDebug("KAMINO: Retrying in {Delay}ms...", delayMs);
                            await Task.Delay(delayMs);
                        }
                    }
                    catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
                    {
                        lastException = ex;
                        _logger.LogWarning("KAMINO: Request timeout on attempt {Attempt}", attempt);
                        
                        if (attempt < maxRetries)
                        {
                            var delayMs = (int)Math.Pow(2, attempt) * 500;
                            await Task.Delay(delayMs);
                        }
                    }
                }

                if (response == null || !response.IsSuccessStatusCode)
                {
                    _logger.LogWarning(lastException, "KAMINO: All {MaxRetries} attempts failed for market {Market}", 
                        maxRetries, marketName);
                    return Enumerable.Empty<KaminoPosition>();
                }

                var responseContent = await response.Content.ReadAsStringAsync();
                _logger.LogDebug("KAMINO: Raw response: {Content}", 
                    responseContent.Substring(0, Math.Min(1000, responseContent.Length)));

                var obligations = await response.Content.ReadFromJsonAsync<List<KaminoObligationDto>>();
                
                if (obligations == null || !obligations.Any())
                {
                    _logger.LogDebug("KAMINO: No obligations found for address {Address}", address);
                    return Enumerable.Empty<KaminoPosition>();
                }

                _logger.LogDebug("KAMINO: Found {Count} obligations", obligations.Count);

                // Fetch reserves data to enrich positions with APY
                var reservesResponse = await GetReservesDataAsync();
                var reservesByAddress = reservesResponse?.Reserves?
                    .Where(r => !string.IsNullOrEmpty(r.Address))
                    .ToDictionary(r => r.Address ?? string.Empty, r => r) ?? new Dictionary<string, KaminoReserveDto>();

                if (reservesByAddress.Count == 0)
                {
                    _logger.LogWarning("KAMINO: No reserves data available - APY enrichment will be skipped. Positions will return without APY data.");
                }
                else
                {
                    _logger.LogDebug("KAMINO: Enriching obligations with APY data from {ReserveCount} reserves", reservesByAddress.Count);
                }

                // Enrich each obligation with APY data from reserves
                int enrichedDeposits = 0;
                int enrichedBorrows = 0;
                int skippedDeposits = 0;
                int skippedBorrows = 0;

                foreach (var obligation in obligations)
                {
                    if (obligation.State?.Deposits != null)
                    {
                        foreach (var deposit in obligation.State.Deposits)
                        {
                            // Skip empty/null reserves (unused slots in Kamino obligations)
                            if (string.IsNullOrEmpty(deposit.DepositReserve) || 
                                deposit.DepositReserve == "11111111111111111111111111111111")
                                continue;

                            if (reservesByAddress.TryGetValue(deposit.DepositReserve, out var reserve))
                            {
                                // Only set APY if it's actually greater than 0 (reserve.SupplyApy returns 0 if parse fails)
                                if (reserve.SupplyApy > 0)
                                {
                                    deposit.Apy = reserve.SupplyApy;
                                    enrichedDeposits++;
                                    _logger.LogInformation("KAMINO: ✓ Enriched deposit reserve {Reserve} with supply APY: {Apy}% (raw string: '{RawApy}')", 
                                        deposit.DepositReserve, deposit.Apy * 100, reserve.SupplyApyString ?? "NULL");
                                }
                                else
                                {
                                    _logger.LogWarning("KAMINO: ✗ Deposit reserve {Reserve} has zero or invalid APY (raw: '{RawApy}') - projection will not be calculated",
                                        deposit.DepositReserve, reserve.SupplyApyString ?? "NULL");
                                }
                            }
                            else
                            {
                                skippedDeposits++;
                                _logger.LogWarning("KAMINO: ✗ Could not find reserve {Reserve} in reserves data - deposit APY will be null",
                                    deposit.DepositReserve);
                            }
                        }
                    }

                    if (obligation.State?.Borrows != null)
                    {
                        foreach (var borrow in obligation.State.Borrows)
                        {
                            // Skip empty/null reserves (unused slots in Kamino obligations)
                            if (string.IsNullOrEmpty(borrow.BorrowReserve) || 
                                borrow.BorrowReserve == "11111111111111111111111111111111")
                                continue;

                            if (reservesByAddress.TryGetValue(borrow.BorrowReserve, out var reserve))
                            {
                                // Only set APY if it's actually greater than 0 (reserve.BorrowApy returns 0 if parse fails)
                                if (reserve.BorrowApy > 0)
                                {
                                    borrow.Apy = reserve.BorrowApy;
                                    enrichedBorrows++;
                                    _logger.LogInformation("KAMINO: ✓ Enriched borrow reserve {Reserve} with borrow APY: {Apy}% (raw string: '{RawApy}')", 
                                        borrow.BorrowReserve, borrow.Apy * 100, reserve.BorrowApyString ?? "NULL");
                                }
                                else
                                {
                                    _logger.LogWarning("KAMINO: ✗ Borrow reserve {Reserve} has zero or invalid APY (raw: '{RawApy}') - projection will not be calculated",
                                        borrow.BorrowReserve, reserve.BorrowApyString ?? "NULL");
                                }
                            }
                            else
                            {
                                skippedBorrows++;
                                _logger.LogWarning("KAMINO: ✗ Could not find reserve {Reserve} in reserves data - borrow APY will be null",
                                    borrow.BorrowReserve);
                            }
                        }
                    }
                }

                if (enrichedDeposits > 0 || enrichedBorrows > 0)
                {
                    _logger.LogInformation("KAMINO: Successfully enriched {Deposits} deposits and {Borrows} borrows with APY data",
                        enrichedDeposits, enrichedBorrows);
                }

                if (skippedDeposits > 0 || skippedBorrows > 0)
                {
                    _logger.LogWarning("KAMINO: Skipped APY enrichment for {Deposits} deposits and {Borrows} borrows (reserves not found)",
                        skippedDeposits, skippedBorrows);
                }

                var positions = obligations.Select(o => MapObligationToPosition(o, marketName)).ToList();

                _logger.LogDebug("KAMINO: Successfully mapped {Count} positions", positions.Count);
                return positions;
            }
            catch (OperationCanceledException ex)
            {
                _logger.LogWarning(ex, "KAMINO: Timeout querying market {Market} (15s exceeded)", marketName);
                return Enumerable.Empty<KaminoPosition>();
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "KAMINO: HTTP error for market {Market}", marketName);
                return Enumerable.Empty<KaminoPosition>();
            }
            catch (System.Text.Json.JsonException ex)
            {
                _logger.LogWarning(ex, "KAMINO: JSON parsing error in market {Market}", marketName);
                return Enumerable.Empty<KaminoPosition>();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "KAMINO: Unexpected error in market {Market}", marketName);
                return Enumerable.Empty<KaminoPosition>();
            }
        }

        private KaminoPosition MapObligationToPosition(KaminoObligationDto obligation, string marketName)
        {
            var tokens = new List<SplToken>();

            _logger.LogDebug("KAMINO Mapping obligation: {Id}, State: {HasState}, Deposits: {DepCount}, Borrows: {BorCount}",
                obligation.ObligationAddress,
                obligation.State != null,
                obligation.State?.Deposits?.Count ?? 0,
                obligation.State?.Borrows?.Count ?? 0);

            var stats = obligation.RefreshedStats;
            var totalDepositUsd = ParseDecimal(stats?.UserTotalDeposit);
            var totalBorrowUsd = ParseDecimal(stats?.UserTotalBorrow);
            
            _logger.LogDebug("KAMINO Stats: TotalDeposit=${Dep}, TotalBorrow=${Bor}", totalDepositUsd, totalBorrowUsd);

            if (obligation.State?.Deposits != null)
            {
                _logger.LogDebug("KAMINO Processing {Count} deposits from state", obligation.State.Deposits.Count);
                
                foreach (var deposit in obligation.State.Deposits)
                {
                    _logger.LogDebug("KAMINO Deposit raw: Reserve={Reserve}, Amount={Amount}",
                        deposit.DepositReserve, deposit.DepositedAmount);

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

                    var (symbol, decimals, name) = ReserveMapping.TryGetValue(deposit.DepositReserve, out var info) 
                        ? info 
                        : ($"Token-{deposit.DepositReserve.Substring(0, 4)}", 9, null);

                    var humanAmount = ConvertRawToHuman(rawAmount, decimals);
                    
                    _logger.LogDebug("KAMINO Deposit - humanAmount={Amount}, marketValueSf={MarketValueSf}",
                        humanAmount, deposit.MarketValueSf);
                    
                    decimal depositValueUsd = 0;
                    decimal unitPriceUsd = 0;
                    
                    if (humanAmount > 0 && !string.IsNullOrEmpty(deposit.MarketValueSf) && totalDepositUsd > 0)
                    {
                        if (decimal.TryParse(deposit.MarketValueSf, out var marketValueSf))
                        {
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
                        Type = TokenType.Supplied,
                        Apy = deposit.Apy.HasValue ? deposit.Apy.Value * 100 : null // Convert decimal to percentage (0.04242 -> 4.242)
                    });

                    _logger.LogInformation("KAMINO Deposit added: {Symbol} = {Amount}, PriceUsd=${Price:F2}, APY={Apy}% (raw: {Raw}, decimals: {Dec})",
                        symbol, humanAmount, unitPriceUsd, deposit.Apy.HasValue ? deposit.Apy.Value * 100 : (decimal?)null, rawAmount, decimals);
                }
            }
            else
            {
                _logger.LogWarning("KAMINO No deposits in state!");
            }

            if (obligation.State?.Borrows != null)
            {
                _logger.LogDebug("KAMINO Processing {Count} borrows from state", obligation.State.Borrows.Count);
                
                foreach (var borrow in obligation.State.Borrows)
                {
                    if (string.IsNullOrEmpty(borrow.BorrowReserve) || 
                        borrow.BorrowReserve == "11111111111111111111111111111111")
                    {
                        _logger.LogDebug("KAMINO Skipping empty borrow reserve");
                        continue;
                    }

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

                    var (symbol, decimals, name) = ReserveMapping.TryGetValue(borrow.BorrowReserve, out var info) 
                        ? info 
                        : ($"Token-{borrow.BorrowReserve.Substring(0, 4)}", 9, null);

                    var humanAmount = ConvertRawToHuman(rawAmount, decimals);
                    
                    _logger.LogDebug("KAMINO Borrow - humanAmount={Amount}, marketValueSf={MarketValueSf}",
                        humanAmount, borrow.MarketValueSf);
                    
                    decimal borrowValueUsd = 0;
                    decimal unitPriceUsd = 0;
                    
                    if (humanAmount > 0 && !string.IsNullOrEmpty(borrow.MarketValueSf) && totalBorrowUsd > 0)
                    {
                        if (decimal.TryParse(borrow.MarketValueSf, out var marketValueSf))
                        {
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
                        Type = TokenType.Borrowed,
                        Apy = borrow.Apy.HasValue ? borrow.Apy.Value * 100 : null // Convert decimal to percentage (0.05080 -> 5.080)
                    });

                    _logger.LogInformation("KAMINO Borrow added: {Symbol} = {Amount}, PriceUsd=${Price:F2}, APY={Apy}% (raw: {Raw}, decimals: {Dec}, borrowApySource: {BorrowApy})",
                        symbol, humanAmount, unitPriceUsd, borrow.Apy.HasValue ? borrow.Apy.Value * 100 : (decimal?)null, rawAmount, decimals, borrow.Apy);
                }
            }
            else
            {
                _logger.LogWarning("KAMINO No borrows in state!");
            }

            _logger.LogInformation("KAMINO Total tokens mapped: {Count}", tokens.Count);
            
            foreach (var token in tokens)
            {
                _logger.LogInformation("KAMINO Token in list before return: Symbol={Symbol}, Amount={Amount}, PriceUsd={Price}, Type={Type}",
                    token.Symbol, token.Amount, token.PriceUsd, token.Type);
            }

            var loanToValue = ParseDecimal(stats?.LoanToValue);
            var liquidationLtv = ParseDecimal(stats?.LiquidationLtv);

            var healthFactor = CalculateHealthFactor(totalDepositUsd, totalBorrowUsd, liquidationLtv);

            _logger.LogDebug("KAMINO Summary: Deposited=${Dep:F2}, Borrowed=${Bor:F2}, HF={HF:F2}, LTV={LTV:F4}",
                totalDepositUsd, totalBorrowUsd, healthFactor, loanToValue);

            var position = new KaminoPosition
            {
                Id = obligation.ObligationAddress ?? "unknown",
                Market = $"Kamino {marketName}",
                SuppliedUsd = totalDepositUsd,
                BorrowedUsd = totalBorrowUsd,
                HealthFactor = healthFactor,
                Tokens = tokens
            };
            
            _logger.LogInformation("KAMINO Position created: ID={Id}, Market={Market}, TokensCount={Count}, HealthFactor={HF}",
                position.Id, position.Market, position.Tokens.Count, position.HealthFactor);
            
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
            if (borrowed <= 0)
                return decimal.MaxValue;

            if (deposited <= 0)
                return 0;

            var healthFactor = (deposited * liquidationLtv) / borrowed;
            
            return Math.Min(healthFactor, 999.99m);
        }

        public async Task<KaminoReservesResponseDto?> GetReservesDataAsync()
        {
            // Check if cached data is still valid
            if (_cachedReserves != null && DateTime.UtcNow - _lastReservesFetch < ReservesCacheDuration)
            {
                _logger.LogDebug("KAMINO: Returning cached reserves data (age: {Age}s)", 
                    (DateTime.UtcNow - _lastReservesFetch).TotalSeconds);
                return _cachedReserves;
            }

            await _reservesLock.WaitAsync();
            try
            {
                // Double-check after acquiring lock
                if (_cachedReserves != null && DateTime.UtcNow - _lastReservesFetch < ReservesCacheDuration)
                {
                    return _cachedReserves;
                }

                _logger.LogInformation("KAMINO: Fetching fresh reserves data from API");

                // Use Kamino Finance public API with correct endpoint format
                var reservesUrl = $"https://api.kamino.finance/kamino-market/{MainMarketPubkey}/reserves/metrics?env=mainnet-beta";
                
                // Retry logic with exponential backoff
                const int maxRetries = 3;
                HttpResponseMessage? response = null;
                Exception? lastException = null;

                for (int attempt = 1; attempt <= maxRetries; attempt++)
                {
                    try
                    {
                        using var reservesClient = new HttpClient();
                        reservesClient.Timeout = TimeSpan.FromSeconds(30);
                        
                        _logger.LogDebug("KAMINO: Reserves API attempt {Attempt}/{MaxRetries}", attempt, maxRetries);
                        response = await reservesClient.GetAsync(reservesUrl);
                        
                        if (response.IsSuccessStatusCode)
                        {
                            break; // Success, exit retry loop
                        }
                        
                        _logger.LogWarning("KAMINO: Reserves API returned {StatusCode} on attempt {Attempt}", 
                            response.StatusCode, attempt);
                        
                        if (attempt < maxRetries)
                        {
                            var delayMs = (int)Math.Pow(2, attempt) * 500; // Exponential backoff: 1s, 2s, 4s
                            _logger.LogDebug("KAMINO: Retrying in {Delay}ms...", delayMs);
                            await Task.Delay(delayMs);
                        }
                    }
                    catch (Exception ex)
                    {
                        lastException = ex;
                        _logger.LogWarning(ex, "KAMINO: Reserves API attempt {Attempt} failed: {Message}", 
                            attempt, ex.Message);
                        
                        if (attempt < maxRetries)
                        {
                            var delayMs = (int)Math.Pow(2, attempt) * 500;
                            await Task.Delay(delayMs);
                        }
                    }
                }

                if (response == null)
                {
                    _logger.LogError(lastException, "KAMINO: All {MaxRetries} attempts to fetch reserves failed", maxRetries);
                    if (_cachedReserves != null)
                    {
                        _logger.LogWarning("KAMINO: Returning stale cache (age: {Age}s) due to API failure",
                            (DateTime.UtcNow - _lastReservesFetch).TotalSeconds);
                    }
                    return _cachedReserves;
                }
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("KAMINO: Failed to fetch reserves - Status: {Status}, Response: {Response}", 
                        response.StatusCode, errorContent.Substring(0, Math.Min(500, errorContent.Length)));
                    
                    if (_cachedReserves != null)
                    {
                        _logger.LogWarning("KAMINO: Returning stale cache (age: {Age}s) due to API error",
                            (DateTime.UtcNow - _lastReservesFetch).TotalSeconds);
                    }
                    return _cachedReserves; // Return stale cache if available
                }

                var content = await response.Content.ReadAsStringAsync();
                _logger.LogDebug("KAMINO: Reserves response size: {Size} bytes", content.Length);
                
                // Log first 1000 chars to see JSON structure
                var preview = content.Length > 1000 ? content.Substring(0, 1000) : content;
                _logger.LogDebug("KAMINO: JSON preview: {Preview}", preview);

                // Try to deserialize - API might return array directly or object with "reserves" property
                KaminoReservesResponseDto? reserves = null;
                
                try
                {
                    // First, try as direct array
                    var reservesList = System.Text.Json.JsonSerializer.Deserialize<List<KaminoReserveDto>>(content, new System.Text.Json.JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });
                    
                    if (reservesList != null && reservesList.Any())
                    {
                        _logger.LogDebug("KAMINO: Successfully parsed as array with {Count} reserves", reservesList.Count);
                        reserves = new KaminoReservesResponseDto { Reserves = reservesList };
                    }
                }
                catch (System.Text.Json.JsonException ex)
                {
                    _logger.LogDebug("KAMINO: Array parsing failed: {Error}, trying object format", ex.Message);
                    
                    // If that fails, try as object with "reserves" property
                    try
                    {
                        reserves = System.Text.Json.JsonSerializer.Deserialize<KaminoReservesResponseDto>(content, new System.Text.Json.JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });
                        
                        if (reserves?.Reserves != null)
                        {
                            _logger.LogDebug("KAMINO: Successfully parsed as object with {Count} reserves", reserves.Reserves.Count);
                        }
                    }
                    catch (System.Text.Json.JsonException ex2)
                    {
                        _logger.LogError("KAMINO: Both parsing attempts failed. Array error: {Error1}, Object error: {Error2}", 
                            ex.Message, ex2.Message);
                    }
                }
                
                if (reserves?.Reserves != null && reserves.Reserves.Any())
                {
                    _cachedReserves = reserves;
                    _lastReservesFetch = DateTime.UtcNow;
                    
                    var tokensWithApy = reserves.Reserves.Where(r => r.SupplyApy > 0 || r.BorrowApy > 0).Count();
                    _logger.LogInformation("KAMINO: Successfully cached {Count} reserves ({WithApy} have APY data)", 
                        reserves.Reserves.Count, tokensWithApy);
                    
                    // Log a few examples for diagnostics
                    var examples = reserves.Reserves.Where(r => r.SupplyApy > 0).Take(3);
                    foreach (var example in examples)
                    {
                        _logger.LogDebug("KAMINO: Example - {Symbol}: Supply APY={SupplyApy}%, Borrow APY={BorrowApy}%",
                            example.Symbol, example.SupplyApy * 100, example.BorrowApy * 100);
                    }
                    
                    return reserves;
                }

                _logger.LogWarning("KAMINO: Empty reserves response - APY data will not be available");
                if (_cachedReserves != null)
                {
                    _logger.LogWarning("KAMINO: Returning stale cache (age: {Age}s) due to empty response",
                        (DateTime.UtcNow - _lastReservesFetch).TotalSeconds);
                }
                return _cachedReserves; // Return stale cache if available
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "KAMINO: HTTP error fetching reserves");
                return _cachedReserves; // Return stale cache if available
            }
            catch (System.Text.Json.JsonException ex)
            {
                _logger.LogError(ex, "KAMINO: JSON parsing error for reserves - {Message}", ex.Message);
                return _cachedReserves;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "KAMINO: Unexpected error fetching reserves - {Message} - {StackTrace}", ex.Message, ex.StackTrace);
                return _cachedReserves;
            }
            finally
            {
                _reservesLock.Release();
            }
        }

    }
}
