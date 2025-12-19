using DeFi10.API.Aggregation;
using DeFi10.API.Messaging.Contracts.Enums;
using DeFi10.API.Messaging.Contracts.Requests;
using DeFi10.API.Messaging.Rabbit;
using DeFi10.API.Messaging.Constants;
using DeFi10.API.Models;
using StackExchange.Redis;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace DeFi10.API.Messaging.Workers;

public class JobExpansionService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<JobExpansionService> _logger;
    private readonly IMessagePublisher _publisher;
    private static readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };
    
    private static readonly Regex EthAddressRegex = new("^0x[a-fA-F0-9]{40}$", RegexOptions.Compiled);
    private static readonly Regex SolAddressRegex = new("^[1-9A-HJ-NP-Za-km-z]{32,44}$", RegexOptions.Compiled);

    public JobExpansionService(
        IConnectionMultiplexer redis,
        ILogger<JobExpansionService> logger,
        IMessagePublisher publisher)
    {
        _redis = redis;
        _logger = logger;
        _publisher = publisher;
    }

    public async Task<int> ExpandJobAsync(
        Guid jobId,
        string account,
        List<(IntegrationProvider Provider, Chain Chain)> newProviders,
        IntegrationProvider triggeredBy,
        CancellationToken ct = default)
    {
        if (newProviders.Count == 0)
        {
            _logger.LogDebug("JobExpansion: No new providers to add for job {JobId}", jobId);
            return 0;
        }

        var db = _redis.GetDatabase();
        var metaKey = RedisKeys.Meta(jobId);
        var pendingKey = RedisKeys.Pending(jobId);

        // Check if job still exists
        if (!await db.KeyExistsAsync(metaKey))
        {
            _logger.LogWarning("JobExpansion: Job {JobId} metadata not found, cannot expand", jobId);
            return 0;
        }

        var ttl = await db.KeyTimeToLiveAsync(metaKey);
        if (!ttl.HasValue || ttl.Value.TotalSeconds < 30)
        {
            _logger.LogWarning("JobExpansion: Job {JobId} TTL too short ({TTL}s), skipping expansion", 
                jobId, ttl?.TotalSeconds ?? 0);
            return 0;
        }

        _logger.LogInformation(
            "JobExpansion: Starting expansion for job {JobId} - adding {Count} providers triggered by {Trigger}",
            jobId, newProviders.Count, triggeredBy);

        // Deduplicate: check which providers are already pending or completed
        var existingPending = await db.SetMembersAsync(pendingKey);
        var existingPendingSet = new HashSet<string>(existingPending.Select(rv => rv.ToString()));

        var providersToAdd = new List<(IntegrationProvider Provider, Chain Chain)>();
        
        foreach (var (provider, chain) in newProviders)
        {
            var providerChainKey = $"{ProviderSlug(provider)}:{chain.ToString().ToLowerInvariant()}";
            
            if (existingPendingSet.Contains(providerChainKey))
            {
                _logger.LogDebug("JobExpansion: Skipping {Provider}:{Chain} - already pending", provider, chain);
                continue;
            }

            providersToAdd.Add((provider, chain));
        }

        if (providersToAdd.Count == 0)
        {
            _logger.LogInformation("JobExpansion: All {Count} providers already queued for job {JobId}", 
                newProviders.Count, jobId);
            return 0;
        }

        // Check if this is a multi-wallet job
        var accountsField = await db.HashGetAsync(metaKey, RedisKeys.MetaFields.Accounts);
        bool isMultiWallet = accountsField.HasValue && accountsField.ToString().Contains(',');
        var accounts = isMultiWallet 
            ? RedisKeys.DeserializeAccounts(accountsField.ToString())
            : new List<string> { account };

        // Filter account-chain combinations by compatibility
        var validCombos = new List<(IntegrationProvider Provider, Chain Chain, string Account)>();
        foreach (var (provider, chain) in providersToAdd)
        {
            foreach (var acc in accounts)
            {
                if (IsValidAddressForChain(acc, chain))
                {
                    validCombos.Add((provider, chain, acc));
                }
                else
                {
                    _logger.LogDebug("JobExpansion: Skipping {Provider}:{Chain} for account {Account} (incompatible address type)",
                        provider, chain, acc);
                }
            }
        }
        
        if (validCombos.Count == 0)
        {
            _logger.LogWarning("JobExpansion: No valid account-chain combinations for job {JobId} - all accounts incompatible with requested chains",
                jobId);
            return 0;
        }
        
        _logger.LogInformation("JobExpansion: Adding {ValidCount}/{TotalCount} valid combinations to job {JobId}",
            validCombos.Count, providersToAdd.Count * accounts.Count, jobId);

        // Atomic transaction: increment expected_total and add to pending set
        var tran = db.CreateTransaction();
        tran.AddCondition(Condition.KeyExists(metaKey)); // Ensure job still exists

        tran.HashIncrementAsync(metaKey, RedisKeys.MetaFields.ExpectedTotal, validCombos.Count);
        
        foreach (var (provider, chain, acc) in validCombos)
        {
            var pendingEntry = RedisKeys.DurationEntry(ProviderSlug(provider), chain.ToString(), isMultiWallet ? acc : null);
            tran.SetAddAsync(pendingKey, pendingEntry);
        }

        // Track expansion history for debugging
        var expansionKey = $"triggered_by:{ProviderSlug(triggeredBy)}";
        tran.HashIncrementAsync(metaKey, expansionKey, providersToAdd.Count);

        var committed = await tran.ExecuteAsync();

        if (!committed)
        {
            _logger.LogWarning("JobExpansion: Transaction failed for job {JobId} - job may have been deleted", jobId);
            return 0;
        }

        _logger.LogInformation("JobExpansion: Successfully updated metadata for job {JobId} - expanded by {Count}",
            jobId, validCombos.Count);

        // Publish new integration requests for valid combinations
        var publishedCount = 0;
        
        foreach (var (provider, chain, acc) in validCombos)
        {
            try
            {
                var request = new IntegrationRequest(
                    JobId: jobId,
                    RequestId: Guid.NewGuid(),
                    Account: acc,
                    Chains: new List<string> { chain.ToString() },
                    Provider: provider,
                    RequestedAtUtc: DateTime.UtcNow,
                    Attempt: 1
                );

                var routingKey = RoutingKeys.ForIntegrationRequest(provider);
                await _publisher.PublishAsync(routingKey, request, ct);

                publishedCount++;

                _logger.LogDebug("JobExpansion: Published {Provider}:{Chain}:{Account} for job {JobId}",
                    provider, chain, acc, jobId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "JobExpansion: Failed to publish {Provider}:{Chain}:{Account} for job {JobId}",
                    provider, chain, acc, jobId);
            }
        }

        _logger.LogInformation(
            "JobExpansion: Completed expansion for job {JobId} - published {Published}/{Total} requests (triggered by {Trigger})",
            jobId, publishedCount, validCombos.Count, triggeredBy);

        return publishedCount;
    }

    private static bool IsValidAddressForChain(string address, Chain chain)
    {
        return chain switch
        {
            Chain.Solana => SolAddressRegex.IsMatch(address),
            Chain.Base or Chain.Ethereum or Chain.Arbitrum or Chain.Optimism or Chain.BNB or Chain.Polygon => EthAddressRegex.IsMatch(address),
            _ => false
        };
    }

    private static string ProviderSlug(IntegrationProvider p) => p.ToString().ToLowerInvariant();
}
