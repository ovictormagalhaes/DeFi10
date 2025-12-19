using DeFi10.API.Models;
using DeFi10.API.Services.Domain.Mappers;
using System.Text.RegularExpressions;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Messaging.Rabbit;
using DeFi10.API.Messaging.Contracts.Enums;
using DeFi10.API.Messaging.Contracts.Requests;
using StackExchange.Redis;
using DeFi10.API.Configuration;
using Microsoft.Extensions.Options;
using DeFi10.API.Infrastructure;
using DeFi10.API.Aggregation;
using DeFi10.API.Services.Infrastructure.Moralis;
using DeFi10.API.Messaging.Constants;

namespace DeFi10.API.Services.Domain;

public class WalletAggregationService : IWalletAggregationService
{
    private readonly TimeSpan _aggregationTtl;
    private readonly IWalletItemMapperFactory _mapperFactory;
    private readonly IMessagePublisher _publisher;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<WalletAggregationService> _logger;
    private readonly ISystemClock _clock;
    private readonly IConfiguration _configuration;

    private readonly string _instanceId = Guid.NewGuid().ToString("N");
    private const ChainEnum DEFAULT_CHAIN = ChainEnum.Base;
    public string NetworkName => "Multi-Chain";

    private static readonly Regex EthAddressRegex = new("^0x[a-fA-F0-9]{40}$", RegexOptions.Compiled);

    private static readonly Regex SolAddressRegex = new("^[1-9A-HJ-NP-Za-km-z]{32,44}$", RegexOptions.Compiled);

    public WalletAggregationService(
        IConfiguration configuration,
        IWalletItemMapperFactory mapperFactory,
        IMessagePublisher publisher,
        IConnectionMultiplexer redis,
        IOptions<AggregationOptions> aggOptions,
        ILogger<WalletAggregationService> logger,
        ISystemClock clock)
    {
        _mapperFactory = mapperFactory;
        _publisher = publisher;
        _redis = redis;
        _logger = logger;
        _clock = clock;
        _configuration = configuration;
        var ttlSeconds = Math.Clamp(aggOptions.Value.JobTtlSeconds, 30, 1800);
        _aggregationTtl = TimeSpan.FromSeconds(ttlSeconds);
        _logger.LogInformation("WalletAggregationService instance created id={Id} ttl={Ttl}s", _instanceId, ttlSeconds);
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
        var jobId = await StartAsyncAggregationMultiWallet(new List<string> { account }, new List<ChainEnum> { chain }, null);
        return new WalletResponse
        {
            Account = account,
            Network = $"{NetworkName} (async job={jobId})",
            Items = new List<WalletItem>(),
            LastUpdated = _clock.UtcNow
        };
    }

    public async Task<Guid> StartAsyncAggregationMultiWallet(IReadOnlyList<string> accounts, IEnumerable<ChainEnum> chains, Guid? walletGroupId = null)
    {
        var accountsList = accounts.Distinct().ToList();
        var chainsList = chains.Distinct().ToList();
        
        if (accountsList.Count == 0) throw new ArgumentException("No accounts provided");
        if (chainsList.Count == 0) throw new ArgumentException("No chains provided");

        var db = _redis.GetDatabase();
        if (walletGroupId.HasValue)
        {
            var activeGroupKey = RedisKeys.ActiveWalletGroup(walletGroupId.Value, chainsList);
            var existing = await db.StringGetAsync(activeGroupKey);
            
            if (existing.HasValue && Guid.TryParse(existing.ToString(), out var existingJobId))
            {
                var metaKeyCheck = RedisKeys.Meta(existingJobId);
                if (await db.KeyExistsAsync(metaKeyCheck))
                {
                    _logger.LogInformation(
                        "Aggregation reuse multi-wallet group={GroupId} job={Job} chains={Chains}",
                        walletGroupId.Value,
                        existingJobId,
                        string.Join(',', chainsList)
                    );
                    return existingJobId;
                }
            }
        }


        foreach (var account in accountsList)
        {

            var compatibleChains = chainsList.Where(c => IsValidAddressForChain(account, c)).ToList();
            
            if (compatibleChains.Count == 0)
            {
                throw new ArgumentException(
                    $"Wallet '{account}' is not compatible with any of the requested chains. " +
                    $"Requested chains: {string.Join(", ", chainsList)}"
                );
            }
            
            _logger.LogDebug(
                "Wallet {Account} compatible with {Count}/{Total} chains: {Chains}",
                account,
                compatibleChains.Count,
                chainsList.Count,
                string.Join(", ", compatibleChains)
            );
        }
        
        foreach (var c in chainsList) ValidateChainSupport(c);
        
        var jobId = Guid.NewGuid();

        // TIER 1: Always-on providers (token scanning, NFT scanning, lending protocols)
        // These providers run first and may trigger Tier 2 providers dynamically
        var candidate = new List<IntegrationProvider>
        {
            IntegrationProvider.MoralisTokens,      // EVM wallet tokens
            IntegrationProvider.MoralisNfts,        // EVM NFTs (triggers Uniswap V3 if found)
            IntegrationProvider.AaveSupplies,       // Aave lending (independent)
            IntegrationProvider.AaveBorrows,        // Aave borrowing (independent)
            IntegrationProvider.PendleVePositions,  // Pendle vePENDLE (independent)
            IntegrationProvider.PendleDeposits,     // Pendle PT deposits (independent)
            IntegrationProvider.SolanaTokens,       // Solana wallet tokens
            IntegrationProvider.SolanaNfts,         // Solana NFTs (triggers Raydium if found)
            IntegrationProvider.SolanaKaminoPositions,  // Kamino (independent)
        };

        // TIER 2: Conditional providers (triggered by Tier 1 NFT detection)
        // UniswapV3Positions - triggered by MoralisNfts when position NFTs detected
        // SolanaRaydiumPositions - triggered by SolanaNfts when CLMM position NFTs detected

        _logger.LogInformation(
            "Multi-wallet aggregation: Using Tier 1 providers (count={Count}), Tier 2 providers will be triggered dynamically",
            candidate.Count);

        var combos = new List<(string account, ChainEnum chain, IntegrationProvider provider)>();

        foreach (var account in accountsList)
        {
            foreach (var chain in chainsList)
            {

                if (!IsValidAddressForChain(account, chain))
                {
                    _logger.LogDebug(
                        "Skipping wallet {Account} for chain {Chain} (incompatible address type)",
                        account,
                        chain
                    );
                    continue;
                }
                
                foreach (var provider in candidate)
                {
                    if (ProviderSupportsChain(provider, chain))
                    {
                        combos.Add((account, chain, provider));
                    }
                }
            }
        }
        
        if (combos.Count == 0)
        {
            throw new InvalidOperationException(
                "No valid provider combinations found. " +
                $"Wallets: {string.Join(", ", accountsList)} " +
                $"Chains: {string.Join(", ", chainsList)}"
            );
        }
        
        _logger.LogInformation(
            "Multi-wallet aggregation: {Wallets} wallets � {Chains} chains = {Total} requests (mixed wallet types allowed)",
            accountsList.Count,
            chainsList.Count,
            combos.Count
        );

        await InitializeAggregationMetaMultiWalletAsync(jobId, accountsList, combos, chainsList, walletGroupId);

        if (walletGroupId.HasValue)
        {
        var activeGroupKey = RedisKeys.ActiveWalletGroup(walletGroupId.Value, chainsList);
            await db.StringSetAsync(activeGroupKey, jobId.ToString(), _aggregationTtl);
        }

        var now = _clock.UtcNow;
        var tasks = combos.Select(c => PublishAsync(jobId, c.account, new List<string> { c.chain.ToString() }, c.provider, now));
        await Task.WhenAll(tasks);
        
        _logger.LogInformation(
            "Multi-wallet aggregation started job={Job} walletGroupId={GroupId} total={Total}",
            jobId,
            walletGroupId,
            combos.Count
        );
        
        return jobId;
    }

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

    private async Task InitializeAggregationMetaMultiWalletAsync(
        Guid jobId, 
        List<string> accounts, 
        List<(string account, ChainEnum chain, IntegrationProvider provider)> combos, 
        List<ChainEnum> chains,
        Guid? walletGroupId)
    {
        var db = _redis.GetDatabase();
        var metaKey = RedisKeys.Meta(jobId);
        var pendingKey = RedisKeys.Pending(jobId);
        
        if (await db.KeyExistsAsync(metaKey)) return;
        
        var now = _clock.UtcNow;
        var hashEntries = new List<HashEntry>
        {
            new(RedisKeys.MetaFields.Accounts, RedisKeys.SerializeAccounts(accounts)),
            new(RedisKeys.MetaFields.Chains, string.Join(',', chains)),
            new(RedisKeys.MetaFields.CreatedAt, now.ToString("o")),
            new(RedisKeys.MetaFields.ExpectedTotal, combos.Count),
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

        foreach (var combo in combos)
        {
            var pendingEntry = $"{ProviderSlug(combo.provider)}:{combo.chain.ToString().ToLowerInvariant()}:{combo.account.ToLowerInvariant()}";
            await db.SetAddAsync(pendingKey, pendingEntry);
        }
        
        await db.KeyExpireAsync(metaKey, _aggregationTtl);
        await db.KeyExpireAsync(pendingKey, _aggregationTtl);
        
        _logger.LogDebug("Initialized multi-wallet meta jobId={JobId} accounts={Accounts} expected={Expected}", 
            jobId, accounts.Count, combos.Count);
    }

    private bool ProviderSupportsChain(IntegrationProvider provider, ChainEnum chain)
    {
        try
        {
            return provider switch
            {

                IntegrationProvider.MoralisTokens => chain != ChainEnum.Solana && _mapperFactory.CreateMoralisTokenMapper().SupportsChain(chain),
                IntegrationProvider.AaveSupplies => _mapperFactory.CreateAaveSuppliesMapper().SupportsChain(chain),
                IntegrationProvider.AaveBorrows => _mapperFactory.CreateAaveBorrowsMapper().SupportsChain(chain),
                IntegrationProvider.UniswapV3Positions => _mapperFactory.CreateUniswapV3Mapper().SupportsChain(chain),
                IntegrationProvider.PendleVePositions => _mapperFactory.CreatePendleVeMapper().SupportsChain(chain),
                IntegrationProvider.PendleDeposits => _mapperFactory.CreatePendleDepositsMapper().SupportsChain(chain),

                IntegrationProvider.SolanaTokens => chain == ChainEnum.Solana && _mapperFactory.CreateSolanaTokenMapper().SupportsChain(chain),
                IntegrationProvider.SolanaKaminoPositions => chain == ChainEnum.Solana && _mapperFactory.CreateSolanaKaminoMapper().SupportsChain(chain),
                IntegrationProvider.SolanaRaydiumPositions => chain == ChainEnum.Solana && _mapperFactory.CreateSolanaRaydiumMapper().SupportsChain(chain),
                
                // NFT Screening Providers (Tier 1 - trigger other protocols)
                IntegrationProvider.MoralisNfts => chain != ChainEnum.Solana, // EVM chains only
                IntegrationProvider.SolanaNfts => chain == ChainEnum.Solana,
                
                _ => false
            };
        }
        catch { return false; }
    }

    private async Task PublishIntegrationRequestsAsync(Guid jobId, string account, ChainEnum chain)
    {

        // TIER 1: Always-on providers - Tier 2 will be triggered dynamically
        var candidate = new List<IntegrationProvider>
        {
            IntegrationProvider.MoralisTokens,
            IntegrationProvider.MoralisNfts,
            IntegrationProvider.AaveSupplies,
            IntegrationProvider.AaveBorrows,
            IntegrationProvider.PendleVePositions,
            IntegrationProvider.PendleDeposits,
            IntegrationProvider.SolanaTokens,
            IntegrationProvider.SolanaNfts,
            IntegrationProvider.SolanaKaminoPositions,
        };

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
            IntegrationProvider.SolanaKaminoPositions,
            IntegrationProvider.SolanaRaydiumPositions,
        };


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
        var rk = RoutingKeys.ForIntegrationRequest(provider);
        _logger.LogInformation("EVENT publish provider={Provider} chains={Chains} job={Job}", provider, string.Join(',', chains), jobId);
        return _publisher.PublishAsync(rk, req);
    }
}
