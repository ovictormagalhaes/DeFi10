using StackExchange.Redis;
using DeFi10.API.Infrastructure;
using DeFi10.API.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using DeFi10.API.Aggregation;
using DeFi10.API.Messaging.Contracts.Enums;
using DeFi10.API.Messaging.Contracts.Requests;
using DeFi10.API.Messaging.Contracts.Results;
using DeFi10.API.Messaging.Contracts.Progress;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Aggregation;

public interface IAggregationJobStore
{
    Task<Guid> CreateOrReuseSingleAsync(string accountLower, ChainEnum chain, IEnumerable<IntegrationProvider> providers, TimeSpan ttl, Guid? walletGroupId = null, CancellationToken ct = default);
    Task<Guid> CreateOrReuseMultiAsync(string accountLower, IReadOnlyList<ChainEnum> chains, IEnumerable<(IntegrationProvider provider, ChainEnum chain)> combos, TimeSpan ttl, Guid? walletGroupId = null, CancellationToken ct = default);
    Task RecordPublicationAsync(Guid jobId, string accountLower, IEnumerable<ChainEnum> chains, IEnumerable<(IntegrationProvider provider, ChainEnum chain)> combos, TimeSpan ttl, Guid? walletGroupId = null, CancellationToken ct = default);
    Task<AggregationJobMeta?> GetMetaAsync(Guid jobId, CancellationToken ct = default);
    Task AddResultAsync(Guid jobId, string providerKey, string json, TimeSpan ttl, CancellationToken ct = default);
    IAsyncEnumerable<Guid> ListRecentJobsAsync(string accountLower, int limit, CancellationToken ct = default);
}

public sealed class AggregationJobStore : IAggregationJobStore
{
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<AggregationJobStore> _logger;
    private readonly ISystemClock _clock;

    public AggregationJobStore(IConnectionMultiplexer redis, ILogger<AggregationJobStore> logger, ISystemClock clock)
    {
        _redis = redis; _logger = logger; _clock = clock;
    }

    public async Task<Guid> CreateOrReuseSingleAsync(string accountLower, ChainEnum chain, IEnumerable<IntegrationProvider> providers, TimeSpan ttl, Guid? walletGroupId = null, CancellationToken ct = default)
    {
        var db = _redis.GetDatabase();
        var activeKey = RedisKeys.ActiveJob(new List<string> { accountLower }, new List<ChainEnum> { chain });
        var existing = await db.StringGetAsync(activeKey);
        if (existing.HasValue && Guid.TryParse(existing.ToString(), out var jobId) && await db.KeyExistsAsync(RedisKeys.Meta(jobId)))
        {
            _logger.LogDebug("Reuse single job {Job} chain={Chain}", jobId, chain);
            return jobId;
        }
        var newJob = Guid.NewGuid();
        await InitializeMetaAsync(newJob, accountLower, new []{ chain }, providers.Select(p => (p, chain)), ttl, db, walletGroupId);
        await db.StringSetAsync(activeKey, newJob.ToString(), ttl);
        await IndexJobAsync(accountLower, newJob, ttl, db);
        _logger.LogInformation("Created new single aggregation job {Job} chain={Chain}", newJob, chain);
        return newJob;
    }

    public async Task<Guid> CreateOrReuseMultiAsync(string accountLower, IReadOnlyList<ChainEnum> chains, IEnumerable<(IntegrationProvider provider, ChainEnum chain)> combos, TimeSpan ttl, Guid? walletGroupId = null, CancellationToken ct = default)
    {
        var db = _redis.GetDatabase();
        var activeKey = RedisKeys.ActiveJob(new List<string> { accountLower }, chains.ToList());
        var existing = await db.StringGetAsync(activeKey);
        if (existing.HasValue && Guid.TryParse(existing.ToString(), out var jobId) && await db.KeyExistsAsync(RedisKeys.Meta(jobId)))
        {
            _logger.LogDebug("Reuse multi job {Job} chains={Chains}", jobId, string.Join(',', chains));
            return jobId;
        }
        var newJob = Guid.NewGuid();
        await InitializeMetaAsync(newJob, accountLower, chains, combos, ttl, db, walletGroupId);
        await db.StringSetAsync(activeKey, newJob.ToString(), ttl);
        await IndexJobAsync(accountLower, newJob, ttl, db);
        _logger.LogInformation("Created new multi aggregation job {Job} chains={Chains}", newJob, string.Join(',', chains));
        return newJob;
    }

    public async Task RecordPublicationAsync(Guid jobId, string accountLower, IEnumerable<ChainEnum> chains, IEnumerable<(IntegrationProvider provider, ChainEnum chain)> combos, TimeSpan ttl, Guid? walletGroupId = null, CancellationToken ct = default)
    {

        var db = _redis.GetDatabase();
        await InitializeMetaAsync(jobId, accountLower, chains.ToList(), combos, ttl, db, walletGroupId, onlyIfMissing: true);
    }

    public async Task<AggregationJobMeta?> GetMetaAsync(Guid jobId, CancellationToken ct = default)
    {
        var db = _redis.GetDatabase();
        var metaKey = RedisKeys.Meta(jobId);
        if (!await db.KeyExistsAsync(metaKey)) return null;
        var entries = await db.HashGetAllAsync(metaKey);
        var d = entries.ToDictionary(e => e.Name.ToString(), e => e.Value.ToString());
        return new AggregationJobMeta(
            jobId,
            d.TryGetValue("account", out var acct) ? acct : string.Empty,
            d.TryGetValue("chains", out var chStr) ? chStr.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(s => Enum.Parse<ChainEnum>(s)).ToList() : new List<ChainEnum>(),
            d.TryGetValue("created_at", out var created) && DateTime.TryParse(created, out var createdAt) ? createdAt : DateTime.MinValue,
            d.TryGetValue("expected_total", out var expStr) && int.TryParse(expStr, out var exp) ? exp : 0,
            d.TryGetValue("status", out var st) && Enum.TryParse<AggregationStatus>(st, out var statusVal) ? statusVal : AggregationStatus.Running,
            d.TryGetValue("succeeded", out var sucStr) && int.TryParse(sucStr, out var suc) ? suc : 0,
            d.TryGetValue("failed", out var failStr) && int.TryParse(failStr, out var fail) ? fail : 0,
            d.TryGetValue("timed_out", out var toStr) && int.TryParse(toStr, out var to) ? to : 0,
            d.TryGetValue("processed_count", out var pcStr) && int.TryParse(pcStr, out var pc) ? pc : 0,
            d.TryGetValue("final_emitted", out var feStr) && feStr == "1"
        );
    }

    public async Task AddResultAsync(Guid jobId, string providerKey, string json, TimeSpan ttl, CancellationToken ct = default)
    {
        var db = _redis.GetDatabase();
        var key = RedisKeys.ResultPrefix(jobId) + providerKey;
        await db.StringSetAsync(key, json, ttl);
    }

    public async IAsyncEnumerable<Guid> ListRecentJobsAsync(string accountLower, int limit, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        var db = _redis.GetDatabase();
        var indexKey = RedisKeys.Index(accountLower);

        var nowScore = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var entries = await db.SortedSetRangeByScoreWithScoresAsync(indexKey, double.NegativeInfinity, nowScore, Exclude.None, Order.Descending, 0, limit);
        foreach (var e in entries)
        {
            if (ct.IsCancellationRequested) yield break;
            if (Guid.TryParse(e.Element.ToString(), out var jobId)) yield return jobId;
        }
    }

    private async Task InitializeMetaAsync(Guid jobId, string accountLower, IReadOnlyList<ChainEnum> chains, IEnumerable<(IntegrationProvider provider, ChainEnum chain)> combos, TimeSpan ttl, IDatabase db, Guid? walletGroupId = null, bool onlyIfMissing = false)
    {
        var metaKey = RedisKeys.Meta(jobId);
        if (onlyIfMissing && await db.KeyExistsAsync(metaKey)) return;
        var now = _clock.UtcNow;
        var comboList = combos.ToList();
        var providersCount = comboList.Count;
        var hashEntries = new List<HashEntry>
        {
            new("account", accountLower),
            new(RedisKeys.MetaFields.Chains, string.Join(',', chains)),
            new(RedisKeys.MetaFields.CreatedAt, now.ToString("o")),
            new(RedisKeys.MetaFields.ExpectedTotal, providersCount),
            new(RedisKeys.MetaFields.Status, AggregationStatus.Running.ToString()),
            new(RedisKeys.MetaFields.Succeeded, 0),
            new(RedisKeys.MetaFields.Failed, 0),
            new(RedisKeys.MetaFields.TimedOut, 0),
            new(RedisKeys.MetaFields.FinalEmitted, 0),
            new(RedisKeys.MetaFields.ProcessedCount, 0)
        };
        if (walletGroupId.HasValue)
        {
            hashEntries.Add(new(RedisKeys.MetaFields.WalletGroupId, walletGroupId.Value.ToString()));
        }
        await db.HashSetAsync(metaKey, hashEntries.ToArray());
        var pendingKey = RedisKeys.Pending(jobId);
        foreach (var c in comboList)
            await db.SetAddAsync(pendingKey, RedisKeys.PendingEntry(c.provider.ToString(), c.chain.ToString(), accountLower));
        await db.KeyExpireAsync(metaKey, ttl);
        await db.KeyExpireAsync(pendingKey, ttl);
    }

    private async Task IndexJobAsync(string accountLower, Guid jobId, TimeSpan ttl, IDatabase db)
    {
        var indexKey = RedisKeys.Index(accountLower);
        var score = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        await db.SortedSetAddAsync(indexKey, jobId.ToString(), score);
        await db.KeyExpireAsync(indexKey, ttl);
    }
}
