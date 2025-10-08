using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Mappers;
using System.Text.RegularExpressions;
using ChainEnum = MyWebWallet.API.Models.Chain;
using MyWebWallet.API.Messaging.Rabbit;
using MyWebWallet.API.Messaging.Contracts;
using StackExchange.Redis;
using Microsoft.Extensions.Logging;
using MyWebWallet.API.Configuration;
using Microsoft.Extensions.Options;
using MyWebWallet.API.Infrastructure;
using MyWebWallet.API.Aggregation; // use centralized RedisKeys

namespace MyWebWallet.API.Services;

public class EthereumService : IBlockchainService
{
    private readonly TimeSpan _aggregationTtl;
    private readonly IMoralisService _moralisService; // kept for DI (direct calls not used here now)
    private readonly IAaveeService _aaveeService;      // kept for DI
    private readonly IUniswapV3OnChainService _uniswapV3OnChainService; // kept for DI
    private readonly IWalletItemMapperFactory _mapperFactory;
    private readonly IMessagePublisher _publisher;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<EthereumService> _logger;
    private readonly ISystemClock _clock;

    private readonly string _instanceId = Guid.NewGuid().ToString("N");
    private const ChainEnum DEFAULT_CHAIN = ChainEnum.Base;
    public string NetworkName => "Ethereum";

    private static readonly Regex AddressRegex = new("^0x[a-fA-F0-9]{40}$", RegexOptions.Compiled);

    public EthereumService(
        IMoralisService moralisService,
        IConfiguration configuration,
        IAaveeService aaveeService,
        IUniswapV3Service _unusedLegacy,
        IUniswapV3OnChainService uniswapV3OnChainService,
        IWalletItemMapperFactory mapperFactory,
        IMessagePublisher publisher,
        IConnectionMultiplexer redis,
        IOptions<AggregationOptions> aggOptions,
        ILogger<EthereumService> logger,
        ISystemClock clock)
    {
        _moralisService = moralisService;
        _aaveeService = aaveeService;
        _uniswapV3OnChainService = uniswapV3OnChainService;
        _mapperFactory = mapperFactory;
        _publisher = publisher;
        _redis = redis;
        _logger = logger;
        _clock = clock;
        var ttlSeconds = Math.Clamp(aggOptions.Value.JobTtlSeconds, 30, 1800);
        _aggregationTtl = TimeSpan.FromSeconds(ttlSeconds);
        _logger.LogInformation("EthereumService instance created id={Id} ttl={Ttl}s", _instanceId, ttlSeconds);
    }

    public bool IsValidAddress(string account) => AddressRegex.IsMatch(account);

    public async Task<WalletResponse> GetWalletTokensAsync(string account) => await GetWalletTokensAsync(account, DEFAULT_CHAIN);

    public async Task<WalletResponse> GetWalletTokensAsync(string account, ChainEnum chain)
    {
        if (!IsValidAddress(account)) throw new ArgumentException("Invalid Ethereum address");
        ValidateChainSupport(chain);
        var jobId = await StartAsyncAggregation(account, chain);
        return new WalletResponse
        {
            Account = account,
            Network = $"{NetworkName} (async job={jobId})",
            Items = new List<WalletItem>(),
            LastUpdated = _clock.UtcNow
        };
    }

    public async Task<Guid> StartAsyncAggregation(string account, ChainEnum chain)
    {
        if (!IsValidAddress(account)) throw new ArgumentException("Invalid Ethereum address");
        ValidateChainSupport(chain);
        var db = _redis.GetDatabase();
        var acct = account.ToLowerInvariant();
        var activeKey = GetActiveJobKey(acct, chain);
        var existing = await db.StringGetAsync(activeKey);
        
        if (existing.HasValue && Guid.TryParse(existing.ToString(), out var existingJobId))
        {
            var metaKeyCheck = RedisKeys.Meta(existingJobId);
            if (await db.KeyExistsAsync(metaKeyCheck))
            {
                _logger.LogDebug("Aggregation reuse single job={Job} chain={Chain}", existingJobId, chain);
                return existingJobId;
            }
        }
        var jobId = Guid.NewGuid();
        await PublishIntegrationRequestsAsync(jobId, acct, chain);
        await db.StringSetAsync(activeKey, jobId.ToString(), _aggregationTtl);
        _logger.LogInformation("Aggregation new single job={Job} chain={Chain}", jobId, chain);
        return jobId;
    }

    public async Task<Guid> StartAsyncAggregation(string account, IEnumerable<ChainEnum> chains)
    {
        var list = chains.Distinct().ToList();
        if (list.Count == 0) throw new ArgumentException("No chains provided");
        if (!IsValidAddress(account)) throw new ArgumentException("Invalid Ethereum address");
        foreach (var c in list) ValidateChainSupport(c);
        var db = _redis.GetDatabase();
        var acct = account.ToLowerInvariant();
        var multiKey = GetMultiActiveJobKey(acct, list);
        var existing = await db.StringGetAsync(multiKey);
        if (existing.HasValue && Guid.TryParse(existing.ToString(), out var existingJobId))
        {
            var metaKeyCheck = RedisKeys.Meta(existingJobId);
            if (await db.KeyExistsAsync(metaKeyCheck))
            {
                _logger.LogDebug("Aggregation reuse multi job={Job} chains={Chains}", existingJobId, string.Join(',', list));
                return existingJobId;
            }
        }
        var newJob = Guid.NewGuid();
        await PublishIntegrationRequestsMultiAsync(newJob, acct, list);
        await db.StringSetAsync(multiKey, newJob.ToString(), _aggregationTtl);
        _logger.LogInformation("Aggregation new multi job={Job} chains={Chains}", newJob, string.Join(',', list));
        return newJob;
    }

    private static string GetActiveJobKey(string accountLower, ChainEnum chain) => RedisKeys.ActiveSingle(accountLower, chain);
    private static string GetMultiActiveJobKey(string accountLower, List<ChainEnum> chains) => RedisKeys.ActiveMulti(accountLower, chains);

    private void ValidateChainSupport(ChainEnum chain)
    {
        var supported = _mapperFactory.GetAllMappers().Any(m => m.SupportsChain(chain));
        if (!supported) throw new NotSupportedException($"Chain {chain} is not supported by any configured protocols");
    }

    private static string ProviderSlug(IntegrationProvider p) => p.ToString().ToLowerInvariant();

    private async Task InitializeAggregationMetaAsync(Guid jobId, string account, ChainEnum chain, IReadOnlyList<IntegrationProvider> providers)
    {
        var db = _redis.GetDatabase();
        var metaKey = RedisKeys.Meta(jobId);
        var pendingKey = RedisKeys.Pending(jobId);
        if (await db.KeyExistsAsync(metaKey)) return;
        var now = _clock.UtcNow;
        var hash = new HashEntry[]
        {
            new("account", account),
            new("chains", chain.ToString()),
            new("created_at", now.ToString("o")),
            new("expected_total", providers.Count),
            new("status", AggregationStatus.Running.ToString()),
            new("succeeded", 0),
            new("failed", 0),
            new("timed_out", 0),
            new("final_emitted", 0),
            new("processed_count", 0)
        };
        await db.HashSetAsync(metaKey, hash);
        foreach (var p in providers) await db.SetAddAsync(pendingKey, $"{ProviderSlug(p)}:{chain.ToString().ToLowerInvariant()}");
        await db.KeyExpireAsync(metaKey, _aggregationTtl);
        await db.KeyExpireAsync(pendingKey, _aggregationTtl);
    }

    private async Task InitializeAggregationMetaMultiAsync(Guid jobId, string account, List<(IntegrationProvider provider, ChainEnum chain)> combos, List<ChainEnum> chains)
    {
        var db = _redis.GetDatabase();
        var metaKey = RedisKeys.Meta(jobId);
        var pendingKey = RedisKeys.Pending(jobId);
        if (await db.KeyExistsAsync(metaKey)) return;
        var now = _clock.UtcNow;
        var hash = new HashEntry[]
        {
            new("account", account),
            new("chains", string.Join(',', chains)),
            new("created_at", now.ToString("o")),
            new("expected_total", combos.Count),
            new("status", AggregationStatus.Running.ToString()),
            new("succeeded", 0),
            new("failed", 0),
            new("timed_out", 0),
            new("final_emitted", 0),
            new("processed_count", 0)
        };
        await db.HashSetAsync(metaKey, hash);
        foreach (var c in combos) await db.SetAddAsync(pendingKey, $"{ProviderSlug(c.provider)}:{c.chain.ToString().ToLowerInvariant()}");
        await db.KeyExpireAsync(metaKey, _aggregationTtl);
        await db.KeyExpireAsync(pendingKey, _aggregationTtl);
    }

    private bool ProviderSupportsChain(IntegrationProvider provider, ChainEnum chain)
    {
        try
        {
            return provider switch
            {
                IntegrationProvider.MoralisTokens => _mapperFactory.CreateMoralisTokenMapper().SupportsChain(chain),
                IntegrationProvider.AaveSupplies => _mapperFactory.CreateAaveSuppliesMapper().SupportsChain(chain),
                IntegrationProvider.AaveBorrows => _mapperFactory.CreateAaveBorrowsMapper().SupportsChain(chain),
                IntegrationProvider.UniswapV3Positions => _mapperFactory.CreateUniswapV3Mapper().SupportsChain(chain),
                _ => false
            };
        }
        catch { return false; }
    }

    private async Task PublishIntegrationRequestsAsync(Guid jobId, string account, ChainEnum chain)
    {
        var candidate = new List<IntegrationProvider>{ IntegrationProvider.MoralisTokens, IntegrationProvider.AaveSupplies, IntegrationProvider.AaveBorrows, IntegrationProvider.UniswapV3Positions };
        var supported = candidate.Where(p => ProviderSupportsChain(p, chain)).ToList();
        if (supported.Count == 0) { _logger.LogInformation("No providers for chain={Chain}", chain); return; }
        await InitializeAggregationMetaAsync(jobId, account, chain, supported);
        var now = _clock.UtcNow;
        var chainList = new List<string>{ chain.ToString() };
        await Task.WhenAll(supported.Select(p => PublishAsync(jobId, account, chainList, p, now)));
    }

    private async Task PublishIntegrationRequestsMultiAsync(Guid jobId, string account, List<ChainEnum> chains)
    {
        var candidate = new List<IntegrationProvider>{ IntegrationProvider.MoralisTokens, IntegrationProvider.AaveSupplies, IntegrationProvider.AaveBorrows, IntegrationProvider.UniswapV3Positions };
        var combos = new List<(IntegrationProvider provider, ChainEnum chain)>();
        foreach (var c in chains)
            foreach (var p in candidate)
                if (ProviderSupportsChain(p, c)) combos.Add((p, c));
        if (combos.Count == 0) { _logger.LogInformation("No provider combos for chains={Chains}", string.Join(',', chains)); return; }
        await InitializeAggregationMetaMultiAsync(jobId, account, combos, chains);
        var now = _clock.UtcNow;
        var tasks = combos.Select(c => PublishAsync(jobId, account, new List<string>{ c.chain.ToString() }, c.provider, now));
        await Task.WhenAll(tasks);
    }

    private Task PublishAsync(Guid jobId, string account, IReadOnlyList<string> chains, IntegrationProvider provider, DateTime now)
    {
        var req = new IntegrationRequest(jobId, Guid.NewGuid(), account, chains, provider, now, 1, null, null);
        var rk = $"integration.request.{ProviderSlug(provider)}";
        _logger.LogInformation("EVENT publish provider={Provider} chains={Chains} job={Job}", provider, string.Join(',', chains), jobId);
        return _publisher.PublishAsync(rk, req);
    }
}