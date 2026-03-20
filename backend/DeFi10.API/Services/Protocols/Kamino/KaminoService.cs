using Microsoft.Extensions.Options;
using DeFi10.API.Configuration;
using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Protocols.Kamino.Models;
using DeFi10.API.Services.Protocols.Raydium.Models;
using System.Text.Json;
using System.Text.Json.Serialization;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Services.Core.Solana;
using DeFi10.API.Services.Cache;
using DeFi10.API.Models.Cache;

namespace DeFi10.API.Services.Protocols.Kamino
{
    /// <summary>
    /// Representa um saldo de token (mint address + balance) para validação de cache
    /// </summary>
    public class TokenBalance
    {
        public string MintAddress { get; set; } = string.Empty;
        public string Balance { get; set; } = string.Empty;
    }


    public class KaminoService : IKaminioService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<KaminoService> _logger;
        private readonly IProtocolConfigurationService _protocolConfig;
        private readonly ProtocolCacheHelper? _cacheHelper;
        private readonly int _rateLimitDelayMs;
        private readonly string _kaminoApiUrl;
        private readonly bool _fetchTransactionHistory;
        
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

        public KaminoService(
            HttpClient httpClient,
            IOptions<SolanaOptions> solanaOptions,
            IOptions<KaminoOptions> kaminoOptions,
            IProtocolConfigurationService protocolConfig,
            ILogger<KaminoService> logger,
            ProtocolCacheHelper? cacheHelper = null)
        {
            _httpClient = httpClient;
            _logger = logger;
            _protocolConfig = protocolConfig;
            _cacheHelper = cacheHelper;
            
            var protocolChain = _protocolConfig.GetProtocolOnChain("kamino", ChainEnum.Solana);
            _kaminoApiUrl = protocolChain?.Options?.TryGetValue("ApiUrl", out var apiUrl) == true 
                ? apiUrl?.ToString() ?? "https://api.kamino.finance"
                : "https://api.kamino.finance";
            
            _httpClient.BaseAddress = new System.Uri(_kaminoApiUrl);
            _httpClient.Timeout = System.TimeSpan.FromSeconds(30);
            
            _rateLimitDelayMs = solanaOptions.Value.RateLimitDelayMs / 2;
            
            // Opção para habilitar/desabilitar busca de histórico (pode ser lenta)
            _fetchTransactionHistory = protocolChain?.Options?.TryGetValue("FetchTransactionHistory", out var fetchHistory) == true 
                && bool.TryParse(fetchHistory?.ToString(), out var enabled) && enabled;
            
            _logger.LogInformation("KaminoService initialized - API: {ApiUrl}, Market: {Market}, FetchHistory: {FetchHistory}, using dynamic reserve mapping from API", 
                _kaminoApiUrl, MainMarketPubkey, _fetchTransactionHistory);
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
            var failedMarkets = new List<string>();
            var successfulMarkets = new List<string>();
            
            // Query all known markets
            foreach (var (marketPubkey, marketName) in KnownMarkets)
            {
                if (_rateLimitDelayMs > 0 && allPositions.Count > 0) // Skip delay on first iteration
                {
                    await Task.Delay(_rateLimitDelayMs);
                }

                _logger.LogDebug("KAMINO: Querying market {MarketName} ({Pubkey})", marketName, marketPubkey);
                
                try
                {
                    var positions = await GetPositionsForMarketAsync(address, marketPubkey, marketName);
                    if (positions.Any())
                    {
                        _logger.LogInformation("KAMINO: Found {Count} positions in {MarketName}", positions.Count(), marketName);
                        allPositions.AddRange(positions);
                    }
                    successfulMarkets.Add(marketName);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "KAMINO: Failed to query market {MarketName}", marketName);
                    failedMarkets.Add(marketName);
                }
            }

            // Se TODOS os markets falharam, lançar exceção
            if (failedMarkets.Count == KnownMarkets.Count)
            {
                var errorMessage = $"All {KnownMarkets.Count} Kamino markets failed: {string.Join(", ", failedMarkets)}";
                _logger.LogError("KAMINO: {ErrorMessage}", errorMessage);
                throw new HttpRequestException(errorMessage);
            }

            // Se alguns markets falharam, log warning mas continue com os dados que temos
            if (failedMarkets.Any())
            {
                _logger.LogWarning("KAMINO: Partial failure - {SuccessCount}/{TotalCount} markets succeeded. Failed markets: {FailedMarkets}", 
                    successfulMarkets.Count, KnownMarkets.Count, string.Join(", ", failedMarkets));
            }

            _logger.LogInformation("KAMINO: Total positions found: {Count} across {SuccessCount} successful markets", 
                allPositions.Count, successfulMarkets.Count);
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

                var positions = obligations.Select(o => MapObligationToPosition(o, marketName, reservesByAddress)).ToList();

                // Buscar histórico de transações se habilitado
                if (_fetchTransactionHistory)
                {
                    _logger.LogInformation("KAMINO: Fetching transaction history for {Count} obligations", obligations.Count);
                    await EnrichPositionsWithHistoryAsync(positions, obligations, marketPubkey, reservesByAddress);
                }

                _logger.LogDebug("KAMINO: Successfully mapped {Count} positions", positions.Count);
                return positions;
            }
            catch (OperationCanceledException ex)
            {
                _logger.LogWarning(ex, "KAMINO: Timeout querying market {Market} (15s exceeded)", marketName);
                throw; // Re-lançar exceção para o caller rastrear falha
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "KAMINO: HTTP error for market {Market}", marketName);
                throw;
            }
            catch (System.Text.Json.JsonException ex)
            {
                _logger.LogWarning(ex, "KAMINO: JSON parsing error in market {Market}", marketName);
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "KAMINO: Unexpected error in market {Market}", marketName);
                throw;
            }
        }

        private KaminoPosition MapObligationToPosition(
            KaminoObligationDto obligation, 
            string marketName, 
            Dictionary<string, KaminoReserveDto> reservesByAddress)
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

                    // Get token info from reserves data (dynamic from API)
                    var symbol = "UNKNOWN";
                    var decimals = 9; // Default
                    string? name = null;
                    string mintAddress = deposit.DepositReserve; // Fallback to reserve address
                    
                    if (reservesByAddress.TryGetValue(deposit.DepositReserve, out var reserve))
                    {
                        symbol = reserve.Symbol ?? $"Token-{deposit.DepositReserve.Substring(0, 4)}";
                        decimals = reserve.Decimals;
                        name = reserve.Symbol; // Use symbol as name if no specific name is available
                        mintAddress = reserve.MintAddress ?? deposit.DepositReserve; // Use actual mint address
                        
                        _logger.LogDebug("KAMINO Found reserve metadata: Symbol={Symbol}, Decimals={Decimals}, MintAddress={MintAddress}", symbol, decimals, mintAddress);
                    }
                    else
                    {
                        _logger.LogWarning("KAMINO Reserve {Reserve} not found in API data, using defaults", deposit.DepositReserve);
                        symbol = $"Token-{deposit.DepositReserve.Substring(0, 4)}";
                    }

                    var humanAmount = ConvertRawToHuman(rawAmount, decimals);
                    
                    _logger.LogDebug("KAMINO Deposit - Symbol={Symbol}, humanAmount={Amount}, marketValueSf={MarketValueSf}, totalDepositUsd={TotalDepositUsd}",
                        symbol, humanAmount, deposit.MarketValueSf, totalDepositUsd);
                    
                    decimal depositValueUsd = 0;
                    decimal unitPriceUsd = 0;
                    
                    // Try to calculate price from reserve market data first (more accurate)
                    if (reserve != null && humanAmount > 0)
                    {
                        var totalSupply = reserve.TotalSupply;
                        var totalSupplyUsd = reserve.TotalSupplyUsd;
                        
                        if (totalSupply > 0 && totalSupplyUsd > 0)
                        {
                            // Calculate real market price from reserves data
                            unitPriceUsd = totalSupplyUsd / totalSupply;
                            depositValueUsd = unitPriceUsd * humanAmount;
                            
                            _logger.LogDebug("KAMINO Deposit - Using reserve market price: ${Price:F2} (from totalSupplyUsd=${SupplyUsd} / totalSupply={Supply})",
                                unitPriceUsd, totalSupplyUsd, totalSupply);
                        }
                    }
                    
                    // Fallback to proportional calculation if reserve data not available
                    if (unitPriceUsd == 0 && humanAmount > 0 && !string.IsNullOrEmpty(deposit.MarketValueSf) && totalDepositUsd > 0)
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
                                
                                _logger.LogDebug("KAMINO Deposit - Using proportional fallback: proportion={Prop:F4}, depositValue=${Value:F2}, unitPrice=${Price:F2}",
                                    proportion, depositValueUsd, unitPriceUsd);
                            }
                        }
                    }

                    tokens.Add(new SplToken
                    {
                        Mint = mintAddress, // Use actual token mint, not reserve address
                        Symbol = symbol,
                        Name = name ?? symbol,
                        Decimals = decimals,
                        Amount = humanAmount,
                        PriceUsd = unitPriceUsd,
                        Logo = null,
                        Type = TokenType.Supplied,
                        Apy = deposit.Apy.HasValue ? deposit.Apy.Value * 100 : null // Convert decimal to percentage (0.04242 -> 4.242)
                    });

                    _logger.LogInformation("KAMINO Deposit added: {Symbol} = {Amount}, Mint={Mint}, PriceUsd=${Price:F2}, APY={Apy}% (raw: {Raw}, decimals: {Dec})",
                        symbol, humanAmount, mintAddress, unitPriceUsd, deposit.Apy.HasValue ? deposit.Apy.Value * 100 : (decimal?)null, rawAmount, decimals);
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

                    // Get token info from reserves data (dynamic from API)
                    var symbol = "UNKNOWN";
                    var decimals = 9; // Default
                    string? name = null;
                    string mintAddress = borrow.BorrowReserve; // Fallback to reserve address
                    
                    if (reservesByAddress.TryGetValue(borrow.BorrowReserve, out var reserve))
                    {
                        symbol = reserve.Symbol ?? $"Token-{borrow.BorrowReserve.Substring(0, 4)}";
                        decimals = reserve.Decimals;
                        name = reserve.Symbol; // Use symbol as name if no specific name is available
                        mintAddress = reserve.MintAddress ?? borrow.BorrowReserve; // Use actual mint address
                        
                        _logger.LogDebug("KAMINO Found reserve metadata: Symbol={Symbol}, Decimals={Decimals}, MintAddress={MintAddress}", symbol, decimals, mintAddress);
                    }
                    else
                    {
                        _logger.LogWarning("KAMINO Reserve {Reserve} not found in API data, using defaults", borrow.BorrowReserve);
                        symbol = $"Token-{borrow.BorrowReserve.Substring(0, 4)}";
                    }

                    var humanAmount = ConvertRawToHuman(rawAmount, decimals);
                    
                    _logger.LogDebug("KAMINO Borrow - humanAmount={Amount}, marketValueSf={MarketValueSf}",
                        humanAmount, borrow.MarketValueSf);
                    
                    decimal borrowValueUsd = 0;
                    decimal unitPriceUsd = 0;
                    
                    // Try to calculate price from reserve market data first (more accurate)
                    if (reserve != null && humanAmount > 0)
                    {
                        var totalSupply = reserve.TotalSupply;
                        var totalSupplyUsd = reserve.TotalSupplyUsd;
                        
                        if (totalSupply > 0 && totalSupplyUsd > 0)
                        {
                            // Calculate real market price from reserves data
                            unitPriceUsd = totalSupplyUsd / totalSupply;
                            borrowValueUsd = unitPriceUsd * humanAmount;
                            
                            _logger.LogDebug("KAMINO Borrow - Using reserve market price: ${Price:F2} (from totalSupplyUsd=${SupplyUsd} / totalSupply={Supply})",
                                unitPriceUsd, totalSupplyUsd, totalSupply);
                        }
                    }
                    
                    // Fallback to proportional calculation if reserve data not available
                    if (unitPriceUsd == 0 && humanAmount > 0 && !string.IsNullOrEmpty(borrow.MarketValueSf) && totalBorrowUsd > 0)
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
                                
                                _logger.LogDebug("KAMINO Borrow - Using proportional fallback: proportion={Prop:F4}, borrowValue=${Value:F2}, unitPrice=${Price:F2}",
                                    proportion, borrowValueUsd, unitPriceUsd);
                            }
                        }
                    }

                    tokens.Add(new SplToken
                    {
                        Mint = mintAddress, // Use actual token mint, not reserve address
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
        private (List<TokenBalance> supplies, List<TokenBalance> borrows) ExtractCurrentBalances(
            KaminoObligationDto obligation,
            Dictionary<string, KaminoReserveDto> reservesByAddress)
        {
            var supplies = new List<TokenBalance>();
            var borrows = new List<TokenBalance>();

            if (obligation.State?.Deposits != null)
            {
                foreach (var deposit in obligation.State.Deposits)
                {
                    if (string.IsNullOrEmpty(deposit.DepositReserve) ||
                        deposit.DepositReserve == "11111111111111111111111111111111")
                        continue;

                    var amount = ParseDecimal(deposit.DepositedAmount);
                    if (amount > 0)
                    {
                        // Mapear reserve address → mint address
                        if (reservesByAddress.TryGetValue(deposit.DepositReserve, out var reserve) &&
                            !string.IsNullOrEmpty(reserve.MintAddress))
                        {
                            supplies.Add(new TokenBalance 
                            { 
                                MintAddress = reserve.MintAddress, 
                                Balance = amount.ToString() 
                            });
                        }
                        else
                        {
                            _logger.LogWarning("KAMINO: Could not find mint address for reserve {Reserve}",
                                deposit.DepositReserve);
                        }
                    }
                }
            }

            if (obligation.State?.Borrows != null)
            {
                foreach (var borrow in obligation.State.Borrows)
                {
                    if (string.IsNullOrEmpty(borrow.BorrowReserve) ||
                        borrow.BorrowReserve == "11111111111111111111111111111111")
                        continue;

                    var amount = ParseDecimal(borrow.BorrowedAmountSf);
                    if (amount > 0)
                    {
                        // Mapear reserve address → mint address
                        if (reservesByAddress.TryGetValue(borrow.BorrowReserve, out var reserve) &&
                            !string.IsNullOrEmpty(reserve.MintAddress))
                        {
                            borrows.Add(new TokenBalance 
                            { 
                                MintAddress = reserve.MintAddress, 
                                Balance = amount.ToString() 
                            });
                        }
                        else
                        {
                            _logger.LogWarning("KAMINO: Could not find mint address for reserve {Reserve}",
                                borrow.BorrowReserve);
                        }
                    }
                }
            }

            return (supplies, borrows);
        }

        /// <summary>
        /// Valida se os balances atuais batem com os do cache
        /// </summary>
        private bool ValidateBalances(
            MongoDB.Bson.BsonDocument? cachedValidationHashDoc,
            List<TokenBalance> currentSupplies,
            List<TokenBalance> currentBorrows)
        {
            try
            {
                if (cachedValidationHashDoc == null)
                {
                    _logger.LogWarning("KAMINO: ValidationHash is null - cache invalid");
                    return false;
                }

                // Deserializar BsonDocument para KaminoValidationHash
                var cachedValidationHash = _cacheHelper?.DeserializeValidationHash<KaminoValidationHash>(cachedValidationHashDoc);
                if (cachedValidationHash == null)
                {
                    _logger.LogWarning("KAMINO: Could not deserialize ValidationHash - cache invalid");
                    return false;
                }

                var cachedSupplies = cachedValidationHash.Supplies
                    .Select(x => new TokenBalance
                    {
                        MintAddress = x.MintAddress,
                        Balance = x.Balance
                    }).ToList();
                    
                var cachedBorrows = cachedValidationHash.Borrows
                    .Select(x => new TokenBalance
                    {
                        MintAddress = x.MintAddress,
                        Balance = x.Balance
                    }).ToList();

                // Comparar supplies
                if (cachedSupplies.Count != currentSupplies.Count)
                {
                    _logger.LogInformation("KAMINO: Supply count changed - cached: {Cached}, current: {Current}",
                        cachedSupplies.Count, currentSupplies.Count);
                    return false;
                }

                // Criar dicionário para lookup rápido
                var currentSuppliesDict = currentSupplies.ToDictionary(x => x.MintAddress, x => x.Balance);

                foreach (var cached in cachedSupplies)
                {
                    if (!currentSuppliesDict.TryGetValue(cached.MintAddress, out var currentBalanceStr))
                    {
                        _logger.LogInformation("KAMINO: Supply token removed - {MintAddress}", cached.MintAddress);
                        return false;
                    }

                    var cachedAmount = decimal.Parse(cached.Balance);
                    var currentAmount = decimal.Parse(currentBalanceStr);

                    // Tolerar pequenas diferenças por juros acumulados (0.01%)
                    var diff = Math.Abs(currentAmount - cachedAmount);
                    var tolerance = cachedAmount * 0.0001m;
                    
                    if (diff > tolerance)
                    {
                        _logger.LogInformation("KAMINO: Supply changed - {MintAddress}: cached={Cached}, current={Current}, diff={Diff}",
                            cached.MintAddress.Substring(0, 8), cachedAmount, currentAmount, diff);
                        return false;
                    }
                }

                // Comparar borrows
                if (cachedBorrows.Count != currentBorrows.Count)
                {
                    _logger.LogInformation("KAMINO: Borrow count changed - cached: {Cached}, current: {Current}",
                        cachedBorrows.Count, currentBorrows.Count);
                    return false;
                }

                var currentBorrowsDict = currentBorrows.ToDictionary(x => x.MintAddress, x => x.Balance);

                foreach (var cached in cachedBorrows)
                {
                    if (!currentBorrowsDict.TryGetValue(cached.MintAddress, out var currentBalanceStr))
                    {
                        _logger.LogInformation("KAMINO: Borrow token removed - {MintAddress}", cached.MintAddress);
                        return false;
                    }

                    var cachedAmount = decimal.Parse(cached.Balance);
                    var currentAmount = decimal.Parse(currentBalanceStr);

                    // Tolerar pequenas diferenças por juros acumulados (0.01%)
                    var diff = Math.Abs(currentAmount - cachedAmount);
                    var tolerance = cachedAmount * 0.0001m;
                    
                    if (diff > tolerance)
                    {
                        _logger.LogInformation("KAMINO: Borrow changed - {MintAddress}: cached={Cached}, current={Current}, diff={Diff}",
                            cached.MintAddress.Substring(0, 8), cachedAmount, currentAmount, diff);
                        return false;
                    }
                }

                _logger.LogDebug("KAMINO: All balances match - cache valid");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "KAMINO: Error validating balances - treating cache as invalid");
                return false;
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

        /// <summary>
        /// Enriquece as posições com histórico de transações
        /// </summary>
        private async Task EnrichPositionsWithHistoryAsync(
            List<KaminoPosition> positions,
            List<KaminoObligationDto> obligations,
            string marketPubkey, 
            Dictionary<string, KaminoReserveDto> reservesByAddress)
        {
            for (int i = 0; i < positions.Count; i++)
            {
                var position = positions[i];
                var obligation = obligations[i];
                
                try
                {
                    // Extrair balances atuais para validação de cache
                    var (supplies, borrows) = ExtractCurrentBalances(obligation, reservesByAddress);
                    
                    var history = await GetObligationHistoryAsync(position.Id, marketPubkey, supplies, borrows);
                    
                    if (history.Any())
                    {
                        // Enriquecer eventos com símbolos de token
                        foreach (var evt in history)
                        {
                            // Tentar encontrar o símbolo nos reserves
                            var reserve = reservesByAddress.Values
                                .FirstOrDefault(r => r.MintAddress == evt.MintAddress);
                            
                            if (reserve != null)
                            {
                                evt.TokenSymbol = reserve.Symbol ?? evt.MintAddress.Substring(0, 6);
                            }
                            else
                            {
                                evt.TokenSymbol = evt.MintAddress.Substring(0, 6);
                            }
                        }

                        position.TransactionHistory = history
                            .OrderByDescending(e => e.Timestamp)
                            .ToList();

                        _logger.LogInformation("KAMINO: Added {Count} transaction events to position {Id}", 
                            history.Count, position.Id);
                    }

                    // Rate limiting entre requisições de histórico
                    if (_rateLimitDelayMs > 0)
                    {
                        await Task.Delay(_rateLimitDelayMs);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "KAMINO: Failed to fetch history for position {Id}", position.Id);
                    // Continue com outras posições mesmo se uma falhar
                }
            }
        }

        /// <summary>
        /// Busca o histórico de métricas de uma obligation para inferir eventos de deposit/borrow
        /// </summary>
        public async Task<List<KaminoTransactionEvent>> GetObligationHistoryAsync(
            string obligationPubkey, 
            string marketPubkey,
            List<TokenBalance> currentSupplies,
            List<TokenBalance> currentBorrows)
        {
            var protocolId = $"{marketPubkey}_{obligationPubkey}";
            
            if (_cacheHelper != null)
            {
                var currentHash = new Dictionary<string, object>
                {
                    { "marketPubkey", marketPubkey },
                    { "obligationPubkey", obligationPubkey }
                };

                // Buscar usando nosso formato de cache estável
                var cachedDto = await _cacheHelper.GetFromCacheAsync<KaminoTransactionHistoryCacheDto>(
                    protocol: "kamino",
                    protocolId: protocolId,
                    walletAddress: obligationPubkey,
                    dataType: "transaction_history",
                    currentValidationHash: currentHash
                );

                if (cachedDto != null && cachedDto.Events != null)
                {
                    // VALIDAR se os balances atuais ainda batem com o cache
                    var cached = await _cacheHelper.GetCacheDocumentAsync(
                        protocol: "kamino",
                        protocolId: protocolId,
                        walletAddress: obligationPubkey,
                        dataType: "transaction_history"
                    );
                    
                    if (cached != null && ValidateBalances(cached.ValidationHash, currentSupplies, currentBorrows))
                    {
                        var events = ConvertFromCacheDto(cachedDto);
                        _logger.LogInformation("KAMINO: ✓ Using cached transaction history for {Obligation} ({Count} events) - balances match",
                            obligationPubkey, events.Count);
                        return events;
                    }
                    else
                    {
                        _logger.LogInformation("KAMINO: ✗ Cache invalidated for {Obligation} - balances changed, refetching history",
                            obligationPubkey);
                    }
                }
            }

            var endpoint = $"v2/kamino-market/{marketPubkey}/obligations/{obligationPubkey}/metrics/history";
            
            try
            {
                _logger.LogInformation("KAMINO: Fetching obligation history for {Obligation} in market {Market}", 
                    obligationPubkey, marketPubkey);

                var sw = System.Diagnostics.Stopwatch.StartNew();
                var response = await _httpClient.GetAsync(endpoint);
                sw.Stop();
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("KAMINO: Failed to fetch obligation history - Status: {Status}", response.StatusCode);
                    return new List<KaminoTransactionEvent>();
                }

                var historyResponse = await response.Content.ReadFromJsonAsync<KaminoObligationHistoryResponseDto>();
                
                if (historyResponse?.History == null || !historyResponse.History.Any())
                {
                    _logger.LogDebug("KAMINO: No history found for obligation {Obligation}", obligationPubkey);
                    return new List<KaminoTransactionEvent>();
                }

                _logger.LogInformation("KAMINO: Found {Count} historical snapshots for obligation {Obligation}", 
                    historyResponse.History.Count, obligationPubkey);

                var events = InferTransactionEvents(historyResponse.History);

                if (_cacheHelper != null && events.Any())
                {
                    // Converter para nosso formato de cache antes de salvar
                    var cacheDto = ConvertToCacheDto(events);
                    
                    // Usar classe tipada para evitar _t/_v no MongoDB
                    var validationHash = new KaminoValidationHash
                    {
                        MarketPubkey = marketPubkey,
                        ObligationPubkey = obligationPubkey,
                        EventCount = events.Count,
                        LastEventDate = events.Max(e => e.Timestamp),
                        Supplies = currentSupplies.Select(s => new TokenBalanceHash
                        {
                            MintAddress = s.MintAddress,
                            Balance = s.Balance
                        }).ToList(),
                        Borrows = currentBorrows.Select(b => new TokenBalanceHash
                        {
                            MintAddress = b.MintAddress,
                            Balance = b.Balance
                        }).ToList()
                    };
                    
                    await _cacheHelper.SaveToCacheAsync(
                        protocol: "kamino",
                        protocolId: protocolId,
                        walletAddress: obligationPubkey,
                        dataType: "transaction_history",
                        chain: "solana",
                        body: cacheDto, // Salvamos nosso DTO, não a resposta bruta do Kamino
                        validationHash: validationHash,
                        apiCallDuration: (int)sw.ElapsedMilliseconds,
                        ttlHours: 0, // Ignorado - cache eterno sempre
                        relatedIds: new RelatedIds
                        {
                            MarketId = marketPubkey,
                            PositionId = obligationPubkey
                        }
                    );

                    _logger.LogInformation("KAMINO: Cached {Count} transaction events for {Obligation}",
                        events.Count, obligationPubkey);
                }

                return events;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "KAMINO: Error fetching obligation history for {Obligation}", obligationPubkey);
                return new List<KaminoTransactionEvent>();
            }
        }

        /// <summary>
        /// Converte eventos internos para formato estável de cache (dados crus apenas)
        /// </summary>
        private KaminoTransactionHistoryCacheDto ConvertToCacheDto(List<KaminoTransactionEvent> events)
        {
            return new KaminoTransactionHistoryCacheDto
            {
                Version = "1.0",
                Events = events.Select(e => new KaminoTransactionEventCache
                {
                    Type = e.Type,
                    MintAddress = e.MintAddress,
                    AmountChange = e.AmountChange,
                    Timestamp = e.Timestamp
                }).ToList()
            };
        }

        /// <summary>
        /// Converte formato de cache de volta para eventos internos
        /// </summary>
        private List<KaminoTransactionEvent> ConvertFromCacheDto(KaminoTransactionHistoryCacheDto dto)
        {
            return dto.Events.Select(e => new KaminoTransactionEvent
            {
                Type = e.Type,
                MintAddress = e.MintAddress,
                TokenSymbol = "UNKNOWN", // Será hidratado no mapper
                Amount = 0, // Não salvamos no cache - não precisamos
                AmountChange = e.AmountChange,
                Timestamp = e.Timestamp,
                ValueUsd = null // Será calculado na hidratação via metadata MongoDB
            }).ToList();
        }

        /// <summary>
        /// Compara snapshots consecutivos para inferir quando deposits e borrows ocorreram
        /// </summary>
        private List<KaminoTransactionEvent> InferTransactionEvents(List<KaminoHistorySnapshotDto> snapshots)
        {
            var events = new List<KaminoTransactionEvent>();

            // Ordenar por timestamp (mais antigo primeiro)
            var orderedSnapshots = snapshots
                .Where(s => !string.IsNullOrEmpty(s.Timestamp))
                .OrderBy(s => DateTime.Parse(s.Timestamp!))
                .ToList();

            if (orderedSnapshots.Count < 2)
            {
                _logger.LogDebug("KAMINO: Not enough snapshots to infer events (need at least 2)");
                return events;
            }

            // Comparar cada snapshot com o anterior
            for (int i = 1; i < orderedSnapshots.Count; i++)
            {
                var previous = orderedSnapshots[i - 1];
                var current = orderedSnapshots[i];
                var timestamp = DateTime.Parse(current.Timestamp!);

                // Verificar mudanças em deposits
                var depositEvents = CompareDeposits(previous.Deposits, current.Deposits, timestamp);
                events.AddRange(depositEvents);

                // Verificar mudanças em borrows
                var borrowEvents = CompareBorrows(previous.Borrows, current.Borrows, timestamp);
                events.AddRange(borrowEvents);
            }

            _logger.LogInformation("KAMINO: Inferred {Count} transaction events from snapshots", events.Count);
            return events;
        }

        private List<KaminoTransactionEvent> CompareDeposits(
            List<KaminoHistoryDepositDto>? previousDeposits, 
            List<KaminoHistoryDepositDto>? currentDeposits,
            DateTime timestamp)
        {
            var events = new List<KaminoTransactionEvent>();

            if (currentDeposits == null || !currentDeposits.Any())
                return events;

            var previousDict = previousDeposits?
                .Where(d => !string.IsNullOrEmpty(d.MintAddress))
                .ToDictionary(d => d.MintAddress!, d => ParseDecimal(d.Amount)) 
                ?? new Dictionary<string, decimal>();

            foreach (var deposit in currentDeposits)
            {
                if (string.IsNullOrEmpty(deposit.MintAddress))
                    continue;

                var currentAmount = ParseDecimal(deposit.Amount);
                var previousAmount = previousDict.GetValueOrDefault(deposit.MintAddress, 0);

                // Se houve aumento no amount, foi um novo deposit
                if (currentAmount > previousAmount)
                {
                    var amountChange = currentAmount - previousAmount;
                    events.Add(new KaminoTransactionEvent
                    {
                        Type = "deposit",
                        MintAddress = deposit.MintAddress,
                        TokenSymbol = "UNKNOWN", // Será enriquecido depois
                        Amount = currentAmount,
                        AmountChange = amountChange,
                        Timestamp = timestamp,
                        ValueUsd = ParseDecimalNullable(deposit.MarketValueRefreshed)
                    });
                }
            }

            return events;
        }

        private List<KaminoTransactionEvent> CompareBorrows(
            List<KaminoHistoryBorrowDto>? previousBorrows, 
            List<KaminoHistoryBorrowDto>? currentBorrows,
            DateTime timestamp)
        {
            var events = new List<KaminoTransactionEvent>();

            if (currentBorrows == null || !currentBorrows.Any())
                return events;

            var previousDict = previousBorrows?
                .Where(b => !string.IsNullOrEmpty(b.MintAddress))
                .ToDictionary(b => b.MintAddress!, b => ParseDecimal(b.Amount)) 
                ?? new Dictionary<string, decimal>();

            foreach (var borrow in currentBorrows)
            {
                if (string.IsNullOrEmpty(borrow.MintAddress))
                    continue;

                var currentAmount = ParseDecimal(borrow.Amount);
                var previousAmount = previousDict.GetValueOrDefault(borrow.MintAddress, 0);

                // Se houve aumento no amount, foi um novo borrow
                if (currentAmount > previousAmount)
                {
                    var amountChange = currentAmount - previousAmount;
                    events.Add(new KaminoTransactionEvent
                    {
                        Type = "borrow",
                        MintAddress = borrow.MintAddress,
                        TokenSymbol = "UNKNOWN", // Será enriquecido depois
                        Amount = currentAmount,
                        AmountChange = amountChange,
                        Timestamp = timestamp,
                        ValueUsd = ParseDecimalNullable(borrow.MarketValueRefreshed)
                    });
                }
            }

            return events;
        }

        private static decimal? ParseDecimalNullable(string? value)
        {
            if (string.IsNullOrEmpty(value))
                return null;

            return decimal.TryParse(value, System.Globalization.NumberStyles.Float, 
                System.Globalization.CultureInfo.InvariantCulture, out var result) ? result : null;
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
