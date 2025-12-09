using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using DeFi10.API.Messaging.Contracts.Enums;
using DeFi10.API.Messaging.Contracts.Results;
using DeFi10.API.Messaging.Contracts.Progress;
using DeFi10.API.Messaging.Rabbit;
using RabbitMQ.Client;
using System.Text.Json;
using System.Text.Json.Serialization;
using StackExchange.Redis;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Services.Mappers;
using DeFi10.API.Services.Models;
using DeFi10.API.Services.Models.Aave.Supplies;
using DeFi10.API.Services.Models.Solana.Common;
using DeFi10.API.Services.Models.Solana.Kamino;
using DeFi10.API.Services.Models.Solana.Raydium;
using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using DeFi10.API.Services.Helpers;
using DeFi10.API.Aggregation;
using DeFi10.API.Services.Solana;
using DeFi10.API.Services.Filters;
using DeFi10.API.Configuration;
using DeFi10.API.Messaging.Workers.TriggerRules;

namespace DeFi10.API.Messaging.Workers;

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
    private readonly TimeSpan _walletCacheTtl;
    private readonly JobExpansionService _jobExpansionService;
    private readonly IEnumerable<IProtocolTriggerDetector> _triggerDetectors;

    protected override string QueueName => "integration.results";

    public IntegrationResultAggregatorWorker(
        IRabbitMqConnectionFactory connectionFactory,
        IOptions<RabbitMqOptions> options,
        ILogger<IntegrationResultAggregatorWorker> logger,
        IConnectionMultiplexer redis,
        IMessagePublisher publisher,
        IServiceProvider rootProvider,
        IOptions<AggregationOptions> aggOptions,
        JobExpansionService jobExpansionService,
        IEnumerable<IProtocolTriggerDetector> triggerDetectors)
        : base(connectionFactory, options, logger)
    {
        _logger = logger;
        _redis = redis;
        _publisher = publisher;
        _rootProvider = rootProvider;
        _walletCacheTtl = TimeSpan.FromMinutes(Math.Clamp(aggOptions.Value.WalletCacheTtlMinutes, 1, 60));
        _jobExpansionService = jobExpansionService;
        _triggerDetectors = triggerDetectors;
        _logger.LogDebug("IntegrationResultAggregatorWorker initialized with WalletCacheTTL={TTL}min, TriggerDetectors={Count}", 
            _walletCacheTtl.TotalMinutes, _triggerDetectors.Count());
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
        public int TotalRaydiumPositions { get; set; }
        public HashSet<string> ProvidersCompleted { get; set; } = new();
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

        var chainStr = result.Chains.FirstOrDefault();
        ChainEnum chainEnum = ChainEnum.Base;
        if (!string.IsNullOrWhiteSpace(chainStr) && !Enum.TryParse<ChainEnum>(chainStr, true, out chainEnum))
        {
            _logger.LogWarning("Unknown chain '{Chain}' in result. Falling back to Base for mapping.", chainStr);
            chainEnum = ChainEnum.Base;
        }

        var db = _redis.GetDatabase();
        var jobId = result.JobId;
        var providerSlug = ProviderSlug(result.Provider);
        var account = result.Account;
        var accountLower = account.ToLowerInvariant();

        // 1. VERIFICAR CACHE COMPARTILHADO (cross-job)
        var cacheKey = RedisKeys.WalletCache(accountLower, chainEnum, providerSlug);
        var cachedResult = await db.StringGetAsync(cacheKey);
        
        if (cachedResult.HasValue)
        {
            _logger.LogDebug("CACHE HIT: Reusing cached result for {Account} {Provider} {Chain} in job {JobId}", 
                account, result.Provider, chainEnum, jobId);
            
            try
            {
                var cachedIntegrationResult = JsonSerializer.Deserialize<IntegrationResult>(cachedResult!, _jsonOptions);
                if (cachedIntegrationResult != null)
                {
                    // Atualizar JobId para o job atual
                    cachedIntegrationResult = cachedIntegrationResult with { JobId = jobId };
                    result = cachedIntegrationResult;
                }
            }
            catch (Exception cacheEx)
            {
                _logger.LogWarning(cacheEx, "Failed to deserialize cached result, will process normally");
            }
        }
        else if (result.Status == IntegrationStatus.Success)
        {
            // 2. SALVAR NO CACHE (TTL configurável para reutilização cross-job)
            await db.StringSetAsync(cacheKey, JsonSerializer.Serialize(result, _jsonOptions), _walletCacheTtl);
            _logger.LogDebug("CACHE SAVED: Cached result for {Account} {Provider} {Chain} (TTL={TTL}min)", 
                account, result.Provider, chainEnum, _walletCacheTtl.TotalMinutes);
        }

        _logger.LogDebug("Aggregating result JobId={JobId} Provider={Provider} Chain={Chain} Account={Account} Status={Status}", 
            result.JobId, result.Provider, chainEnum, result.Account, result.Status);

        var providerChainKey = string.IsNullOrWhiteSpace(chainStr) ? providerSlug : $"{providerSlug}:{chainStr.ToLowerInvariant()}";

        var metaKey = $"wallet:agg:{jobId}:meta";

        var accountsField = await db.HashGetAsync(metaKey, "accounts");
        bool isMultiWallet = accountsField.HasValue && accountsField.ToString().Contains(',');

        var pendingKey = $"wallet:agg:{jobId}:pending";

        var resultKey = isMultiWallet 
            ? $"wallet:agg:{jobId}:result:{providerSlug}:{chainEnum.ToString().ToLowerInvariant()}:{account.ToLowerInvariant()}"
            : $"wallet:agg:{jobId}:result:{providerSlug}:{chainEnum.ToString().ToLowerInvariant()}";
        
        var summaryKey = $"wallet:agg:{jobId}:summary";
        var consolidatedKey = $"wallet:agg:{jobId}:wallet";

        if (!await db.KeyExistsAsync(metaKey))
        {
            _logger.LogWarning("Meta key missing for JobId={JobId}. Ignoring result.", jobId);
            return;
        }

        if (await db.KeyExistsAsync(resultKey))
        {
            _logger.LogDebug("Result already processed for JobId={JobId} Provider={Provider} Chain={Chain} Account={Account}", 
                jobId, result.Provider, chainEnum, account);
            return;
        }

        var json = JsonSerializer.Serialize(result, _jsonOptions);
        var ttl = await db.KeyTimeToLiveAsync(metaKey) ?? TimeSpan.FromMinutes(15);
        await db.StringSetAsync(resultKey, json, ttl);

        var pendingEntry = isMultiWallet 
            ? $"{providerSlug}:{chainStr?.ToLowerInvariant()}:{account.ToLowerInvariant()}"
            : providerChainKey;
        
        var removed = await db.SetRemoveAsync(pendingKey, pendingEntry);
        if (!removed && !isMultiWallet)
        {
            await db.SetRemoveAsync(pendingKey, providerSlug);
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

        try
        {

            if (isMultiWallet)
            {

                var walletConsolidatedKey = $"wallet:agg:{jobId}:wallet:{account.ToLowerInvariant()}";
                
                var consolidated = new ConsolidatedWallet();
                var existingWalletJson = await db.StringGetAsync(walletConsolidatedKey);
                if (existingWalletJson.HasValue)
                {
                    try { consolidated = JsonSerializer.Deserialize<ConsolidatedWallet>(existingWalletJson!, _jsonOptions) ?? new ConsolidatedWallet(); } 
                    catch { consolidated = new ConsolidatedWallet(); }
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

                        if (newlyMapped.Count > 0 && result.Provider == IntegrationProvider.MoralisTokens)
                        {

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
                                    _logger.LogDebug("Deduplicated {Count} Moralis tokens (Aave wrappers by address) chain={Chain} account={Account}", 
                                        aaveRemoved, chainEnum, account);
                            }

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
                                _logger.LogDebug("Deduplicated {Count} Moralis protocol receipt tokens (by pattern) chain={Chain} account={Account}", 
                                    protocolRemoved, chainEnum, account);

                            newlyMapped.RemoveAll(i => i.Type == WalletItemType.Wallet && i.Protocol?.Id == "moralis" && (i.Position?.Tokens == null || i.Position.Tokens.Count == 0));
                        }

                        if (newlyMapped.Count > 0)
                        {
                            // Apenas popular keys, a hidratação de metadados será feita na consolidação final
                            newlyMapped.PopulateKeys();

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
                                            if (tk.Financials.Price is > 0) continue;
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
                                        _logger.LogDebug("Applied {Applied} prices (initial mapping) jobId={JobId} chain={Chain} account={Account}", 
                                            applied, jobId, chainEnum, account);
                                }
                            }
                            catch (Exception pxEx)
                            {
                                _logger.LogWarning(pxEx, "Price hydration failed (initial) jobId={JobId} chain={Chain} account={Account}", 
                                    jobId, chainEnum, account);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Mapping payload failed JobId={JobId} Provider={Provider} Chain={Chain} Account={Account}", 
                            jobId, result.Provider, chainEnum, account);
                    }
                    foreach (var item in newlyMapped)
                    {
                        consolidated.Items.Add(item);
                    }
                    consolidated.Providers.Add($"{providerSlug}:{chainStr?.ToLowerInvariant()}:{account.ToLowerInvariant()}");
                }

                if (isAaveProvider)
                {
                    bool hasSupplies = consolidated.Providers.Any(p => p.Contains("aavesupplies", StringComparison.OrdinalIgnoreCase));
                    bool hasBorrows = consolidated.Providers.Any(p => p.Contains("aaveborrows", StringComparison.OrdinalIgnoreCase));
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
                            _logger.LogDebug("Computed health factor {HF} for account={Account} chain={Chain}", healthFactor, account, chainEnum);
                        }
                        catch (Exception hfEx)
                        {
                            _logger.LogDebug(hfEx, "HF compute failed jobId={JobId} account={Account}", jobId, account);
                        }
                    }
                }

                await db.StringSetAsync(walletConsolidatedKey, JsonSerializer.Serialize(consolidated, _jsonOptions), ttl);
            }
            else
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

                        if (newlyMapped.Count > 0 && result.Provider == IntegrationProvider.MoralisTokens)
                        {

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
                                    _logger.LogDebug("Deduplicated {Count} Moralis tokens (Aave wrappers by address) chain={Chain}", aaveRemoved, chainEnum);
                            }

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
                                _logger.LogDebug("Deduplicated {Count} Moralis protocol receipt tokens (by pattern) chain={Chain}", protocolRemoved, chainEnum);

                            newlyMapped.RemoveAll(i => i.Type == WalletItemType.Wallet && i.Protocol?.Id == "moralis" && (i.Position?.Tokens == null || i.Position.Tokens.Count == 0));
                        }

                        if (newlyMapped.Count > 0)
                        {
                            // Apenas popular keys, a hidratação de metadados será feita na consolidação final
                            newlyMapped.PopulateKeys();

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
                                            if (tk.Financials.Price is > 0) continue;
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
                                        _logger.LogDebug("Applied {Applied} prices (initial mapping) jobId={JobId} chain={Chain} account={Account}", applied, jobId, chainEnum, account);
                                }
                            }
                            catch (Exception pxEx)
                            {
                                _logger.LogWarning(pxEx, "Price hydration failed (initial) jobId={JobId} chain={Chain} account={Account}", jobId, chainEnum, account);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Mapping payload failed JobId={JobId} Provider={Provider} Chain={Chain} Account={Account}", 
                            jobId, result.Provider, chainEnum, account);
                    }
                    foreach (var item in newlyMapped)
                    {
                        consolidated.Items.Add(item);
                    }
                    consolidated.Providers.Add(providerChainKey);
                }

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
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed consolidating wallet jobId={JobId} account={Account}", jobId, account);
        }

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
                    
                    case IntegrationProvider.SolanaRaydiumPositions:
                        if (payloadEl.ValueKind == JsonValueKind.Array)
                        {
                            summary.TotalRaydiumPositions += payloadEl.GetArrayLength();
                        }
                        break;


                    case IntegrationProvider.SolanaKaminoPositions:

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

        _logger.LogDebug("Job {JobId} progress: expected={Expected} remaining={Remaining} success={Succeeded} failed={Failed} timedOut={TimedOut}", jobId, expectedTotal, remaining, succeeded, failed, timedOut);

        // DYNAMIC JOB EXPANSION: Check if this result should trigger additional protocol queries
        await EvaluateAndTriggerDependentJobsAsync(result, chainEnum, account);

        var finalEmittedVal = await db.HashGetAsync(metaKey, "final_emitted");
        var finalAlready = finalEmittedVal.HasValue && finalEmittedVal == "1";

        if (finalAlready)
        {
            var currentStatusVal = await db.HashGetAsync(metaKey, "status");
            if (currentStatusVal.HasValue && (currentStatusVal == AggregationStatus.TimedOut.ToString() || currentStatusVal == AggregationStatus.CompletedWithErrors.ToString()))
            {
                if (succeeded == expectedTotal && failed == 0)
                {
                    // Status is being upgraded to Completed - clear pending list to maintain consistency
                    await db.KeyDeleteAsync(pendingKey);
                    await db.HashSetAsync(metaKey, new HashEntry[] { new("status", AggregationStatus.Completed.ToString()) });
                    _logger.LogDebug("Upgraded status to Completed after late successes jobId={JobId}, cleared pending list", jobId);
                }
            }
        }

        bool shouldConsolidate = (remaining == 0 && !finalAlready) || 
                                 (succeeded == expectedTotal && failed == 0 && finalAlready);
        
        if (shouldConsolidate)
        {

            var consolidationDoneKey = $"wallet:agg:{jobId}:consolidation_done";
            var alreadyConsolidated = await db.StringGetAsync(consolidationDoneKey);
            
            if (!alreadyConsolidated.HasValue)
            {
                await db.StringSetAsync(consolidationDoneKey, "1", ttl);
                
                _logger.LogDebug("Starting final consolidation for job {JobId} (remaining={Remaining} finalAlready={FinalAlready})", 
                    jobId, remaining, finalAlready);
                
                try
                {

                    if (isMultiWallet)
                    {

                        var accountsStr = await db.HashGetAsync(metaKey, "accounts");
                        if (accountsStr.HasValue)
                        {
                            var accountsList = accountsStr.ToString().Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
                            var consolidatedWallet = new ConsolidatedWallet();
                            
                            _logger.LogDebug("Multi-wallet job {JobId} final consolidation: {Count} wallets", jobId, accountsList.Count);

                            foreach (var acc in accountsList)
                            {
                                var walletConsolidatedKey = $"wallet:agg:{jobId}:wallet:{acc.ToLowerInvariant()}";
                                var walletJson = await db.StringGetAsync(walletConsolidatedKey);
                                if (walletJson.HasValue)
                                {
                                    try
                                    {
                                        var walletData = JsonSerializer.Deserialize<ConsolidatedWallet>(walletJson!, _jsonOptions);
                                        if (walletData != null)
                                        {
                                            consolidatedWallet.Items.AddRange(walletData.Items);
                                            foreach (var p in walletData.Providers)
                                            {
                                                consolidatedWallet.Providers.Add(p);
                                            }
                                            _logger.LogDebug("Multi-wallet merge: {Account} contributed {Count} items", acc, walletData.Items.Count);
                                        }
                                    }
                                    catch (Exception mergeEx)
                                    {
                                        _logger.LogWarning(mergeEx, "Failed merging wallet {Account} for job {JobId}", acc, jobId);
                                    }
                                }
                                else
                                {
                                    _logger.LogWarning("No consolidated data found for wallet {Account} in job {JobId}", acc, jobId);
                                }
                            }

                            if (consolidatedWallet.Items.Count > 0)
                            {
                                // PASSO 1: HIDRATAÇÃO DE METADADOS - DEVE VIR ANTES DOS PREÇOS
                                // Preenche name, symbol, logo usando cross-chain sharing
                                try
                                {
                                    using var metadataScope = _rootProvider.CreateScope();
                                    var metadataService = metadataScope.ServiceProvider.GetRequiredService<ITokenMetadataService>();
                                    var hydrationLogger = metadataScope.ServiceProvider.GetRequiredService<ILogger<TokenHydrationHelper>>();
                                    var hydrationHelper = new TokenHydrationHelper(metadataService, hydrationLogger);
                                    
                                    _logger.LogDebug("[FINAL HYDRATION] Starting metadata hydration for {Count} items, jobId={JobId}", 
                                        consolidatedWallet.Items.Count, jobId);
                                    
                                    var logos = await hydrationHelper.HydrateTokenLogosAsync(consolidatedWallet.Items, ChainEnum.Base);
                                    await hydrationHelper.ApplyTokenLogosToWalletItemsAsync(consolidatedWallet.Items, logos);
                                    
                                    _logger.LogDebug("[FINAL HYDRATION] Completed metadata hydration for {TotalItems} items, jobId={JobId}", 
                                        consolidatedWallet.Items.Count, jobId);
                                }
                                catch (Exception metadataEx)
                                {
                                    _logger.LogError(metadataEx, "[FINAL HYDRATION] Failed metadata hydration jobId={JobId}", jobId);
                                }

                                // PASSO 2: HIDRATAÇÃO DE PREÇOS - DEPENDE DO SYMBOL ESTAR PREENCHIDO
                                try
                                {
                                    using var scope = _rootProvider.CreateScope();
                                    var priceService = scope.ServiceProvider.GetRequiredService<IPriceService>();
                                    var tokensByChain = consolidatedWallet.Items
                                        .SelectMany(w => w.Position?.Tokens ?? Enumerable.Empty<Token>())
                                        .GroupBy(t => (t.Chain ?? string.Empty).ToLowerInvariant());
                                    int filled = 0;
                                    foreach (var g in tokensByChain)
                                    {
                                        if (string.IsNullOrEmpty(g.Key)) continue;
                                        if (!Enum.TryParse<ChainEnum>(g.Key, true, out var parsedChain)) parsedChain = ChainEnum.Base;
                                        var subsetItems = consolidatedWallet.Items.Where(w => (w.Position?.Tokens?.Any(tk => (tk.Chain ?? "").Equals(g.Key, StringComparison.OrdinalIgnoreCase)) ?? false)).ToList();
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
                                        _logger.LogDebug("Multi-wallet final price hydration applied {Filled} prices jobId={JobId}", filled, jobId);
                                    }
                                }
                                catch (Exception finalPxEx)
                                {
                                    _logger.LogWarning(finalPxEx, "Multi-wallet final price hydration failed jobId={JobId}", jobId);
                                }
                            }

                            // Mark as completed BEFORE writing wallet to prevent race condition
                            if (!finalAlready)
                            {
                                AggregationStatus aggStatus;
                                if (succeeded == expectedTotal && failed == 0) aggStatus = AggregationStatus.Completed;
                                else if (timedOut > 0 && succeeded == 0 && failed == 0) aggStatus = AggregationStatus.TimedOut;
                                else if (failed == 0 && timedOut == 0) aggStatus = AggregationStatus.Completed;
                                else if (timedOut > 0) aggStatus = AggregationStatus.TimedOut;
                                else aggStatus = AggregationStatus.CompletedWithErrors;

                                var tran2 = db.CreateTransaction();
                                tran2.HashSetAsync(metaKey, new HashEntry[] { new("status", aggStatus.ToString()), new("final_emitted", 1) });
                                await tran2.ExecuteAsync();
                                _logger.LogDebug("Job {JobId} marked as {Status}, final_emitted=1 BEFORE writing wallet", jobId, aggStatus);
                            }

                            await db.StringSetAsync(consolidatedKey, JsonSerializer.Serialize(consolidatedWallet, _jsonOptions), ttl);
                            _logger.LogDebug("Multi-wallet job {JobId} final consolidation complete: {Total} items", jobId, consolidatedWallet.Items.Count);
                        }
                        else
                        {
                            _logger.LogWarning("Multi-wallet job {JobId} has no accounts field in meta", jobId);
                        }
                    }
                    else
                    {
                        // SINGLE WALLET - precisa de hidratação de metadados também!
                        var consolidatedJson = await db.StringGetAsync(consolidatedKey);
                        if (consolidatedJson.HasValue)
                        {
                            var wallet = JsonSerializer.Deserialize<ConsolidatedWallet>(consolidatedJson!, _jsonOptions) ?? new ConsolidatedWallet();
                            if (wallet.Items.Count > 0)
                            {
                                // PASSO 1: HIDRATAÇÃO DE METADADOS (logos, symbols, names)
                                try
                                {
                                    using var metadataScope = _rootProvider.CreateScope();
                                    var metadataService = metadataScope.ServiceProvider.GetRequiredService<ITokenMetadataService>();
                                    var hydrationLogger = metadataScope.ServiceProvider.GetRequiredService<ILogger<TokenHydrationHelper>>();
                                    var hydrationHelper = new TokenHydrationHelper(metadataService, hydrationLogger);
                                    
                                    _logger.LogDebug("[FINAL HYDRATION] Starting metadata hydration for {Count} items (single wallet), jobId={JobId}", 
                                        wallet.Items.Count, jobId);
                                    
                                    // Hidratar logos para todas as chains presentes no wallet (não só Base)
                                    var allChains = wallet.Items
                                        .SelectMany(w => w.Position?.Tokens ?? Enumerable.Empty<Token>())
                                        .Select(t => t.Chain ?? "Base")
                                        .Distinct(StringComparer.OrdinalIgnoreCase)
                                        .Select(c => Enum.TryParse<ChainEnum>(c, true, out var ch) ? ch : ChainEnum.Base)
                                        .Distinct()
                                        .ToList();
                                    
                                    foreach (var chain in allChains)
                                    {
                                        var chainItems = wallet.Items
                                            .Where(w => w.Position?.Tokens?.Any(tk => (tk.Chain ?? "Base").Equals(chain.ToString(), StringComparison.OrdinalIgnoreCase)) ?? false)
                                            .ToList();
                                        
                                        if (chainItems.Count > 0)
                                        {
                                            var logos = await hydrationHelper.HydrateTokenLogosAsync(chainItems, chain);
                                            await hydrationHelper.ApplyTokenLogosToWalletItemsAsync(chainItems, logos);
                                        }
                                    }
                                    
                                    _logger.LogDebug("[FINAL HYDRATION] Completed metadata hydration for {TotalItems} items (single wallet), jobId={JobId}", 
                                        wallet.Items.Count, jobId);
                                }
                                catch (Exception metadataEx)
                                {
                                    _logger.LogError(metadataEx, "[FINAL HYDRATION] Failed metadata hydration (single wallet) jobId={JobId}", jobId);
                                }
                                
                                // PASSO 2: HIDRATAÇÃO DE PREÇOS
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
                                        _logger.LogDebug("Final price hydration applied {Filled} prices (single wallet) jobId={JobId}", filled, jobId);
                                    }
                                }
                                catch (Exception finalPxEx)
                                {
                                    _logger.LogWarning(finalPxEx, "Final price hydration failed (single wallet) jobId={JobId}", jobId);
                                }
                                
                                // Mark as completed BEFORE writing wallet to prevent race condition
                                if (!finalAlready)
                                {
                                    AggregationStatus aggStatus;
                                    if (succeeded == expectedTotal && failed == 0) aggStatus = AggregationStatus.Completed;
                                    else if (timedOut > 0 && succeeded == 0 && failed == 0) aggStatus = AggregationStatus.TimedOut;
                                    else if (failed == 0 && timedOut == 0) aggStatus = AggregationStatus.Completed;
                                    else if (timedOut > 0) aggStatus = AggregationStatus.TimedOut;
                                    else aggStatus = AggregationStatus.CompletedWithErrors;

                                    var tran2 = db.CreateTransaction();
                                    tran2.HashSetAsync(metaKey, new HashEntry[] { new("status", aggStatus.ToString()), new("final_emitted", 1) });
                                    await tran2.ExecuteAsync();
                                    _logger.LogDebug("Job {JobId} marked as {Status}, final_emitted=1 BEFORE writing wallet", jobId, aggStatus);
                                }
                                
                                // Salvar wallet consolidado atualizado
                                await db.StringSetAsync(consolidatedKey, JsonSerializer.Serialize(wallet, _jsonOptions), ttl);
                            }
                        }
                    }

                    _logger.LogDebug("Consolidation data written to Redis for job {JobId}", jobId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "CONSOLIDATION_FINAL: failed jobId={JobId}", jobId);
                }

                if (!finalAlready)
                {
                    // Status already updated before wallet write (above), now publish events
                    AggregationStatus aggStatus;
                    if (succeeded == expectedTotal && failed == 0) aggStatus = AggregationStatus.Completed;
                    else if (timedOut > 0 && succeeded == 0 && failed == 0) aggStatus = AggregationStatus.TimedOut;
                    else if (failed == 0 && timedOut == 0) aggStatus = AggregationStatus.Completed;
                    else if (timedOut > 0) aggStatus = AggregationStatus.TimedOut;
                    else aggStatus = AggregationStatus.CompletedWithErrors;

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
            else
            {
                _logger.LogDebug("Skipping consolidation for job {JobId} - already done", jobId);
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
                    var positions = JsonSerializer.Deserialize<IEnumerable<RaydiumPosition>>(raydiumEl.GetRawText());
                    if (positions != null)
                    {
                        list.AddRange(await factory.CreateSolanaRaydiumMapper().MapAsync(positions, chain));
                    }
                }
                break;
        }
        return list;
    }

    private async Task EvaluateAndTriggerDependentJobsAsync(
        IntegrationResult result,
        ChainEnum chain,
        string account)
    {
        // Only evaluate successful results from trigger-capable providers
        if (result.Status != IntegrationStatus.Success || result.Payload == null)
        {
            return;
        }

        // Check if this provider can trigger others
        var detector = _triggerDetectors.FirstOrDefault(d => d.HandlesProvider == result.Provider);
        
        if (detector == null)
        {
            // Not a trigger provider, skip evaluation
            return;
        }

        _logger.LogDebug(
            "TriggerEvaluation: Evaluating {Provider} result for job {JobId} chain {Chain}",
            result.Provider, result.JobId, chain);

        try
        {
            // Detect which protocols should be triggered based on the payload
            var triggers = detector.DetectTriggersFromPayload(result.Payload, chain);

            if (triggers.Count == 0)
            {
                _logger.LogDebug(
                    "TriggerEvaluation: No triggers detected from {Provider} for job {JobId} chain {Chain}",
                    result.Provider, result.JobId, chain);
                return;
            }

            _logger.LogDebug(
                "TriggerEvaluation: Detected {Count} triggers from {Provider} for job {JobId}: {Triggers}",
                triggers.Count, result.Provider, result.JobId,
                string.Join(", ", triggers.Select(t => $"{t.Provider}:{t.Chain}")));

            // Expand the job with the detected triggers
            var addedCount = await _jobExpansionService.ExpandJobAsync(
                result.JobId,
                account,
                triggers,
                result.Provider,
                CancellationToken.None);

            if (addedCount > 0)
            {
                _logger.LogDebug(
                    "TriggerEvaluation: Successfully expanded job {JobId} with {Count} new providers triggered by {Provider}",
                    result.JobId, addedCount, result.Provider);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "TriggerEvaluation: Error evaluating triggers for {Provider} job {JobId} chain {Chain}",
                result.Provider, result.JobId, chain);
        }
    }

    private static string BuildPriceKey(Token t)
    {
        if (t == null) return string.Empty;
        var sym = t.Symbol; if (string.IsNullOrWhiteSpace(sym)) return string.Empty;
        var chain = t.Chain ?? string.Empty;
        return (sym + "|" + chain).ToLowerInvariant();
    }
}