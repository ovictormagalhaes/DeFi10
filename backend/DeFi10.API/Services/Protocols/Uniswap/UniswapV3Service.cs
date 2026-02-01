using System.Globalization;
using System.Numerics;
using DeFi10.API.Infrastructure.Http;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Protocols.Uniswap.Models;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Protocols.Uniswap;

public class UniswapV3Service : BaseHttpService, IUniswapV3Service
{
    private readonly string? _graphqlEndpoint;
    private readonly string? _apiKey;
    private readonly IUniswapV3OnChainService? _onChainService;
    private readonly IConfiguration _configuration;
    private readonly IUniswapGraphEndpointBuilder? _endpointBuilder;
    private readonly IUniswapV3ApiService? _apiService;

    public UniswapV3Service(
        HttpClient httpClient, 
        IConfiguration configuration, 
        ILogger<UniswapV3Service> logger,
        IUniswapV3OnChainService? onChainService = null,
        IUniswapGraphEndpointBuilder? endpointBuilder = null,
        IUniswapV3ApiService? apiService = null)
        : base(httpClient, logger)
    {
        _configuration = configuration;
        _graphqlEndpoint = configuration["ProtocolConfiguration:UniswapV3:GraphQLEndpoint"]
            ?? configuration["UniswapV3:GraphQLEndpoint"]
            ?? configuration["Uniswap:GraphQLEndpoint"];

        _apiKey = configuration["ProtocolConfiguration:UniswapV3:ApiKey"]
            ?? configuration["UniswapV3:ApiKey"]
            ?? configuration["Uniswap:ApiKey"];

        _onChainService = onChainService;
        _endpointBuilder = endpointBuilder;
        _apiService = apiService;
    }

    public async Task<UniswapV3GetActivePoolsResponse> GetActivePoolsHybridAsync(string account, ChainEnum chain)
    {
        var endpoint = _endpointBuilder?.Build(chain) ?? _graphqlEndpoint;
        var gql = await ExecuteGraphQueryAsync(account, endpoint);
        if (gql?.Data?.Positions == null || !gql.Data.Positions.Any()) return gql;

        if (_onChainService == null)
        {
            Logger.LogWarning("[Uniswap Phase1 Hybrid] On-chain service not provided; hybrid computation skipped.");
            return gql;
        }

        Logger.LogInformation("[Uniswap Hybrid] Processing {PositionCount} positions for uncollected fees computation", gql.Data.Positions.Count);

        // Fetch APRs for all pools in one batch
        var poolIds = gql.Data.Positions
            .Select(p => p.Pool?.Id)
            .Where(id => !string.IsNullOrEmpty(id))
            .Cast<string>()
            .Distinct()
            .ToList();
        Dictionary<string, decimal> poolAprs = new();
        
        if (_apiService == null)
        {
            Logger.LogWarning("[Uniswap Hybrid] API service is null, skipping APR fetch");
        }
        else if (!poolIds.Any())
        {
            Logger.LogInformation("[Uniswap Hybrid] No pool IDs found for APR fetch");
        }
        else if (string.IsNullOrEmpty(endpoint))
        {
            Logger.LogWarning("[Uniswap Hybrid] Endpoint is null or empty, skipping APR fetch");
        }
        else
        {
            try
            {
                poolAprs = await _apiService.GetPoolAprsAsync(poolIds, endpoint);
                Logger.LogInformation("[Uniswap Hybrid] Fetched APRs for {Count} pools", poolAprs.Count);
            }
            catch (Exception ex)
            {
                Logger.LogWarning(ex, "[Uniswap Hybrid] Failed to fetch pool APRs");
            }
        }

        foreach (var pos in gql.Data.Positions)
        {
            if (string.IsNullOrEmpty(pos.Id)) continue;

            // GraphQL position id should be a numeric token id
            var tokenId = BigInteger.Parse(pos.Id);
            Logger.LogDebug("[Uniswap Hybrid] Fetching on-chain data for position {TokenId}", tokenId);
            
            // Log collected fees from Graph (these are historical fees that were already collected)
            Logger.LogInformation("[Uniswap Hybrid] Position {TokenId} - CollectedFees from Graph: Token0={CFToken0}, Token1={CFToken1}", 
                tokenId, pos.CollectedFeesToken0, pos.CollectedFeesToken1);
            
            // Use GetPositionWithCalculatedFeesAsync instead of GetPositionDataSafeAsync to get accurate uncollected fees
            var dataResult = await _onChainService.GetPositionWithCalculatedFeesAsync(tokenId, chain);
            
            if (!dataResult.Success || dataResult.Position == null)
            {
                Logger.LogError("[Uniswap Hybrid] CRITICAL: Failed to fetch on-chain data for position {TokenId} - Success={Success}, Position={HasPosition}. Will throw to trigger reprocessing.",
                    tokenId, dataResult.Success, dataResult.Position != null);
                throw new InvalidOperationException($"Failed to fetch on-chain data for position {tokenId}");
            }

            // Scale TokensOwed (raw BigInteger) to decimal format using token decimals
            var scaledToken0 = dataResult.Token0Decimals > 0 
                ? ((decimal)dataResult.Position.TokensOwed0 / (decimal)Math.Pow(10, dataResult.Token0Decimals)).ToString("F" + dataResult.Token0Decimals, CultureInfo.InvariantCulture).TrimEnd('0').TrimEnd('.')
                : dataResult.Position.TokensOwed0.ToString();
            var scaledToken1 = dataResult.Token1Decimals > 0 
                ? ((decimal)dataResult.Position.TokensOwed1 / (decimal)Math.Pow(10, dataResult.Token1Decimals)).ToString("F" + dataResult.Token1Decimals, CultureInfo.InvariantCulture).TrimEnd('0').TrimEnd('.')
                : dataResult.Position.TokensOwed1.ToString();
            
            Logger.LogInformation("[Uniswap Hybrid] Position {TokenId} - Scaled fees: Token0={Scaled0} (raw={Raw0}), Token1={Scaled1} (raw={Raw1})", 
                tokenId, scaledToken0, dataResult.Position.TokensOwed0, scaledToken1, dataResult.Position.TokensOwed1);
            
            // Update UNCOLLECTED fees from on-chain calculation
            // Note: CollectedFeesToken0/1 remain unchanged from Graph (historical collected fees)
            pos.EstimatedUncollectedToken0 = scaledToken0;
            pos.EstimatedUncollectedToken1 = scaledToken1;
            pos.RawTokensOwed0 = dataResult.Position.TokensOwed0.ToString();
            pos.RawTokensOwed1 = dataResult.Position.TokensOwed1.ToString();
            
            Logger.LogInformation("[Uniswap Hybrid] Position {TokenId} - Final fees summary: Collected(Graph)=[{CF0},{CF1}], Uncollected(OnChain)=[{UF0},{UF1}]",
                tokenId, pos.CollectedFeesToken0, pos.CollectedFeesToken1, pos.EstimatedUncollectedToken0, pos.EstimatedUncollectedToken1);

            // Update current tick, price info, and token amounts from on-chain pool state if available
            if (!string.IsNullOrEmpty(dataResult.PoolAddress))
            {
                var poolState = await _onChainService.GetPoolStateSafeAsync(dataResult.PoolAddress, chain);
                
                if (!poolState.Success || poolState.State == null)
                {
                    Logger.LogError("[Uniswap Hybrid] CRITICAL: Failed to fetch pool state for position {TokenId}, pool {PoolAddress} - Success={Success}, State={HasState}. Will throw to trigger reprocessing.",
                        tokenId, dataResult.PoolAddress, poolState.Success, poolState.State != null);
                    throw new InvalidOperationException($"Failed to fetch pool state for position {tokenId}, pool {dataResult.PoolAddress}");
                }

                var currentTick = poolState.State.CurrentTick;
                pos.Pool ??= new DeFi10.API.Services.Protocols.Uniswap.Models.UniswapV3Pool();
                pos.Pool.Tick = currentTick.ToString();
                pos.Pool.SqrtPriceX96 = poolState.State.SqrtPriceX96.ToString();

                // compute price values using tick -> price conversion (match on-chain logic)
                int dec0 = 0, dec1 = 0;
                if (int.TryParse(pos.Token0?.Decimals, out var d0)) dec0 = d0;
                if (int.TryParse(pos.Token1?.Decimals, out var d1)) dec1 = d1;

                decimal currentPrice = TickToPrice(currentTick, dec0, dec1);
                decimal minPrice = TickToPrice((int)pos.TickLower, dec0, dec1);
                decimal maxPrice = TickToPrice((int)pos.TickUpper, dec0, dec1);

                pos.CurrentPriceToken1PerToken0 = currentPrice.ToString("G17");
                pos.MinPriceToken1PerToken0 = minPrice.ToString("G17");
                pos.MaxPriceToken1PerToken0 = maxPrice.ToString("G17");
                pos.RangeStatus = currentTick < pos.TickLower ? "below" : (currentTick > pos.TickUpper ? "above" : "in-range");
                
                // Compute current token amounts using on-chain data
                var (onChainAmt0, onChainAmt1, branch) = ComputePositionAmountsPrecise(
                    dataResult.Position.Liquidity,
                    dataResult.Position.TickLower,
                    dataResult.Position.TickUpper,
                    poolState.State.SqrtPriceX96,
                    poolState.State.CurrentTick,
                    dec0,
                    dec1
                );
                
                Logger.LogInformation("[Uniswap Hybrid] Position {TokenId} - On-chain amounts: Token0={OnChainAmt0}, Token1={OnChainAmt1}, Branch={Branch} (Graph had: Token0={GraphAmt0}, Token1={GraphAmt1})",
                    tokenId, onChainAmt0, onChainAmt1, branch, pos.DepositedToken0, pos.DepositedToken1);
                
                // Update with on-chain computed amounts (overriding Graph data)
                pos.DepositedToken0 = onChainAmt0.ToString("G17");
                pos.DepositedToken1 = onChainAmt1.ToString("G17");
            }
            
            // Set APR for this position from pool stats
            if (pos.Pool == null)
            {
                Logger.LogWarning("[Uniswap Hybrid] Position {PositionId} has null Pool", pos.Id);
            }
            else if (string.IsNullOrEmpty(pos.Pool.Id))
            {
                Logger.LogWarning("[Uniswap Hybrid] Position {PositionId} has empty Pool.Id", pos.Id);
            }
            else if (!poolAprs.TryGetValue(pos.Pool.Id, out var poolApr))
            {
                Logger.LogWarning("[Uniswap Hybrid] Position {PositionId} - Pool {PoolId} not found in APR dictionary (has {Count} pools)", 
                    pos.Id, pos.Pool.Id, poolAprs.Count);
                if (poolAprs.Any())
                {
                    Logger.LogInformation("[Uniswap Hybrid] Available pool IDs in APR dictionary: {PoolIds}", 
                        string.Join(", ", poolAprs.Keys));
                }
            }
            else
            {
                pos.Apr = poolApr;
                Logger.LogInformation("[Uniswap Hybrid] ✅ Set APR={APR}% for position {PositionId} in pool {PoolId}", 
                    poolApr, pos.Id, pos.Pool.Id);
            }
        }

        return gql;
    }

    public async Task<UniswapV3GetActivePoolsResponse> GetActivePoolsAsync(string account)
    {
        if (string.IsNullOrEmpty(_graphqlEndpoint))
        {
            Logger.LogWarning("[Uniswap Phase1] GraphQL endpoint is not configured (checked ProtocolConfiguration:UniswapV3 and UniswapV3 keys). Skipping GraphQL.");
            throw new InvalidOperationException("Uniswap GraphQL endpoint not configured");
        }

        return await ExecuteGraphQueryAsync(account, _graphqlEndpoint);
    }

    private async Task<UniswapV3GetActivePoolsResponse> ExecuteGraphQueryAsync(string account, string? endpoint)
    {
        if (string.IsNullOrEmpty(endpoint))
        {
            Logger.LogWarning("[Uniswap Phase1] GraphQL endpoint is not provided for execution.");
            throw new InvalidOperationException("Uniswap GraphQL endpoint not provided");
        }

        var request = new { query = BuildGraphQLQuery(account) };

        // Prefer root Graph api key if present
        var apiKey = _configuration["Graph:ApiKey"] ?? _apiKey;
        var headers = string.IsNullOrEmpty(apiKey)
            ? null
            : new Dictionary<string, string> { ["Authorization"] = $"Bearer {apiKey}" };

        Logger.LogInformation("[Uniswap Phase1] Attempting GraphQL query for account {Account} against endpoint {Endpoint} (ApiKeyPresent={HasKey})",
            account, endpoint, !string.IsNullOrEmpty(apiKey));

        UniswapV3GetActivePoolsResponse? response;
        try
        {
            response = await PostAsync<object, UniswapV3GetActivePoolsResponse>(endpoint, request, headers);
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "[Uniswap Phase1] GraphQL request failed for account {Account} at endpoint {Endpoint} - exception will be propagated for fallback: {Message}",
                account, endpoint, ex.Message);
            throw;
        }

        if (response?.Data?.Positions != null && response.Data.Positions.Any())
        {
            // Check if pool metadata is available
            var firstPos = response.Data.Positions.First();
            if (firstPos.Pool != null)
            {
                bool hasTickSpacing = !string.IsNullOrEmpty(firstPos.Pool.TickSpacing);
                bool hasCreatedAt = !string.IsNullOrEmpty(firstPos.Pool.CreatedAtUnix);

                if (!hasTickSpacing || !hasCreatedAt)
                {
                    Logger.LogInformation("[UniswapV3Service] Pool metadata partially available - TickSpacing: {HasTickSpacing}, CreatedAt: {HasCreatedAt}",
                        hasTickSpacing, hasCreatedAt);
                }
            }
        }

        return response ?? new UniswapV3GetActivePoolsResponse();
    }

    private static string BuildGraphQLQuery(string account)
    {
        // Use a conservative set of fields to maximize compatibility across different subgraph schemas.
        return @"{
                bundles(first: 1) {
                    nativePriceUSD
                }
                positions(
                    where: { owner: $owner, liquidity_gt: 0 }
                ) {
                    id
                    liquidity
                    depositedToken0
                    depositedToken1
                    withdrawnToken0
                    withdrawnToken1
                    collectedFeesToken0
                    collectedFeesToken1
                    feeGrowthInside0LastX128
                    feeGrowthInside1LastX128
                    tickLower
                    tickUpper
                    transaction { timestamp }
                    token0 { id symbol name decimals tokenAddress derivedNative }
                    token1 { id symbol name decimals tokenAddress derivedNative }
                    pool { id feeTier liquidity feeGrowthGlobal0X128 feeGrowthGlobal1X128 tick }
                }
            }".Replace("$owner", $"\"{account}\"");
    }

    private static decimal TickToPrice(int tick, int d0, int d1) => (decimal)(Math.Pow(1.0001, tick) * Math.Pow(10, d0 - d1));

    private static (decimal amount0, decimal amount1, string branch) ComputePositionAmountsPrecise(BigInteger L, int tickLower, int tickUpper, BigInteger sqrtPriceX96, int currentTick, int dec0, int dec1)
    {
        const int Q96 = 96;
        if (L == 0 || sqrtPriceX96 == 0) return (0, 0, "zero");
        
        static BigInteger SqrtPriceX96FromTick(int tick)
        {
            double sqrt = Math.Pow(1.0001, tick / 2.0) * Math.Pow(2, Q96);
            return new BigInteger(sqrt);
        }
        
        var sqrtL = SqrtPriceX96FromTick(tickLower);
        var sqrtU = SqrtPriceX96FromTick(tickUpper);
        var sqrtC = sqrtPriceX96;
        if (sqrtL > sqrtU) (sqrtL, sqrtU) = (sqrtU, sqrtL);
        
        BigInteger a0 = 0, a1 = 0;
        string branch;
        var Q96BI = BigInteger.One << Q96;
        
        if (sqrtC <= sqrtL)
        {
            branch = "below";
            var num = L * (sqrtU - sqrtL) * Q96BI;
            var den = sqrtU * sqrtL;
            if (den != 0) a0 = num / den;
        }
        else if (sqrtC < sqrtU)
        {
            branch = "in-range";
            var num0 = L * (sqrtU - sqrtC) * Q96BI;
            var den0 = sqrtU * sqrtC;
            if (den0 != 0) a0 = num0 / den0;
            a1 = L * (sqrtC - sqrtL) / Q96BI;
        }
        else
        {
            branch = "above";
            a1 = L * (sqrtU - sqrtL) / Q96BI;
        }
        
        decimal Scale(BigInteger v, int d)
        {
            if (v == 0) return 0;
            var pow = (decimal)Math.Pow(10, d);
            if (pow == 0) pow = 1;
            if (v > (BigInteger)decimal.MaxValue) v = (BigInteger)decimal.MaxValue;
            return (decimal)v / pow;
        }
        
        var d0 = Scale(a0, dec0);
        var d1 = Scale(a1, dec1);
        return (d0, d1, branch);
    }
}