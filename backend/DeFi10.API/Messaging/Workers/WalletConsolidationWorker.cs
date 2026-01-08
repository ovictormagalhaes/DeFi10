using Microsoft.Extensions.Options;
using DeFi10.API.Messaging.Contracts.Enums;
using DeFi10.API.Messaging.Contracts.Progress;
using DeFi10.API.Messaging.Rabbit;
using RabbitMQ.Client;
using System.Text.Json;
using System.Text.Json.Serialization;
using StackExchange.Redis;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Models;
using DeFi10.API.Services.Helpers;
using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Messaging.Constants;

namespace DeFi10.API.Messaging.Workers;

public class WalletConsolidationWorker : BaseConsumer
{
    private readonly ILogger<WalletConsolidationWorker> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };
    private readonly IConnectionMultiplexer _redis;
    private readonly IMessagePublisher _publisher;
    private readonly IServiceProvider _rootProvider;
    private readonly TimeSpan _walletCacheTtl;

    protected override string QueueName => "wallet.consolidation";

    public WalletConsolidationWorker(
        IRabbitMqConnectionFactory connectionFactory,
        IOptions<RabbitMqOptions> options,
        ILogger<WalletConsolidationWorker> logger,
        IConnectionMultiplexer redis,
        IMessagePublisher publisher,
        IServiceProvider rootProvider,
        IOptions<AggregationOptions> aggOptions)
        : base(connectionFactory, options, logger)
    {
        _logger = logger;
        _redis = redis;
        _publisher = publisher;
        _rootProvider = rootProvider;
        _walletCacheTtl = TimeSpan.FromMinutes(Math.Clamp(aggOptions.Value.WalletCacheTtlMinutes, 1, 60));
        _logger.LogDebug("WalletConsolidationWorker initialized with WalletCacheTTL={TTL}min", _walletCacheTtl.TotalMinutes);
    }

    protected override void DeclareQueues(IModel channel)
    {
        channel.QueueDeclare(QueueName, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(QueueName, exchange: Options.Exchange, routingKey: RoutingKeys.ConsolidationRequested);
    }

    private sealed class ConsolidatedWallet
    {
        public List<WalletItem> Items { get; set; } = new();
        public HashSet<string> Providers { get; set; } = new();
    }

    protected override async Task HandleMessageAsync(string routingKey, ReadOnlyMemory<byte> body, IBasicProperties props, CancellationToken ct)
    {
        _logger.LogInformation("[Consolidation] *** RECEIVED MESSAGE *** routingKey={RoutingKey}, bodySize={Size}", 
            routingKey, body.Length);
        
        var request = JsonSerializer.Deserialize<WalletConsolidationRequested>(body.Span, _jsonOptions);
        if (request is null)
        {
            _logger.LogWarning("[Consolidation] Received null WalletConsolidationRequested payload");
            return;
        }

        var jobId = request.JobId;
        _logger.LogInformation("[Consolidation] Starting consolidation for jobId={JobId}, walletGroupId={WalletGroupId}, accounts={Accounts}", 
            jobId, request.WalletGroupId, request.Accounts.Length);

        try
        {
            await ProcessConsolidationAsync(request, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Consolidation] Failed to consolidate jobId={JobId}", jobId);
            await MarkJobAsFailedAsync(jobId, ct);
        }
    }

    private async Task ProcessConsolidationAsync(WalletConsolidationRequested request, CancellationToken ct)
    {
        var jobId = request.JobId;
        var db = _redis.GetDatabase();
        var metaKey = RedisKeys.Meta(jobId);
        var consolidatedKey = RedisKeys.Wallet(jobId);
        var ttl = _walletCacheTtl;

        _logger.LogInformation("[Consolidation] *** ProcessConsolidationAsync STARTED *** jobId={JobId}", jobId);

        // Check if already processed
        var finalEmitted = await db.HashGetAsync(metaKey, RedisKeys.MetaFields.FinalEmitted);
        if (finalEmitted == "1")
        {
            _logger.LogWarning("[Consolidation] Job {JobId} already finalized (final_emitted=1), skipping", jobId);
            return;
        }

        // Get accounts info
        var accountsVal = await db.HashGetAsync(metaKey, RedisKeys.MetaFields.Accounts);
        var isMultiWallet = accountsVal.HasValue && !string.IsNullOrEmpty(accountsVal.ToString());

        _logger.LogInformation("[Consolidation] Job {JobId} type: {Type}, accountsVal={AccountsVal}", 
            jobId, isMultiWallet ? "multi-wallet" : "single-wallet", accountsVal.HasValue ? accountsVal.ToString() : "NULL");

        if (isMultiWallet)
        {
            await ConsolidateMultiWalletAsync(jobId, accountsVal.ToString(), metaKey, consolidatedKey, ttl, ct);
        }
        else
        {
            await ConsolidateSingleWalletAsync(jobId, metaKey, consolidatedKey, ttl, ct);
        }

        // Mark as completed and publish event
        await FinalizeJobAsync(jobId, metaKey, request, ct);
    }

    private async Task ConsolidateMultiWalletAsync(Guid jobId, string accountsStr, string metaKey, string consolidatedKey, TimeSpan ttl, CancellationToken ct)
    {
        var db = _redis.GetDatabase();
        var accounts = RedisKeys.DeserializeAccounts(accountsStr).ToArray();
        
        _logger.LogDebug("[Consolidation] Processing {Count} accounts for job {JobId}", accounts.Length, jobId);

        var consolidatedWallet = new ConsolidatedWallet();

        // Aggregate all wallet results
        foreach (var account in accounts)
        {
            var walletKey = RedisKeys.WalletForAccount(jobId, account);
            var walletJson = await db.StringGetAsync(walletKey);
            
            if (walletJson.HasValue)
            {
                try
                {
                    var wallet = JsonSerializer.Deserialize<ConsolidatedWallet>(walletJson!, _jsonOptions);
                    if (wallet?.Items != null)
                    {
                        consolidatedWallet.Items.AddRange(wallet.Items);
                        foreach (var provider in wallet.Providers)
                            consolidatedWallet.Providers.Add(provider);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[Consolidation] Failed to deserialize wallet for account {Account}", account);
                }
            }
        }

        _logger.LogDebug("[Consolidation] Aggregated {Count} items from {Accounts} accounts", 
            consolidatedWallet.Items.Count, accounts.Length);

        // HYDRATION: Metadata
        await HydrateMetadataAsync(consolidatedWallet, jobId, ct);

        // HYDRATION: Prices
        await HydratePricesAsync(consolidatedWallet, jobId, ct);

        // Save consolidated wallet
        await db.StringSetAsync(consolidatedKey, JsonSerializer.Serialize(consolidatedWallet, _jsonOptions), ttl);
        
        _logger.LogInformation("[Consolidation] Multi-wallet job {JobId} complete: {Total} items", 
            jobId, consolidatedWallet.Items.Count);
    }

    private async Task ConsolidateSingleWalletAsync(Guid jobId, string metaKey, string consolidatedKey, TimeSpan ttl, CancellationToken ct)
    {
        var db = _redis.GetDatabase();
        var consolidatedJson = await db.StringGetAsync(consolidatedKey);
        
        if (!consolidatedJson.HasValue)
        {
            _logger.LogWarning("[Consolidation] No wallet data found for single-wallet job {JobId}", jobId);
            return;
        }

        var wallet = JsonSerializer.Deserialize<ConsolidatedWallet>(consolidatedJson!, _jsonOptions);
        if (wallet == null || wallet.Items.Count == 0)
        {
            _logger.LogDebug("[Consolidation] Empty wallet for job {JobId}", jobId);
            return;
        }

        _logger.LogDebug("[Consolidation] Processing {Count} items for single-wallet job {JobId}", 
            wallet.Items.Count, jobId);

        // HYDRATION: Metadata
        await HydrateMetadataAsync(wallet, jobId, ct);

        // HYDRATION: Prices
        await HydratePricesAsync(wallet, jobId, ct);

        // Save updated wallet
        await db.StringSetAsync(consolidatedKey, JsonSerializer.Serialize(wallet, _jsonOptions), ttl);
        
        _logger.LogInformation("[Consolidation] Single-wallet job {JobId} complete: {Total} items", 
            jobId, wallet.Items.Count);
    }

    private async Task HydrateMetadataAsync(ConsolidatedWallet wallet, Guid jobId, CancellationToken ct)
    {
        try
        {
            using var scope = _rootProvider.CreateScope();
            var metadataService = scope.ServiceProvider.GetRequiredService<ITokenMetadataService>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<TokenHydrationHelper>>();
            var hydrationHelper = new TokenHydrationHelper(metadataService, logger);

            _logger.LogDebug("[Consolidation] Starting metadata hydration for {Count} items, jobId={JobId}", 
                wallet.Items.Count, jobId);

            // Build metadata dictionaries once from all wallet items
            var metadataDictionaries = hydrationHelper.BuildMetadataDictionaries(wallet.Items);

            // Get all unique chains
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
                    // Use the pre-built dictionaries instead of rebuilding them
                    await hydrationHelper.ApplyTokenLogosToWalletItemsAsync(chainItems, logos, chain, metadataDictionaries);
                }
            }

            _logger.LogInformation("[Consolidation] Completed metadata hydration for {TotalItems} items, jobId={JobId}", 
                wallet.Items.Count, jobId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Consolidation] Failed metadata hydration for jobId={JobId}", jobId);
        }
    }

    private async Task HydratePricesAsync(ConsolidatedWallet wallet, Guid jobId, CancellationToken ct)
    {
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
                if (!Enum.TryParse<ChainEnum>(g.Key, true, out var parsedChain)) 
                    parsedChain = ChainEnum.Base;

                var subsetItems = wallet.Items
                    .Where(w => (w.Position?.Tokens?.Any(tk => (tk.Chain ?? "").Equals(g.Key, StringComparison.OrdinalIgnoreCase)) ?? false))
                    .ToList();

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

                        var key = PriceKeyBuilder.BuildKey(tk);
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

            // Always recalculate projections after price hydration (regardless of filled count)
            var projectionCalculator = scope.ServiceProvider.GetRequiredService<IProjectionCalculator>();
            await RecalculateAllProjectionsAsync(wallet, projectionCalculator, jobId);
            
            if (filled > 0)
            {
                _logger.LogInformation("[Consolidation] Price hydration filled {Filled} prices for jobId={JobId}", filled, jobId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Consolidation] Failed price hydration for jobId={JobId}", jobId);
        }
    }

    private async Task RecalculateAllProjectionsAsync(ConsolidatedWallet wallet, IProjectionCalculator projectionCalculator, Guid jobId)
    {
        int recalculated = 0;
        
        foreach (var item in wallet.Items)
        {
            try
            {
                switch (item.Type)
                {
                    case WalletItemType.LiquidityPool:
                        recalculated += RecalculateLiquidityPoolProjection(item, projectionCalculator);
                        break;
                    
                    case WalletItemType.LendingAndBorrowing:
                        recalculated += RecalculateLendingProjection(item, projectionCalculator);
                        break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Consolidation] Failed to recalculate projection for item type={Type}", item.Type);
            }
        }
        
        if (recalculated > 0)
        {
            _logger.LogInformation("[Consolidation] Recalculated projections for {Count} items in job {JobId}", recalculated, jobId);
        }
        
        await Task.CompletedTask;
    }

    private int RecalculateLiquidityPoolProjection(WalletItem item, IProjectionCalculator projectionCalculator)
    {
        if (item.Position?.Tokens == null || item.AdditionalData == null) 
            return 0;
        
        // Calculate total value from Supplied tokens only (not fees)
        var totalValueUsd = item.Position.Tokens
            .Where(t => t.Type == TokenType.Supplied && t.Financials != null)
            .Sum(t => t.Financials?.TotalPrice ?? 0m);
        
        if (totalValueUsd <= 0) 
            return 0;
        
        var apr = item.AdditionalData.Apr ?? 0m;
        
        item.AdditionalData.TotalValueUsd = totalValueUsd;

        // Rebuild all projections
        var projections = new List<ProjectionData>();

        // 1. APR-based projection
        if (apr > 0)
        {
            var aprProjection = projectionCalculator.CalculateAprProjection(totalValueUsd, apr);
            if (aprProjection != null)
            {
                projections.Add(projectionCalculator.CreateProjectionData(
                    ProjectionType.Apr,
                    aprProjection,
                    new ProjectionMetadata { Apr = apr }
                ));
            }
        }

        // 2. AprHistorical-based projection
        if (item.AdditionalData.CreatedAt.HasValue && item.AdditionalData.CreatedAt.Value > 0 && totalValueUsd > 0)
        {
            var totalFees = item.Position.Tokens
                .Where(t => t.Type == TokenType.LiquidityCollectedFee || 
                            t.Type == TokenType.LiquidityUncollectedFee)
                .Where(t => t.Financials != null)
                .Sum(t => t.Financials?.TotalPrice ?? 0m);

            if (totalFees > 0)
            {
                var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                var (aprHistoricalProjection, aprHistorical) = projectionCalculator.CalculateAprHistoricalProjection(
                    totalFees,
                    totalValueUsd,
                    item.AdditionalData.CreatedAt.Value,
                    now
                );

                if (aprHistoricalProjection != null && aprHistorical.HasValue)
                {
                    // Update the AdditionalData field
                    item.AdditionalData.AprHistorical = aprHistorical.Value;
                    
                    var daysActive = (DateTimeOffset.UtcNow - 
                        DateTimeOffset.FromUnixTimeSeconds(item.AdditionalData.CreatedAt.Value)).TotalDays;

                    projections.Add(projectionCalculator.CreateProjectionData(
                        ProjectionType.AprHistorical,
                        aprHistoricalProjection,
                        new ProjectionMetadata
                        {
                            AprHistorical = aprHistorical.Value,
                            CreatedAt = item.AdditionalData.CreatedAt.Value,
                            TotalFeesGenerated = totalFees,
                            DaysActive = (decimal)daysActive
                        }
                    ));
                }
            }
        }

        // 3. Fees24h-based projection
        if (item.AdditionalData.Fees24h.HasValue && item.AdditionalData.Fees24h.Value > 0)
        {
            var fees24hProjection = projectionCalculator.CalculateFees24hProjection((decimal)item.AdditionalData.Fees24h.Value);
            if (fees24hProjection != null)
            {
                projections.Add(projectionCalculator.CreateProjectionData(
                    ProjectionType.Fees24h,
                    fees24hProjection,
                    new ProjectionMetadata { Fees24h = item.AdditionalData.Fees24h.Value }
                ));
            }
        }

        item.AdditionalData.Projections = projections.Any() ? projections : null;
        
        _logger.LogDebug("[Consolidation] LiquidityPool projection: poolId={PoolId}, totalValue={Total:F2} USD, apr={Apr:F2}%, projections={Count}",
            item.AdditionalData.PoolId, totalValueUsd, apr, projections.Count);
        
        return 1;
    }

    private int RecalculateLendingProjection(WalletItem item, IProjectionCalculator projectionCalculator)
    {
        if (item.Position?.Tokens == null || item.AdditionalData == null) 
            return 0;
        
        // For lending positions, sum all token values
        var totalValueUsd = item.Position.Tokens
            .Where(t => t.Financials != null)
            .Sum(t => t.Financials.TotalPrice);
        
        if (totalValueUsd <= 0) 
            return 0;
        
        var apy = item.AdditionalData.Apy ?? 0m;

        // For lending, we typically only have APY-based projections
        var apyProjection = projectionCalculator.CalculateApyProjection(totalValueUsd, apy);
        
        if (apyProjection != null)
        {
            var projections = new List<ProjectionData>
            {
                projectionCalculator.CreateProjectionData(
                    ProjectionType.Apy,
                    apyProjection,
                    new ProjectionMetadata { Apy = apy }
                )
            };

            item.AdditionalData.Projections = projections;
        }
        
        _logger.LogDebug("[Consolidation] Lending projection: type={Type}, protocol={Protocol}, totalValue={Total:F2} USD, apy={Apy:F2}%",
            item.Type, item.Protocol?.Name, totalValueUsd, apy);
        
        return 1;
    }

    private async Task FinalizeJobAsync(Guid jobId, string metaKey, WalletConsolidationRequested request, CancellationToken ct)
    {
        var db = _redis.GetDatabase();
        
        // Determine final status
        AggregationStatus aggStatus;
        if (request.Succeeded == request.TotalProviders && request.Failed == 0) 
            aggStatus = AggregationStatus.Completed;
        else if (request.TimedOut > 0 && request.Succeeded == 0 && request.Failed == 0) 
            aggStatus = AggregationStatus.TimedOut;
        else if (request.Failed == 0 && request.TimedOut == 0) 
            aggStatus = AggregationStatus.Completed;
        else if (request.TimedOut > 0) 
            aggStatus = AggregationStatus.TimedOut;
        else 
            aggStatus = AggregationStatus.CompletedWithErrors;

        // Mark as completed
        var tran = db.CreateTransaction();
        tran.HashSetAsync(metaKey, new HashEntry[] { 
            new(RedisKeys.MetaFields.Status, aggStatus.ToString()), 
            new(RedisKeys.MetaFields.FinalEmitted, 1) 
        });
        await tran.ExecuteAsync();

        _logger.LogInformation("[Consolidation] Job {JobId} marked as {Status}, final_emitted=1", jobId, aggStatus);

        // Publish completion event
        var accountVal = await db.HashGetAsync(metaKey, RedisKeys.MetaFields.Accounts);
        var completedEvent = new WalletAggregationCompleted(
            jobId, 
            accountVal.HasValue ? accountVal.ToString() : null!, 
            aggStatus, 
            DateTime.UtcNow, 
            request.TotalProviders, 
            request.Succeeded, 
            request.Failed, 
            request.TimedOut
        );
        
        await _publisher.PublishAsync("aggregation.completed", completedEvent, ct);
        
        var doneKey = RedisKeys.Done(jobId);
        await db.StringSetAsync(doneKey, "1", _walletCacheTtl);

        _logger.LogInformation("[Consolidation] Published completion event for jobId={JobId}, status={Status}", jobId, aggStatus);
    }

    private async Task MarkJobAsFailedAsync(Guid jobId, CancellationToken ct)
    {
        try
        {
            var db = _redis.GetDatabase();
            var metaKey = RedisKeys.Meta(jobId);
            
            await db.HashSetAsync(metaKey, new HashEntry[] { 
                new(RedisKeys.MetaFields.Status, AggregationStatus.CompletedWithErrors.ToString()),
                new(RedisKeys.MetaFields.FinalEmitted, 1)
            });
            
            _logger.LogWarning("[Consolidation] Job {JobId} marked as failed", jobId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Consolidation] Failed to mark job as failed: {JobId}", jobId);
        }
    }
}
