using MyWebWallet.API.Aggregation;
using MyWebWallet.API.Messaging.Contracts.Enums;
using MyWebWallet.API.Messaging.Contracts.Requests;
using MyWebWallet.API.Messaging.Rabbit;
using MyWebWallet.API.Models;
using StackExchange.Redis;
using System.Text.Json;

namespace MyWebWallet.API.Messaging.Workers;

/// <summary>
/// Service responsible for dynamically expanding aggregation jobs by adding new provider requests
/// </summary>
public class JobExpansionService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<JobExpansionService> _logger;
    private readonly IMessagePublisher _publisher;
    private static readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    public JobExpansionService(
        IConnectionMultiplexer redis,
        ILogger<JobExpansionService> logger,
        IMessagePublisher publisher)
    {
        _redis = redis;
        _logger = logger;
        _publisher = publisher;
    }

    /// <summary>
    /// Atomically expands a job by adding new provider requests
    /// </summary>
    /// <param name="jobId">The aggregation job ID</param>
    /// <param name="account">The wallet address</param>
    /// <param name="newProviders">List of (Provider, Chain) tuples to add</param>
    /// <param name="triggeredBy">The provider that triggered this expansion</param>
    /// <param name="ct">Cancellation token</param>
    /// <returns>Number of new providers successfully added</returns>
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

        _logger.LogInformation("JobExpansion: Adding {NewCount}/{RequestedCount} new providers to job {JobId}",
            providersToAdd.Count, newProviders.Count, jobId);

        // Atomic transaction: increment expected_total and add to pending set
        var tran = db.CreateTransaction();
        tran.AddCondition(Condition.KeyExists(metaKey)); // Ensure job still exists

        tran.HashIncrementAsync(metaKey, "expected_total", providersToAdd.Count);
        
        foreach (var (provider, chain) in providersToAdd)
        {
            var providerChainKey = $"{ProviderSlug(provider)}:{chain.ToString().ToLowerInvariant()}";
            tran.SetAddAsync(pendingKey, providerChainKey);
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
            jobId, providersToAdd.Count);

        // Publish new integration requests
        var publishedCount = 0;
        
        foreach (var (provider, chain) in providersToAdd)
        {
            try
            {
                var request = new IntegrationRequest(
                    JobId: jobId,
                    RequestId: Guid.NewGuid(),
                    Account: account,
                    Chains: new List<string> { chain.ToString() },
                    Provider: provider,
                    RequestedAtUtc: DateTime.UtcNow,
                    Attempt: 1
                );

                var routingKey = $"integration.request.{ProviderSlug(provider)}";
                await _publisher.PublishAsync(routingKey, request, ct);

                publishedCount++;

                _logger.LogDebug("JobExpansion: Published {Provider}:{Chain} for job {JobId}",
                    provider, chain, jobId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "JobExpansion: Failed to publish {Provider}:{Chain} for job {JobId}",
                    provider, chain, jobId);
            }
        }

        _logger.LogInformation(
            "JobExpansion: Completed expansion for job {JobId} - published {Published}/{Total} requests (triggered by {Trigger})",
            jobId, publishedCount, providersToAdd.Count, triggeredBy);

        return publishedCount;
    }

    private static string ProviderSlug(IntegrationProvider p) => p.ToString().ToLowerInvariant();
}
