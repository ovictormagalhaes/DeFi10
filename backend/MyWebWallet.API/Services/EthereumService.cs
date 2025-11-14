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
    private readonly IMoralisService _moralisService; // MoralisEVMService for EVM chains
    private readonly IAaveeService _aaveeService;
    private readonly IUniswapV3OnChainService _uniswapV3OnChainService;
    private readonly IWalletItemMapperFactory _mapperFactory;
    private readonly IMessagePublisher _publisher;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<EthereumService> _logger;
    private readonly ISystemClock _clock;

    private readonly string _instanceId = Guid.NewGuid().ToString("N");
    private const ChainEnum DEFAULT_CHAIN = ChainEnum.Base;
    public string NetworkName => "Ethereum";

    private static readonly Regex EthAddressRegex = new("^0x[a-fA-F0-9]{40}$", RegexOptions.Compiled);
    // Solana base58 address (rough validation: 32-44 chars, Base58 alphabet without 0 O I l)
    private static readonly Regex SolAddressRegex = new("^[1-9A-HJ-NP-Za-km-z]{32,44}$", RegexOptions.Compiled);

    public EthereumService(
        IMoralisService moralisService, // Injected as MoralisEVMService
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

    public bool IsValidAddress(string account) => EthAddressRegex.IsMatch(account);

    private static bool IsValidAddressForChain(string account, ChainEnum chain)
    {
        return chain switch
        {
            ChainEnum.Solana => SolAddressRegex.IsMatch(account),
            ChainEnum.Base or ChainEnum.Ethereum or ChainEnum.Arbitrum or ChainEnum.Optimism or ChainEnum.BNB or ChainEnum.Polygon => EthAddressRegex.IsMatch(account),
            _ => true
        };
    }

    public async Task<WalletResponse> GetWalletTokensAsync(string account) => await GetWalletTokensAsync(account, DEFAULT_CHAIN);

    public async Task<WalletResponse> GetWalletTokensAsync(string account, ChainEnum chain)
    {
        if (!IsValidAddressForChain(account, chain)) throw new ArgumentException($"Invalid address for chain {chain}");
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
        if (!IsValidAddressForChain(account, chain)) throw new ArgumentException($"Invalid address for chain {chain}");
        ValidateChainSupport(chain);
        var db = _redis.GetDatabase();
        
        // IMPORTANT: Solana addresses are case-sensitive (Base58), DO NOT lowercase them
        // EVM addresses (0x...) are case-insensitive, can be lowercased for consistency
        var acct = chain == ChainEnum.Solana ? account : account.ToLowerInvariant();
        
        var activeKey = GetActiveJobKey(acct.ToLowerInvariant(), chain); // Redis keys can be lowercase
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
        await PublishIntegrationRequestsAsync(jobId, acct, chain); // Use original case for Solana
        await db.StringSetAsync(activeKey, jobId.ToString(), _aggregationTtl);
        _logger.LogInformation("Aggregation new single job={Job} chain={Chain}", jobId, chain);
        return jobId;
    }

    public async Task<Guid> StartAsyncAggregation(string account, IEnumerable<ChainEnum> chains)
    {
        var list = chains.Distinct().ToList();
        if (list.Count == 0) throw new ArgumentException("No chains provided");
        // Validate address per chain
        foreach (var c in list)
        {
            if (!IsValidAddressForChain(account, c))
                throw new ArgumentException($"Invalid address for chain {c}");
        }
        foreach (var c in list) ValidateChainSupport(c);
        var db = _redis.GetDatabase();
        
        // IMPORTANT: Preserve case for Solana addresses (Base58 is case-sensitive)
        // If any chain is Solana, preserve original case; otherwise lowercase for EVM
        var hasSolana = list.Contains(ChainEnum.Solana);
        var acct = hasSolana ? account : account.ToLowerInvariant();
        
        var multiKey = GetMultiActiveJobKey(acct.ToLowerInvariant(), list); // Redis keys can be lowercase
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
        await PublishIntegrationRequestsMultiAsync(newJob, acct, list); // Use original case if Solana
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
                // EVM-only providers (0x... addresses)
                IntegrationProvider.MoralisTokens => chain != ChainEnum.Solana && _mapperFactory.CreateMoralisTokenMapper().SupportsChain(chain),
                IntegrationProvider.AaveSupplies => _mapperFactory.CreateAaveSuppliesMapper().SupportsChain(chain),
                IntegrationProvider.AaveBorrows => _mapperFactory.CreateAaveBorrowsMapper().SupportsChain(chain),
                IntegrationProvider.UniswapV3Positions => _mapperFactory.CreateUniswapV3Mapper().SupportsChain(chain),
                IntegrationProvider.PendleVePositions => _mapperFactory.CreatePendleVeMapper().SupportsChain(chain),
                IntegrationProvider.PendleDeposits => _mapperFactory.CreatePendleDepositsMapper().SupportsChain(chain),
                
                // Solana-only providers (Base58 addresses)
                IntegrationProvider.SolanaTokens => chain == ChainEnum.Solana && _mapperFactory.CreateSolanaTokenMapper().SupportsChain(chain),
                IntegrationProvider.SolanaKaminoPositions => chain == ChainEnum.Solana && _mapperFactory.CreateSolanaKaminoMapper().SupportsChain(chain),
                IntegrationProvider.SolanaRaydiumPositions => chain == ChainEnum.Solana && _mapperFactory.CreateSolanaRaydiumMapper().SupportsChain(chain),
                
                _ => false
            };
        }
        catch { return false; }
    }

    private async Task PublishIntegrationRequestsAsync(Guid jobId, string account, ChainEnum chain)
    {
        // Include Solana providers too; filtering will happen via ProviderSupportsChain
        var candidate = new List<IntegrationProvider>
        {
            IntegrationProvider.MoralisTokens,
            IntegrationProvider.AaveSupplies,
            IntegrationProvider.AaveBorrows,
            IntegrationProvider.UniswapV3Positions,
            IntegrationProvider.PendleVePositions,
            IntegrationProvider.PendleDeposits,
            IntegrationProvider.SolanaTokens,
            IntegrationProvider.SolanaKaminoPositions, // REATIVADO
            // IntegrationProvider.SolanaRaydiumPositions // Mantém Raydium desativado por enquanto
        };
        
        // CRITICAL: Filter providers to only those that support this specific chain
        // This prevents sending Solana addresses to EVM providers and vice versa
        var supported = candidate.Where(p => ProviderSupportsChain(p, chain)).ToList();
        
        if (supported.Count == 0) 
        { 
            _logger.LogWarning("No providers support chain={Chain} for account={Account}", chain, account); 
            return; 
        }
        
        await InitializeAggregationMetaAsync(jobId, account, chain, supported);
        var now = _clock.UtcNow;
        var chainList = new List<string>{ chain.ToString() };
        await Task.WhenAll(supported.Select(p => PublishAsync(jobId, account, chainList, p, now)));
    }

    private async Task PublishIntegrationRequestsMultiAsync(Guid jobId, string account, List<ChainEnum> chains)
    {
        var candidate = new List<IntegrationProvider>
        {
            IntegrationProvider.MoralisTokens,
            IntegrationProvider.AaveSupplies,
            IntegrationProvider.AaveBorrows,
            IntegrationProvider.UniswapV3Positions,
            IntegrationProvider.PendleVePositions,
            IntegrationProvider.PendleDeposits,
            IntegrationProvider.SolanaTokens,
            IntegrationProvider.SolanaKaminoPositions, // REATIVADO
            // IntegrationProvider.SolanaRaydiumPositions // Mantém Raydium desativado por enquanto
        };
        
        // Build combos of (provider, chain) only when provider supports that chain
        // CRITICAL: This ensures Solana providers only get Solana chain, EVM providers only get EVM chains
        var combos = new List<(IntegrationProvider provider, ChainEnum chain)>();
        foreach (var c in chains)
        {
            foreach (var p in candidate)
            {
                if (ProviderSupportsChain(p, c))
                {
                    combos.Add((p, c));
                }
            }
        }
        
        if (combos.Count == 0) 
        { 
            _logger.LogWarning("No provider combos for account={Account} chains={Chains}", account, string.Join(',', chains)); 
            return; 
        }
        
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