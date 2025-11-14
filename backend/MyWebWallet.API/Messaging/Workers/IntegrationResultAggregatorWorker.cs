using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyWebWallet.API.Messaging.Contracts;
using MyWebWallet.API.Messaging.Rabbit;
using RabbitMQ.Client;
using System.Text.Json;
using System.Text.Json.Serialization;
using StackExchange.Redis;
using ChainEnum = MyWebWallet.API.Models.Chain;
using MyWebWallet.API.Services.Mappers;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using MyWebWallet.API.Services.Helpers;
using MyWebWallet.API.Aggregation; // added for IPriceService
using MyWebWallet.API.Services.Filters; // Add for ProtocolTokenFilter

namespace MyWebWallet.API.Messaging.Workers;

public class IntegrationResultAggregatorWorker : BaseConsumer
{
    private readonly ILogger<IntegrationResultAggregatorWorker> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };
    private readonly IConnectionMultiplexer _redis;
    private readonly IMessagePublisher _publisher;
    private readonly IServiceProvider _rootProvider;

    protected override string QueueName => "integration.results";

    public IntegrationResultAggregatorWorker(
        IRabbitMqConnectionFactory connectionFactory,
        IOptions<RabbitMqOptions> options,
        ILogger<IntegrationResultAggregatorWorker> logger,
        IConnectionMultiplexer redis,
        IMessagePublisher publisher,
        IServiceProvider rootProvider)
        : base(connectionFactory, options, logger)
    {
        _logger = logger;
        _redis = redis;
        _publisher = publisher;
        _rootProvider = rootProvider;
    }

    protected override void DeclareQueues(IModel channel)
    {
        channel.QueueDeclare(QueueName, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(QueueName, exchange: Options.Exchange, routingKey: "integration.result.*");
    }

    private static string ProviderSlug(IntegrationProvider provider) => provider.ToString().ToLowerInvariant();

    private sealed class AggregationSummary
    {
        public int TotalTokens { get; set; }
        public int TotalAaveSupplies { get; set; }
        public int TotalAaveBorrows { get; set; }
        public int TotalUniswapPositions { get; set; }
        public int TotalPendleLocks { get; set; }
        public int TotalPendleDeposits { get; set; }
        public HashSet<string> ProvidersCompleted { get; set; } = new(); // store provider[:chain]
    }

    private sealed class ConsolidatedWallet
    {
        public List<WalletItem> Items { get; set; } = new();
        public HashSet<string> Providers { get; set; } = new();
    }

    protected override async Task HandleMessageAsync(string routingKey, ReadOnlyMemory<byte> body, IBasicProperties props, CancellationToken ct)
    {
        var result = JsonSerializer.Deserialize<IntegrationResult>(body.Span, _jsonOptions);
        if (result is null)
        {
            _logger.LogWarning("Received null IntegrationResult payload");
            return;
        }

        // Determine chain (multi-chain aware: each request currently carries exactly one chain in list)
        var chainStr = result.Chains.FirstOrDefault();
        ChainEnum chainEnum = ChainEnum.Base; // default fallback
        if (!string.IsNullOrWhiteSpace(chainStr) && !Enum.TryParse<ChainEnum>(chainStr, true, out chainEnum))
        {
            _logger.LogWarning("Unknown chain '{Chain}' in result. Falling back to Base for mapping.", chainStr);
            chainEnum = ChainEnum.Base;
        }

        _logger.LogInformation("Aggregating result JobId={JobId} Provider={Provider} Chain={Chain} Status={Status}", result.JobId, result.Provider, chainEnum, result.Status);

        var db = _redis.GetDatabase();
        var jobId = result.JobId;
        var providerSlug = ProviderSlug(result.Provider);
        var providerChainKey = string.IsNullOrWhiteSpace(chainStr) ? providerSlug : $"{providerSlug}:{chainStr.ToLowerInvariant()}";

        var metaKey = $"wallet:agg:{jobId}:meta";
        var pendingKey = $"wallet:agg:{jobId}:pending";
        var resultKey = $"wallet:agg:{jobId}:result:{providerSlug}:{chainEnum.ToString().ToLowerInvariant()}"; // unique per provider+chain
        var summaryKey = $"wallet:agg:{jobId}:summary";
        var consolidatedKey = $"wallet:agg:{jobId}:wallet";

        if (!await db.KeyExistsAsync(metaKey))
        {
            _logger.LogWarning("Meta key missing for JobId={JobId}. Ignoring result.", jobId);
            return;
        }

        if (await db.KeyExistsAsync(resultKey))
        {
            _logger.LogInformation("Result already processed for JobId={JobId} Provider={Provider} Chain={Chain}", jobId, result.Provider, chainEnum);
            return;
        }

        var json = JsonSerializer.Serialize(result, _jsonOptions);
        var ttl = await db.KeyTimeToLiveAsync(metaKey) ?? TimeSpan.FromMinutes(15);
        await db.StringSetAsync(resultKey, json, ttl);

        // Remove pending entry (multi-chain aware). Try provider:chain first then legacy provider slug.
        var removed = await db.SetRemoveAsync(pendingKey, providerChainKey);
        if (!removed)
        {
            await db.SetRemoveAsync(pendingKey, providerSlug); // backwards compatibility
        }

        var tran = db.CreateTransaction();
        tran.HashIncrementAsync(metaKey, "processed_count", 1);
        switch (result.Status)
        {
            case IntegrationStatus.Success: tran.HashIncrementAsync(metaKey, "succeeded", 1); break;
            case IntegrationStatus.Failed: tran.HashIncrementAsync(metaKey, "failed", 1); break;
            case IntegrationStatus.TimedOut: tran.HashIncrementAsync(metaKey, "timed_out", 1); break;
            default: tran.HashIncrementAsync(metaKey, "failed", 1); break;
        }
        await tran.ExecuteAsync();

        // Incremental consolidation into wallet items (map + health factor enrichment)
        try
        {
            var consolidated = new ConsolidatedWallet();
            var existingWalletJson = await db.StringGetAsync(consolidatedKey);
            if (existingWalletJson.HasValue)
            {
                try { consolidated = JsonSerializer.Deserialize<ConsolidatedWallet>(existingWalletJson!, _jsonOptions) ?? new ConsolidatedWallet(); } catch { consolidated = new ConsolidatedWallet(); }
            }

            bool isAaveProvider = result.Provider is IntegrationProvider.AaveSupplies or IntegrationProvider.AaveBorrows;

            if (result.Status == IntegrationStatus.Success && result.Payload != null)
            {
                using var scope = _rootProvider.CreateScope();
                var mapperFactory = scope.ServiceProvider.GetRequiredService<IWalletItemMapperFactory>();
                List<WalletItem> newlyMapped = new();
                try
                {
                    newlyMapped = await MapPayloadAsync(result, mapperFactory, chainEnum);

                    // Deduplicate: remove protocol wrapper tokens from Moralis Wallet
                    if (newlyMapped.Count > 0 && result.Provider == IntegrationProvider.MoralisTokens)
                    {
                        // 1. Remove Aave-specific wrappers using IAaveeService
                        var aaveSvc = scope.ServiceProvider.GetRequiredService<IAaveeService>();
                        var wrappers = await aaveSvc.GetWrapperTokenAddressesAsync(chainEnum);
                        if (wrappers.Count > 0)
                        {
                            int aaveRemoved = 0;
                            foreach (var wi in newlyMapped.Where(i => i.Type == WalletItemType.Wallet && i.Protocol?.Id == "moralis" && i.Position?.Tokens != null))
                            {
                                var before = wi.Position.Tokens.Count;
                                wi.Position.Tokens = wi.Position.Tokens
                                    .Where(t => string.IsNullOrEmpty(t?.ContractAddress) || !wrappers.Contains(t.ContractAddress))
                                    .ToList();
                                aaveRemoved += Math.Max(0, before - wi.Position.Tokens.Count);
                            }
                            if (aaveRemoved > 0)
                                _logger.LogInformation("Deduplicated {Count} Moralis tokens (Aave wrappers by address) chain={Chain}", aaveRemoved, chainEnum);
                        }
                        
                        // 2. Remove general protocol tokens using ProtocolTokenFilter (pattern-based)
                        int protocolRemoved = 0;
                        foreach (var wi in newlyMapped.Where(i => i.Type == WalletItemType.Wallet && i.Protocol?.Id == "moralis" && i.Position?.Tokens != null))
                        {
                            var before = wi.Position.Tokens.Count;
                            wi.Position.Tokens = wi.Position.Tokens
                                .Where(t => !ProtocolTokenFilter.ShouldFilterToken(t?.Symbol, t?.ContractAddress))
                                .ToList();
                            protocolRemoved += Math.Max(0, before - wi.Position.Tokens.Count);
                        }
                        if (protocolRemoved > 0)
                            _logger.LogInformation("Deduplicated {Count} Moralis protocol receipt tokens (by pattern) chain={Chain}", protocolRemoved, chainEnum);
                        
                        // Remove empty wallet items after filtering
                        newlyMapped.RemoveAll(i => i.Type == WalletItemType.Wallet && i.Protocol?.Id == "moralis" && (i.Position?.Tokens == null || i.Position.Tokens.Count == 0));
                    }

                    if (newlyMapped.Count > 0)
                    {
                        // 1. Logos
                        var tokenLogoService = scope.ServiceProvider.GetRequiredService<ITokenLogoService>();
                        var hydrationHelper = new TokenHydrationHelper(tokenLogoService);
                        var logos = await hydrationHelper.HydrateTokenLogosAsync(newlyMapped, chainEnum);
                        hydrationHelper.ApplyTokenLogosToWalletItems(newlyMapped, logos);

                        // 2. Prices (novo passo)
                        try
                        {
                            var priceService = scope.ServiceProvider.GetRequiredService<IPriceService>();
                            var prices = await priceService.HydratePricesAsync(newlyMapped, chainEnum, ct);
                            if (prices.Count > 0)
                            {
                                int applied = 0;
                                foreach (var wi in newlyMapped)
                                {
                                    if (wi.Position?.Tokens == null) continue;
                                    foreach (var tk in wi.Position.Tokens)
                                    {
                                        if (tk?.Financials == null) continue;
                                        if (tk.Financials.Price is > 0) continue; // already priced
                                        var key = BuildPriceKey(tk);
                                        if (string.IsNullOrEmpty(key)) continue;
                                        if (prices.TryGetValue(key, out var price) && price > 0)
                                        {
                                            tk.Financials.Price = price;
                                            var formatted = tk.Financials.BalanceFormatted ?? tk.Financials.AmountFormatted;
                                            if (formatted.HasValue)
                                                tk.Financials.TotalPrice = formatted.Value * price;
                                            applied++;
                                        }
                                    }
                                }
                                if (applied > 0)
                                    _logger.LogDebug("Applied {Applied} prices (initial mapping) jobId={JobId} chain={Chain}", applied, jobId, chainEnum);
                            }
                        }
                        catch (Exception pxEx)
                        {
                            _logger.LogWarning(pxEx, "Price hydration failed (initial) jobId={JobId} chain={Chain}", jobId, chainEnum);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Mapping payload failed JobId={JobId} Provider={Provider} Chain={Chain}", jobId, result.Provider, chainEnum);
                }
                foreach (var item in newlyMapped)
                {
                    consolidated.Items.Add(item);
                }
                consolidated.Providers.Add(providerChainKey);
            }

            // If both Aave supplies & borrows present for this chain, compute HealthFactor (simple heuristic)
            if (isAaveProvider)
            {
                bool hasSupplies = consolidated.Providers.Any(p => p.StartsWith("aavesupplies", StringComparison.OrdinalIgnoreCase));
                bool hasBorrows = consolidated.Providers.Any(p => p.StartsWith("aaveborrows", StringComparison.OrdinalIgnoreCase));
                if (hasSupplies && hasBorrows)
                {
                    try
                    {
                        decimal collateralUsd = 0m;
                        decimal debtUsd = 0m;
                        foreach (var wi in consolidated.Items.Where(i => i.Protocol?.Id == "aave-v3" && i.Type == WalletItemType.LendingAndBorrowing))
                        {
                            var label = wi.Position?.Label?.ToLowerInvariant();
                            if (label == "supplied")
                            {
                                var isCollateral = wi.AdditionalData?.IsCollateral ?? true;
                                if (isCollateral && wi.Position?.Tokens != null)
                                {
                                    foreach (var t in wi.Position.Tokens)
                                    {
                                        var tp = t.Financials?.TotalPrice ?? 0m;
                                        if (tp > 0) collateralUsd += tp;
                                    }
                                }
                            }
                            else if (label == "borrowed")
                            {
                                if (wi.Position?.Tokens != null)
                                {
                                    foreach (var t in wi.Position.Tokens)
                                    {
                                        var tp = t.Financials?.TotalPrice ?? 0m;
                                        if (tp > 0) debtUsd += tp;
                                    }
                                }
                            }
                        }
                        const decimal assumedLT = 0.8m;
                        decimal healthFactor = debtUsd == 0m ? decimal.MaxValue : (collateralUsd * assumedLT) / debtUsd;
                        foreach (var wi in consolidated.Items.Where(i => i.Protocol?.Id == "aave-v3" && i.Type == WalletItemType.LendingAndBorrowing))
                        {
                            wi.AdditionalData ??= new AdditionalData();
                            wi.AdditionalData.HealthFactor = healthFactor;
                        }
                    }
                    catch (Exception hfEx)
                    {
                        _logger.LogDebug(hfEx, "HF compute failed jobId={JobId}", jobId);
                    }
                }
            }

            await db.StringSetAsync(consolidatedKey, JsonSerializer.Serialize(consolidated, _jsonOptions), ttl);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed consolidating wallet jobId={JobId}", jobId);
        }

        // Summary (counts + health flag)
        try
        {
            var existingSummaryJson = await db.StringGetAsync(summaryKey);
            AggregationSummary summary = existingSummaryJson.HasValue ? (JsonSerializer.Deserialize<AggregationSummary>(existingSummaryJson!, _jsonOptions) ?? new()) : new();
            
            if (result.Status == IntegrationStatus.Success && result.Payload is JsonElement payloadEl && payloadEl.ValueKind != JsonValueKind.Null)
            {
                switch (result.Provider)
                {
                    case IntegrationProvider.MoralisTokens:
                        if (payloadEl.TryGetProperty("result", out var moralisArray) && moralisArray.ValueKind == JsonValueKind.Array)
                            summary.TotalTokens += moralisArray.GetArrayLength();
                        break;

                    case IntegrationProvider.SolanaTokens:
                        if (payloadEl.TryGetProperty("tokens", out var solToks) && solToks.ValueKind == JsonValueKind.Array)
                            summary.TotalTokens += solToks.GetArrayLength();
                        break;

                    case IntegrationProvider.AaveSupplies:
                        if (payloadEl.TryGetProperty("data", out var aaveSupData) && aaveSupData.TryGetProperty("userSupplies", out var sups) && sups.ValueKind == JsonValueKind.Array)
                            summary.TotalAaveSupplies += sups.GetArrayLength();
                        break;

                    case IntegrationProvider.AaveBorrows:
                        if (payloadEl.TryGetProperty("data", out var aaveBorData) && aaveBorData.TryGetProperty("userBorrows", out var bors) && bors.ValueKind == JsonValueKind.Array)
                            summary.TotalAaveBorrows += bors.GetArrayLength();
                        break;

                    case IntegrationProvider.UniswapV3Positions:
                        if (payloadEl.TryGetProperty("data", out var uniData) && uniData.TryGetProperty("positions", out var posArr) && posArr.ValueKind == JsonValueKind.Array)
                            summary.TotalUniswapPositions += posArr.GetArrayLength();
                        break;
                    
                    case IntegrationProvider.PendleVePositions:
                        if (payloadEl.TryGetProperty("data", out var pendleVeData) && 
                            pendleVeData.TryGetProperty("locks", out var locksArr) && 
                            locksArr.ValueKind == JsonValueKind.Array)
                            summary.TotalPendleLocks += locksArr.GetArrayLength();
                        break;
                    
                    case IntegrationProvider.PendleDeposits:
                        if (payloadEl.TryGetProperty("data", out var pendleDepData) && 
                            pendleDepData.TryGetProperty("deposits", out var depositsArr) && 
                            depositsArr.ValueKind == JsonValueKind.Array)
                            summary.TotalPendleDeposits += depositsArr.GetArrayLength();
                        break;
                    
                    // Kamino and Raydium payloads are arrays, no specific count needed for summary yet.
                    // This case prevents the "requires an element of type 'Object'" error.
                    case IntegrationProvider.SolanaKaminoPositions:
                    case IntegrationProvider.SolanaRaydiumPositions:
                        // No action needed, payload is an empty array.
                        break;
                }
            }
            summary.ProvidersCompleted.Add(providerChainKey);
            await db.StringSetAsync(summaryKey, JsonSerializer.Serialize(summary, _jsonOptions), ttl);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed updating summary jobId={JobId}", jobId);
        }

        var remaining = await db.SetLengthAsync(pendingKey);
        var succeeded = (int)(long)(await db.HashGetAsync(metaKey, "succeeded"));
        var failed = (int)(long)(await db.HashGetAsync(metaKey, "failed"));
        var timedOut = (int)(long)(await db.HashGetAsync(metaKey, "timed_out"));
        var expectedTotal = (int)(long)(await db.HashGetAsync(metaKey, "expected_total"));

        _logger.LogInformation("Job {JobId} progress: expected={Expected} remaining={Remaining} success={Succeeded} failed={Failed} timedOut={TimedOut}", jobId, expectedTotal, remaining, succeeded, failed, timedOut);

        var finalEmittedVal = await db.HashGetAsync(metaKey, "final_emitted");
        var finalAlready = finalEmittedVal.HasValue && finalEmittedVal == "1";

        if (finalAlready)
        {
            var currentStatusVal = await db.HashGetAsync(metaKey, "status");
            if (currentStatusVal.HasValue && (currentStatusVal == AggregationStatus.TimedOut.ToString() || currentStatusVal == AggregationStatus.CompletedWithErrors.ToString()))
            {
                if (succeeded == expectedTotal && failed == 0)
                {
                    await db.HashSetAsync(metaKey, new HashEntry[] { new("status", AggregationStatus.Completed.ToString()) });
                    _logger.LogInformation("Upgraded status to Completed after late successes jobId={JobId}", jobId);
                }
            }
        }

        if (remaining == 0 && !finalAlready)
        {
            try
            {
                var consolidatedJson = await db.StringGetAsync(consolidatedKey);
                if (consolidatedJson.HasValue)
                {
                    var wallet = JsonSerializer.Deserialize<ConsolidatedWallet>(consolidatedJson!, _jsonOptions) ?? new ConsolidatedWallet();
                    if (wallet.Items.Count > 0)
                    {
                        // Price hydration final (agrupa por chain textual dos tokens)
                        try
                        {
                            using var scope = _rootProvider.CreateScope();
                            var priceService = scope.ServiceProvider.GetRequiredService<IPriceService>();
                            var tokensByChain = wallet.Items
                                .SelectMany(w => w.Position?.Tokens ?? Enumerable.Empty<Token>())
                                .GroupBy(t => (t.Chain ?? string.Empty).ToLowerInvariant());
                            int filled = 0;
                            foreach (var g in tokensByChain)
                            {
                                if (string.IsNullOrEmpty(g.Key)) continue;
                                if (!Enum.TryParse<ChainEnum>(g.Key, true, out var parsedChain)) parsedChain = ChainEnum.Base;
                                // Build synthetic wallet subset for this chain
                                var subsetItems = wallet.Items.Where(w => (w.Position?.Tokens?.Any(tk => (tk.Chain ?? "").Equals(g.Key, StringComparison.OrdinalIgnoreCase)) ?? false)).ToList();
                                if (subsetItems.Count == 0) continue;
                                var prices = await priceService.HydratePricesAsync(subsetItems, parsedChain, ct);
                                if (prices.Count == 0) continue;
                                foreach (var wi in subsetItems)
                                {
                                    if (wi.Position?.Tokens == null) continue;
                                    foreach (var tk in wi.Position.Tokens)
                                    {
                                        if (tk.Financials == null) continue;
                                        if (tk.Financials.Price is > 0) continue;
                                        var key = BuildPriceKey(tk);
                                        if (prices.TryGetValue(key, out var price) && price > 0)
                                        {
                                            tk.Financials.Price = price;
                                            var formatted = tk.Financials.BalanceFormatted ?? tk.Financials.AmountFormatted;
                                            if (formatted.HasValue)
                                                tk.Financials.TotalPrice = formatted.Value * price;
                                            filled++;
                                        }
                                    }
                                }
                            }
                            if (filled > 0)
                            {
                                await db.StringSetAsync(consolidatedKey, JsonSerializer.Serialize(wallet, _jsonOptions), ttl);
                                _logger.LogInformation("Final price hydration applied {Filled} prices jobId={JobId}", filled, jobId);
                            }
                        }
                        catch (Exception finalPxEx)
                        {
                            _logger.LogWarning(finalPxEx, "Final price hydration failed jobId={JobId}", jobId);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "PRICE_HYDRATION_FINAL: failed jobId={JobId}", jobId);
            }

            AggregationStatus aggStatus;
            if (succeeded == expectedTotal && failed == 0) aggStatus = AggregationStatus.Completed;
            else if (timedOut > 0 && succeeded == 0 && failed == 0) aggStatus = AggregationStatus.TimedOut;
            else if (failed == 0 && timedOut == 0) aggStatus = AggregationStatus.Completed;
            else if (timedOut > 0) aggStatus = AggregationStatus.TimedOut;
            else aggStatus = AggregationStatus.CompletedWithErrors;

            var tran2 = db.CreateTransaction();
            tran2.HashSetAsync(metaKey, new HashEntry[] { new("status", aggStatus.ToString()), new("final_emitted", 1) });
            await tran2.ExecuteAsync();

            var accountVal = await db.HashGetAsync(metaKey, "account");
            var chainsVal = await db.HashGetAsync(metaKey, "chains");
            var completedEvent = new WalletAggregationCompleted(jobId, accountVal, aggStatus, DateTime.UtcNow, expectedTotal, succeeded, failed, timedOut);
            await _publisher.PublishAsync("aggregation.completed", completedEvent, ct);
            var doneKey = $"wallet:agg:{jobId}:done"; await db.StringSetAsync(doneKey, "1", ttl);

            if (accountVal.HasValue && chainsVal.HasValue)
            {
                try
                {
                    foreach (var activeChainStr in chainsVal.ToString().Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                    {
                        if (Enum.TryParse<ChainEnum>(activeChainStr, true, out var activeChain))
                        {
                            var activeKey = $"wallet:agg:active:{accountVal.ToString().ToLowerInvariant()}:{activeChain}";
                            var activeVal = await db.StringGetAsync(activeKey);
                            if (activeVal.HasValue && activeVal.ToString() == jobId.ToString()) await db.KeyDeleteAsync(activeKey);
                        }
                    }
                }
                catch (Exception ex) { _logger.LogWarning(ex, "Failed clearing active job keys for jobId={JobId}", jobId); }
            }
        }
    }

    private static async Task<List<WalletItem>> MapPayloadAsync(IntegrationResult result, IWalletItemMapperFactory factory, ChainEnum chain)
    {
        var list = new List<WalletItem>();
        switch (result.Provider)
        {
            case IntegrationProvider.MoralisTokens:
                if (result.Payload is JsonElement moralisEl && moralisEl.TryGetProperty("result", out var tokensArr) && tokensArr.ValueKind == JsonValueKind.Array)
                {
                    var tokens = JsonSerializer.Deserialize<List<TokenDetail>>(tokensArr.GetRawText());
                    if (tokens != null) list.AddRange(await factory.CreateMoralisTokenMapper().MapAsync(tokens, chain));
                }
                break;
            case IntegrationProvider.AaveSupplies:
                if (result.Payload is JsonElement supEl)
                {
                    var dto = JsonSerializer.Deserialize<AaveGetUserSuppliesResponse>(supEl.GetRawText());
                    if (dto != null) list.AddRange(await factory.CreateAaveSuppliesMapper().MapAsync(dto, chain));
                }
                break;
            case IntegrationProvider.AaveBorrows:
                if (result.Payload is JsonElement borEl)
                {
                    var dto = JsonSerializer.Deserialize<AaveGetUserBorrowsResponse>(borEl.GetRawText());
                    if (dto != null) list.AddRange(await factory.CreateAaveBorrowsMapper().MapAsync(dto, chain));
                }
                break;
            case IntegrationProvider.UniswapV3Positions:
                if (result.Payload is JsonElement uniEl)
                {
                    var dto = JsonSerializer.Deserialize<UniswapV3GetActivePoolsResponse>(uniEl.GetRawText());
                    if (dto != null) list.AddRange(await factory.CreateUniswapV3Mapper().MapAsync(dto, chain));
                }
                break;
            case IntegrationProvider.PendleVePositions:
                if (result.Payload is JsonElement pendleEl)
                {
                    var dto = JsonSerializer.Deserialize<PendleVePositionsResponse>(pendleEl.GetRawText());
                    if (dto != null) list.AddRange(await factory.CreatePendleVeMapper().MapAsync(dto, chain));
                }
                break;
            case IntegrationProvider.PendleDeposits:
                if (result.Payload is JsonElement pendleDepEl)
                {
                    var dto = JsonSerializer.Deserialize<PendleDepositsResponse>(pendleDepEl.GetRawText());
                    if (dto != null) list.AddRange(await factory.CreatePendleDepositsMapper().MapAsync(dto, chain));
                }
                break;
            case IntegrationProvider.SolanaTokens:
                if (result.Payload is JsonElement solTokEl)
                {
                    var dto = JsonSerializer.Deserialize<SolanaTokenResponse>(solTokEl.GetRawText());
                    if (dto != null)
                    {
                        list.AddRange(await factory.CreateSolanaTokenMapper().MapAsync(dto, chain));
                    }
                }
                break;
            case IntegrationProvider.SolanaKaminoPositions:
                if (result.Payload is JsonElement kaminoEl)
                {
                    var positions = JsonSerializer.Deserialize<IEnumerable<KaminoPosition>>(kaminoEl.GetRawText()) ?? Enumerable.Empty<KaminoPosition>();
                    list.AddRange(await factory.CreateSolanaKaminoMapper().MapAsync(positions, chain));
                }
                break;
            case IntegrationProvider.SolanaRaydiumPositions:
                if (result.Payload is JsonElement raydiumEl)
                {
                    var positions = JsonSerializer.Deserialize<IEnumerable<RaydiumPosition>>(raydiumEl.GetRawText()) ?? Enumerable.Empty<RaydiumPosition>();
                    list.AddRange(await factory.CreateSolanaRaydiumMapper().MapAsync(positions, chain));
                }
                break;
        }
        return list;
    }

    private static string BuildPriceKey(Token t)
    {
        if (t == null) return string.Empty;
        var sym = t.Symbol; if (string.IsNullOrWhiteSpace(sym)) return string.Empty;
        var chain = t.Chain ?? string.Empty;
        return (sym + "|" + chain).ToLowerInvariant();
    }
}
