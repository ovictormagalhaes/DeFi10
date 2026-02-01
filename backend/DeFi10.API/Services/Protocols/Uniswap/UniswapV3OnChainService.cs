using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Protocols.Uniswap.Models;
using DeFi10.API.Services.Protocols.Uniswap.DTOs;
using DeFi10.API.Configuration;
using Nethereum.ABI;
using Nethereum.Contracts;
using Nethereum.Util;
using Nethereum.Web3;
using Nethereum.Hex.HexConvertors.Extensions;
using System.Numerics;
using ChainEnum = DeFi10.API.Models.Chain;
using System.Collections.Concurrent;
using DeFi10.API.Services.Helpers;
using Microsoft.Extensions.Logging;

namespace DeFi10.API.Services.Protocols.Uniswap
{
    public class UniswapV3OnChainService : IUniswapV3OnChainService
    {
        private int _maxRetryAttempts = 3;
        private const int BaseDelayMilliseconds = 1000;

        /// <summary>
        /// Executes an operation with retry logic and exponential backoff for transient errors.
        /// </summary>
        private async Task<T?> ExecuteWithRetryAsync<T>(Func<Task<T?>> operation, string operationName, int? maxAttempts = null) where T : class
        {
            int attempts = maxAttempts ?? _maxRetryAttempts;
            for (int attempt = 1; attempt <= attempts; attempt++)
            {
                try
                {
                    return await operation();
                }
                catch (Exception ex) when (IsTransientError(ex) && attempt < attempts)
                {
                    var delay = TimeSpan.FromMilliseconds(BaseDelayMilliseconds * Math.Pow(2, attempt - 1));
                    _logger.LogWarning(ex, "{Operation} failed (attempt {Attempt}/{Max}). Retrying in {Delay}ms...", 
                        operationName, attempt, attempts, delay.TotalMilliseconds);
                    await Task.Delay(delay);
                }
            }
            return await operation();
        }

        /// <summary>
        /// Executes an operation with retry logic and exponential backoff for transient errors (value types).
        /// </summary>
        private async Task<T?> ExecuteWithRetryValueAsync<T>(Func<Task<T?>> operation, string operationName, int? maxAttempts = null) where T : struct
        {
            int attempts = maxAttempts ?? _maxRetryAttempts;
            for (int attempt = 1; attempt <= attempts; attempt++)
            {
                try
                {
                    return await operation();
                }
                catch (Exception ex) when (IsTransientError(ex) && attempt < attempts)
                {
                    var delay = TimeSpan.FromMilliseconds(BaseDelayMilliseconds * Math.Pow(2, attempt - 1));
                    _logger.LogWarning(ex, "{Operation} failed (attempt {Attempt}/{Max}). Retrying in {Delay}ms...", 
                        operationName, attempt, attempts, delay.TotalMilliseconds);
                    await Task.Delay(delay);
                }
            }
            return await operation();
        }

        private bool IsTransientError(Exception ex)
        {
            return ex.GetType().Name.Contains("RpcClientTimeoutException") ||
                   ex is TaskCanceledException ||
                   ex is TimeoutException ||
                   (ex is System.IO.IOException ioEx && ioEx.InnerException is System.Net.Sockets.SocketException) ||
                   ex.Message.Contains("timeout", StringComparison.OrdinalIgnoreCase) ||
                   ex.Message.Contains("connection", StringComparison.OrdinalIgnoreCase);
        }

        private async Task<double?> TryGetNativeUsdFromChainlinkAsync(ChainContext ctx)
        {
            try
            {
                // Get Chainlink aggregator from ChainConfiguration
                var chainConfig = _chainConfigService.GetChainConfig(ctx.Chain);
                string aggregator = chainConfig?.PriceFeeds?.Chainlink?.NativeUsdAggregator ?? string.Empty;
                int decimals = chainConfig?.PriceFeeds?.Chainlink?.Decimals ?? 8;

                if (string.IsNullOrWhiteSpace(aggregator))
                {
                    _logger.LogDebug("CHAINLINK_NATIVE_PRICE_SKIP: chain={Chain} reason=no-aggregator-configured", ctx.Chain);
                    return null;
                }

                var handler = ctx.Web3.Eth.GetContractHandler(aggregator);
                var data = await handler.QueryDeserializingToObjectAsync<LatestRoundDataFunction, LatestRoundDataOutputDTO>(new LatestRoundDataFunction());
                if (data == null)
                {
                    _logger.LogWarning("CHAINLINK_NATIVE_PRICE_WARN: chain={Chain} reason=null-response", ctx.Chain);
                    return null;
                }
                var answer = data.Answer;
                if (answer <= 0)
                {
                    _logger.LogWarning("CHAINLINK_NATIVE_PRICE_WARN: chain={Chain} reason=non-positive-answer value={Answer}", ctx.Chain, answer);
                    return null;
                }

                double val = (double)answer / Math.Pow(10, decimals);
                _logger.LogInformation("CHAINLINK_NATIVE_PRICE: chain={Chain} priceUSD={Price:G17} aggregator={Aggregator}", ctx.Chain, val, aggregator);
                return val;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "CHAINLINK_NATIVE_PRICE_WARN: chain={Chain}", ctx.Chain);
                return null;
            }
        }

        private readonly IConfiguration _configuration;
        private readonly IChainConfigurationService _chainConfigService;
        private readonly ILogger<UniswapV3OnChainService> _logger;
        private const string BASE_FACTORY_ADDRESS = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
        private const string BASE_POSITION_MANAGER_ADDRESS = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
        private const string ARBITRUM_FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
        private const string ARBITRUM_POSITION_MANAGER_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

        private sealed record ChainContext(ChainEnum Chain, Web3 Web3, string PositionManager, string Factory, string PoolInitCodeHash);
        private readonly ConcurrentDictionary<ChainEnum, ChainContext> _contexts = new();

        public UniswapV3OnChainService(IConfiguration configuration, IChainConfigurationService chainConfigService, ILogger<UniswapV3OnChainService> logger)
        {
            _configuration = configuration;
            _chainConfigService = chainConfigService;
            _logger = logger;
            
            // Read MaxRetries from configuration, default to 3
            var chainConfig = _chainConfigService.GetChainConfig(ChainEnum.Base);
            if (chainConfig?.Rpc?.MaxRetries > 0)
            {
                _maxRetryAttempts = chainConfig.Rpc.MaxRetries;
                _logger.LogInformation("UniswapV3OnChainService: Using MaxRetries={MaxRetries} from configuration", _maxRetryAttempts);
            }
            else
            {
                _logger.LogInformation("UniswapV3OnChainService: Using default MaxRetries={MaxRetries}", _maxRetryAttempts);
            }
        }

        private ChainContext GetContext(ChainEnum chain) => _contexts.GetOrAdd(chain, c => BuildContext(c));

        private ChainContext BuildContext(ChainEnum chain)
        {
            var key = _configuration["Alchemy:ApiKey"];
            string rpc = !string.IsNullOrEmpty(key) ? chain.GetAlchemyRpcUrl(key) : chain switch
            {
                ChainEnum.Base => _configuration["Alchemy:BaseRpcUrl"] ?? throw new InvalidOperationException("Missing Base RPC"),
                ChainEnum.Arbitrum => _configuration["Alchemy:ArbitrumRpcUrl"] ?? throw new InvalidOperationException("Missing Arbitrum RPC"),
                _ => throw new NotSupportedException("Unsupported chain")
            };
            var pm = (chain switch
            {
                ChainEnum.Base => _configuration["UniswapV3:Base:PositionManager"] ?? BASE_POSITION_MANAGER_ADDRESS,
                ChainEnum.Arbitrum => _configuration["UniswapV3:Arbitrum:PositionManager"] ?? ARBITRUM_POSITION_MANAGER_ADDRESS,
                _ => throw new NotSupportedException()
            }).ToLowerInvariant();
            var factory = (chain switch
            {
                ChainEnum.Base => _configuration["UniswapV3:Base:Factory"] ?? BASE_FACTORY_ADDRESS,
                ChainEnum.Arbitrum => _configuration["UniswapV3:Arbitrum:Factory"] ?? ARBITRUM_FACTORY_ADDRESS,
                _ => throw new NotSupportedException()
            }).ToLowerInvariant();
            var init = (chain == ChainEnum.Arbitrum
                ? _configuration["UniswapV3:Arbitrum:PoolInitCodeHash"]
                : _configuration["UniswapV3:Base:PoolInitCodeHash"]) ?? _configuration["UniswapV3:PoolInitCodeHash"] ?? "0xe34f4a2e3af081af0d5af2c5d0a8f0d492adefafbd18e23601d79d64c6f3d6f";
            init = init.ToLowerInvariant();
            _logger.LogInformation("Created context - chain={Chain} rpc={Rpc} positionManager={Pm} factory={Factory}", chain, rpc, pm, factory);
            return new(chain, new Web3(rpc), pm, factory, init);
        }

        private static string Normalize(string? a) 
        {
            if (string.IsNullOrEmpty(a)) 
                return "0x0000000000000000000000000000000000000000";
            
            return a.StartsWith("0x") ? a.ToLowerInvariant() : "0x" + a.ToLowerInvariant();
        }

        private string ComputePoolAddress(ChainContext ctx, string? tokenA, string? tokenB, uint fee)
        {
            try
            {
                if (string.IsNullOrEmpty(tokenA) || string.IsNullOrEmpty(tokenB))
                    return string.Empty;
                
                tokenA = Normalize(tokenA); tokenB = Normalize(tokenB);
                var (token0, token1) = string.CompareOrdinal(tokenA, tokenB) < 0 ? (tokenA, tokenB) : (tokenB, tokenA);
                var encoder = new ABIEncode();
                var salt = encoder.GetABIEncodedPacked(new ABIValue("address", token0), new ABIValue("address", token1), new ABIValue("uint24", fee));
                var saltHash = Sha3Keccack.Current.CalculateHash(salt).ToHex(false).TrimStart('0','x');
                var factoryNo0x = ctx.Factory[2..];
                var initNo0x = ctx.PoolInitCodeHash.StartsWith("0x") ? ctx.PoolInitCodeHash[2..] : ctx.PoolInitCodeHash;
                var packed = "ff" + factoryNo0x + saltHash + initNo0x;
                if (!System.Text.RegularExpressions.Regex.IsMatch(packed, "^[0-9a-fA-F]+$")) return string.Empty;
                var hash = Sha3Keccack.Current.CalculateHash(packed.HexToByteArray()).ToHex(false).TrimStart('0','x');
                var computed = ("0x" + hash[^40..]).ToLowerInvariant();
                _logger.LogTrace("Computed pool address candidate token0={Token0} token1={Token1} fee={Fee} computed={Pool}", token0, token1, fee, computed);
                return computed;
            }
            catch (Exception ex) { _logger.LogDebug(ex, "ComputePoolAddress failed"); return string.Empty; }
        }

        private async Task<string> GetPoolAddressFromFactoryAsync(ChainContext ctx, string? tokenA, string? tokenB, uint fee)
        {
            try
            {
                if (string.IsNullOrEmpty(tokenA) || string.IsNullOrEmpty(tokenB))
                    return string.Empty;
                
                var tA = Normalize(tokenA); var tB = Normalize(tokenB);
                var (token0, token1) = string.CompareOrdinal(tA, tB) < 0 ? (tA, tB) : (tB, tA);
                var handler = ctx.Web3.Eth.GetContractHandler(ctx.Factory);
                var pool = await handler.QueryAsync<GetPoolFunction, string>(new GetPoolFunction { Token0 = token0, Token1 = token1, Fee = fee });
                if (string.IsNullOrWhiteSpace(pool) || pool == "0x0000000000000000000000000000000000000000") return string.Empty;
                var code = await ctx.Web3.Eth.GetCode.SendRequestAsync(pool);
                if (string.IsNullOrEmpty(code) || code == "0x") return string.Empty;
                _logger.LogTrace("Factory returned pool token0={Token0} token1={Token1} fee={Fee} pool={Pool}", token0, token1, fee, pool);
                return pool.ToLowerInvariant();
            }
            catch (Exception ex) { _logger.LogDebug(ex, "GetPoolAddressFromFactoryAsync failed"); return string.Empty; }
        }

        private async Task<string> ResolvePoolAsync(ChainContext ctx, string? token0, string? token1, uint fee)
        {
            if (string.IsNullOrEmpty(token0) || string.IsNullOrEmpty(token1))
                return string.Empty;
            
            var fromFactory = await GetPoolAddressFromFactoryAsync(ctx, token0, token1, fee);
            if (!string.IsNullOrEmpty(fromFactory)) return fromFactory;
            var computed = ComputePoolAddress(ctx, token0, token1, fee);
            if (!string.IsNullOrEmpty(computed))
            {
                var code = await ctx.Web3.Eth.GetCode.SendRequestAsync(computed);
                if (!string.IsNullOrEmpty(code) && code != "0x") return computed;
            }
            _logger.LogWarning("ResolvePool failed token0={Token0} token1={Token1} fee={Fee}", token0, token1, fee);
            return string.Empty;
        }

        private async Task<(string symbol, string name, int decimals)> GetErc20MetadataAsync(ChainContext ctx, string? token)
        {
            try
            {
                if (string.IsNullOrEmpty(token))
                    return (string.Empty, string.Empty, 0);
                
                var h = ctx.Web3.Eth.GetContractHandler(token);
                var decTask = h.QueryAsync<ERC20DecimalsFunction, byte>(new());
                var symTask = h.QueryAsync<ERC20SymbolFunction, string>(new());
                var nameTask = h.QueryAsync<ERC20NameFunction, string>(new());
                await Task.WhenAll(decTask, symTask, nameTask);
                return ((await symTask) ?? string.Empty, (await nameTask) ?? string.Empty, (int)await decTask);
            }
            catch (Exception ex) { _logger.LogDebug(ex, "GetErc20MetadataAsync failed token={Token}", token); return (string.Empty, string.Empty, 0); }
        }

        private async Task<PositionDTO?> TryGetPositionAsync(ChainContext ctx, BigInteger id)
        {
            return await ExecuteWithRetryAsync(async () =>
            {
                try
                {
                    var positionResult = await ctx.Web3.Eth.GetContractHandler(ctx.PositionManager)
                        .QueryDeserializingToObjectAsync<PositionsFunction, PositionDTO>(new PositionsFunction { TokenId = id });
                    
                    if (positionResult == null)
                    {
                        _logger.LogWarning("Position {TokenId} on chain {Chain} not found", id, ctx.Chain);
                        return null;
                    }

                    _logger.LogDebug("[OnChain] Position {TokenId} retrieved - TokensOwed0={Owed0}, TokensOwed1={Owed1}, Liquidity={Liquidity}, FeeGrowthInside0Last={FG0}, FeeGrowthInside1Last={FG1}",
                        id, positionResult.TokensOwed0, positionResult.TokensOwed1, positionResult.Liquidity, 
                        positionResult.FeeGrowthInside0LastX128, positionResult.FeeGrowthInside1LastX128);

                    return positionResult;
                }
                catch (Exception ex) when (ex.Message.Contains("Invalid token ID") || ex.Message.Contains("ERC721: owner query"))
                {
                    _logger.LogWarning("Position {TokenId} on chain {Chain} failed: {Message}", id, ctx.Chain, ex.Message);
                    return null;
                }
                catch (Exception ex) when (IsTransientError(ex))
                {
                    _logger.LogDebug(ex, "Transient error getting position {TokenId} on chain {Chain}, will retry", id, ctx.Chain);
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Position {TokenId} on chain {Chain} failed with non-transient exception", id, ctx.Chain);
                    throw;
                }
            }, $"TryGetPositionAsync(tokenId={id}, chain={ctx.Chain})") ?? null;
        }

        private async Task<Slot0OutputDTO?> TryGetSlot0Async(ChainContext ctx, string pool)
        {
            return await ExecuteWithRetryAsync(async () =>
            {
                try 
                { 
                    return await ctx.Web3.Eth.GetContractHandler(pool).QueryDeserializingToObjectAsync<Slot0Function, Slot0OutputDTO>(new()); 
                }
                catch (Exception ex) when (IsTransientError(ex))
                {
                    _logger.LogDebug(ex, "Transient error in TryGetSlot0Async pool={Pool}, will retry", pool);
                    throw;
                }
                catch (Exception ex) 
                { 
                    _logger.LogDebug(ex, "TryGetSlot0Async failed pool={Pool}", pool); 
                    return null; 
                }
            }, $"TryGetSlot0Async(pool={pool})") ?? null;
        }

        private async Task<(BigInteger fg0, BigInteger fg1)?> TryGetFeeGrowthAsync(ChainContext ctx, string pool)
        {
            return await ExecuteWithRetryValueAsync(async () =>
            {
                try
                {
                    var h = ctx.Web3.Eth.GetContractHandler(pool);
                    var t0 = h.QueryAsync<FeeGrowthGlobal0X128Function, BigInteger>(new());
                    var t1 = h.QueryAsync<FeeGrowthGlobal1X128Function, BigInteger>(new());
                    await Task.WhenAll(t0, t1);
                    return ((BigInteger, BigInteger)?)(await t0, await t1);
                }
                catch (Exception ex) when (IsTransientError(ex))
                {
                    _logger.LogDebug(ex, "Transient error in TryGetFeeGrowthAsync pool={Pool}, will retry", pool);
                    throw;
                }
                catch (Exception ex) 
                { 
                    _logger.LogDebug(ex, "TryGetFeeGrowthAsync failed pool={Pool}", pool); 
                    return null; 
                }
            }, $"TryGetFeeGrowthAsync(pool={pool})");
        }

        private static (decimal amount0, decimal amount1, string branch) ComputePositionAmountsPrecise(BigInteger L, int tickLower, int tickUpper, BigInteger sqrtPriceX96, int currentTick, int dec0, int dec1)
        {
            const int Q96 = 96;
            if (L == 0 || sqrtPriceX96 == 0) return (0,0,"zero");
            static BigInteger SqrtPriceX96FromTick(int tick)
            {
                double sqrt = Math.Pow(1.0001, tick/2.0) * Math.Pow(2, Q96);
                return new BigInteger(sqrt);
            }
            var sqrtL = SqrtPriceX96FromTick(tickLower);
            var sqrtU = SqrtPriceX96FromTick(tickUpper);
            var sqrtC = sqrtPriceX96;
            if (sqrtL > sqrtU) (sqrtL, sqrtU) = (sqrtU, sqrtL);
            BigInteger a0=0,a1=0; string branch;
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
            decimal Scale(BigInteger v, int d){ if (v==0) return 0; var pow = (decimal)Math.Pow(10,d); if (pow==0) pow=1; if (v > (BigInteger)decimal.MaxValue) v=(BigInteger)decimal.MaxValue; return (decimal)v / pow; }
            var d0 = Scale(a0, dec0); var d1 = Scale(a1, dec1);
            return (d0,d1,branch);
        }

        private static bool IsStable(string s) => !string.IsNullOrEmpty(s) && (s.Contains("USDC",StringComparison.OrdinalIgnoreCase)||s.Contains("USDT",StringComparison.OrdinalIgnoreCase)||s.Contains("DAI",StringComparison.OrdinalIgnoreCase)||s.Contains("USD",StringComparison.OrdinalIgnoreCase));
        private static bool IsWeth(string sym,string addr) => sym.Equals("WETH",StringComparison.OrdinalIgnoreCase) || addr.Equals("0x4200000000000000000000000000000000000006",StringComparison.OrdinalIgnoreCase);
        private static decimal ScaleToken(BigInteger v,int d){ if(v==0) return 0; var pow=(decimal)Math.Pow(10,d); if(pow==0) pow=1; if(v>(BigInteger)decimal.MaxValue) v=(BigInteger)decimal.MaxValue; return (decimal)v/pow; }
        private static decimal TickToPrice(int tick,int d0,int d1)=> (decimal)(Math.Pow(1.0001,tick)*Math.Pow(10,d0-d1));

        public Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(IEnumerable<BigInteger> positionTokenIds) => GetActivePoolsOnChainAsync(positionTokenIds, false);
        public async Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(IEnumerable<BigInteger> positionTokenIds, bool onlyOpenPositions)
        {
            var ctx = GetContext(ChainEnum.Base);
            return await BuildFromIds(ctx, positionTokenIds, onlyOpenPositions);
        }

        public async Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(IEnumerable<BigInteger> positionTokenIds, ChainEnum chain, bool onlyOpenPositions)
        {
            var ctx = GetContext(chain);
            return await BuildFromIds(ctx, positionTokenIds, onlyOpenPositions);
        }

        public Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(string ownerAddress) => GetActivePoolsOnChainAsync(ownerAddress, false, ChainEnum.Base);
        public Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(string ownerAddress, bool onlyOpenPositions) => GetActivePoolsOnChainAsync(ownerAddress, onlyOpenPositions, ChainEnum.Base);

        public async Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(string ownerAddress, bool onlyOpenPositions, ChainEnum chain)
        {
            var ctx = GetContext(chain);
            var h = ctx.Web3.Eth.GetContractHandler(ctx.PositionManager);
            var resp = new UniswapV3GetActivePoolsResponse();
            try
            {
                var bal = await h.QueryAsync<BalanceOfFunction, BigInteger>(new BalanceOfFunction { Owner = ownerAddress });
                if (bal == 0) { resp.Data.Bundles.Add(new UniswapV3Bundle { NativePriceUSD = "0" }); return resp; }
                var ids = new List<BigInteger>();
                for (BigInteger i = 0; i < bal && i < 50; i++)
                { try { ids.Add(await h.QueryAsync<TokenOfOwnerByIndexFunction, BigInteger>(new TokenOfOwnerByIndexFunction { Owner = ownerAddress, Index = i })); } catch { break; } }
                return await BuildFromIds(ctx, ids, onlyOpenPositions);
            }
            catch { resp.Data.Bundles.Add(new UniswapV3Bundle { NativePriceUSD = "0" }); return resp; }
        }

        private async Task<UniswapV3GetActivePoolsResponse> BuildFromIds(ChainContext ctx, IEnumerable<BigInteger> ids, bool onlyOpen)
        {
            var resp = new UniswapV3GetActivePoolsResponse();
            if (ids == null) { resp.Data.Bundles.Add(new UniswapV3Bundle { NativePriceUSD = "0" }); return resp; }
            double nativePrice = 0d;

            var chainlinkPriceTask = TryGetNativeUsdFromChainlinkAsync(ctx);
            
            foreach (var id in ids)
            {
                var pos = await TryGetPositionAsync(ctx, id); 
                if (pos == null) 
                { 
                    _logger.LogWarning("Skipping position {TokenId} on chain {Chain}: position not found", id, ctx.Chain);
                    continue; 
                }
                
                if (onlyOpen && pos.Liquidity == 0) 
                { 
                    _logger.LogDebug("Skipping position {TokenId} on chain {Chain}: zero liquidity", id, ctx.Chain);
                    continue; 
                }

                _logger.LogDebug("Processing position {TokenId} token0={Token0} token1={Token1} fee={Fee} L={Liquidity} ticks=[{TL},{TU}]", id, pos.Token0, pos.Token1, pos.Fee, pos.Liquidity, pos.TickLower, pos.TickUpper);
                var pool = await ResolvePoolAsync(ctx, pos.Token0, pos.Token1, pos.Fee);
                if (string.IsNullOrEmpty(pool))
                {
                    _logger.LogWarning("Pool not resolved for position {TokenId} token0={Token0} token1={Token1} fee={Fee}", id, pos.Token0, pos.Token1, pos.Fee);
                }
                var meta0Task = GetErc20MetadataAsync(ctx, pos.Token0);
                var meta1Task = GetErc20MetadataAsync(ctx, pos.Token1);
                var slot0Task = string.IsNullOrEmpty(pool) ? Task.FromResult<Slot0OutputDTO?>(null) : TryGetSlot0Async(ctx, pool);
                var feeGrowthTask = string.IsNullOrEmpty(pool) ? Task.FromResult<(BigInteger, BigInteger)?>(null) : TryGetFeeGrowthAsync(ctx, pool);
                Task<TickInfoDTO?> lowerTickTask = Task.FromResult<TickInfoDTO?>(null);
                Task<TickInfoDTO?> upperTickTask = Task.FromResult<TickInfoDTO?>(null);
                
                if (!string.IsNullOrEmpty(pool))
                {
                    lowerTickTask = GetTickInfoSafeAsync(ctx, pool, pos.TickLower);
                    upperTickTask = GetTickInfoSafeAsync(ctx, pool, pos.TickUpper);
                }
                
                await Task.WhenAll(meta0Task, meta1Task, slot0Task, feeGrowthTask, lowerTickTask, upperTickTask);
                
                var (sym0, name0, dec0) = meta0Task.Result; 
                var (sym1, name1, dec1) = meta1Task.Result;
                var slot0 = slot0Task.Result; 
                var fg = feeGrowthTask.Result; 
                var lowerTickInfo = lowerTickTask.Result; 
                var upperTickInfo = upperTickTask.Result;

                if (slot0 == null)
                {
                    _logger.LogWarning("Slot0 missing for position {TokenId} pool={Pool}", id, pool);
                }
                if (fg == null)
                {
                    _logger.LogWarning("Fee growth missing for position {TokenId} pool={Pool}", id, pool);
                }
                if (lowerTickInfo == null || upperTickInfo == null)
                {
                    _logger.LogWarning("Tick info missing for position {TokenId} lowerNull={LowerNull} upperNull={UpperNull}", id, lowerTickInfo == null, upperTickInfo == null);
                }
                else
                {
                    _logger.LogTrace("Tick outside snapshot pos={TokenId} lowerGross={LG} lowerNet={LN} lowerFG0={L0} lowerFG1={L1} upperGross={UG} upperNet={UN} upperFG0={U0} upperFG1={U1}", id,
                        lowerTickInfo.LiquidityGross, lowerTickInfo.LiquidityNet, lowerTickInfo.FeeGrowthOutside0X128, lowerTickInfo.FeeGrowthOutside1X128,
                        upperTickInfo.LiquidityGross, upperTickInfo.LiquidityNet, upperTickInfo.FeeGrowthOutside0X128, upperTickInfo.FeeGrowthOutside1X128);
                }
                
                int currTick = slot0?.Tick ?? 0;
                var (amt0, amt1, branch) = ComputePositionAmountsPrecise(pos.Liquidity, pos.TickLower, pos.TickUpper, slot0?.SqrtPriceX96 ?? 0, currTick, dec0, dec1);
                _logger.LogTrace("Position amounts pos={TokenId} branch={Branch} amount0={Amt0} amount1={Amt1}", id, branch, amt0, amt1);

                decimal finalOwed0 = ScaleToken(pos.TokensOwed0, dec0); 
                decimal finalOwed1 = ScaleToken(pos.TokensOwed1, dec1);
                
                _logger.LogDebug("[OnChain Fees] Position {TokenId} - Initial TokensOwed0={Owed0}, TokensOwed1={Owed1} (scaled: {S0}, {S1})",
                    id, pos.TokensOwed0, pos.TokensOwed1, finalOwed0, finalOwed1);
                
                if (fg != null)
                {
                    try
                    {
                        _logger.LogDebug("[OnChain Fees] Position {TokenId} - Calculating uncollected fees with FeeGrowthGlobal0={FG0}, FeeGrowthGlobal1={FG1}",
                            id, fg.Value.Item1, fg.Value.Item2);
                        
                        var uncollected = new UncollectedFees().CalculateUncollectedFees(
                            pos,
                            fg.Value.Item1,
                            fg.Value.Item2,
                            dec0,
                            dec1,
                            currTick,
                            lowerTickInfo,
                            upperTickInfo,
                            _logger);
                            
                        _logger.LogDebug("[OnChain Fees] Position {TokenId} - Calculated uncollected fees: Amount0={A0}, Amount1={A1} (was {O0}, {O1})",
                            id, uncollected.Amount0, uncollected.Amount1, finalOwed0, finalOwed1);
                            
                        finalOwed0 = uncollected.Amount0;
                        finalOwed1 = uncollected.Amount1;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to calculate uncollected fees for position {TokenId} on chain {Chain}", id, ctx.Chain);
                    }
                }
                else
                {
                    _logger.LogWarning("[OnChain Fees] Position {TokenId} - FeeGrowth data not available, using raw TokensOwed only", id);
                }

                _logger.LogDebug("UNI-V3 FEES TRACE pos={Pos} pool={Pool} token0={Sym0} token1={Sym1} dec=[{D0},{D1}] tickCurrent={Tick} range=[{TL},{TU}] fg0={FG0} fg1={FG1} feeInsideLast0={FIL0} feeInsideLast1={FIL1} owedRaw0={Raw0} owedRaw1={Raw1} finalOwed0={Final0} finalOwed1={Final1}",
                    id, pool, sym0, sym1, dec0, dec1, currTick, pos.TickLower, pos.TickUpper,
                    fg?.Item1, fg?.Item2, pos.FeeGrowthInside0LastX128, pos.FeeGrowthInside1LastX128,
                    pos.TokensOwed0, pos.TokensOwed1, finalOwed0, finalOwed1);

                string derived0 = "0", derived1 = "0";
                try
                {
                    double ratio = 0d;
                    if (slot0?.SqrtPriceX96 > 0)
                    {
                        var sqrt = (double)slot0.SqrtPriceX96 / Math.Pow(2, 96);
                        ratio = sqrt * sqrt * Math.Pow(10d, dec0 - dec1);
                    }
                    bool t0W = IsWeth(sym0, pos.Token0); bool t1W = IsWeth(sym1, pos.Token1);
                    bool t0S = IsStable(sym0); bool t1S = IsStable(sym1);

                    if (nativePrice <= 0 && slot0 != null && (t0W ^ t1W) && (t0S || t1S))
                    {
                        if (ratio > 0)
                            nativePrice = t0W ? ratio : (ratio == 0 ? 0 : 1d / ratio);
                    }

                    if (nativePrice <= 0)
                    {
                        var chainlink = await chainlinkPriceTask;
                        if (chainlink.HasValue && chainlink.Value > 0)
                        {
                            nativePrice = chainlink.Value;
                            _logger.LogDebug("Using Chainlink price fallback for chain {Chain}: ${Price}", ctx.Chain, nativePrice);
                        }
                    }

                    if (t0W)
                    {
                        derived0 = "1";
                        if (ratio > 0) derived1 = (1d / ratio).ToString("G17");
                    }
                    else if (t1W)
                    {
                        derived1 = "1";
                        if (ratio > 0) derived0 = ratio.ToString("G17");
                    }
                    else if (nativePrice > 0 && ratio > 0 && (t0S || t1S))
                    {
                        if (t0S)
                        {
                            derived0 = (1d / nativePrice).ToString("G17");
                            derived1 = (1d / (ratio * nativePrice)).ToString("G17");
                        }
                        else if (t1S)
                        {
                            derived1 = (1d / nativePrice).ToString("G17");
                            derived0 = (ratio / nativePrice).ToString("G17");
                        }
                    }
                }
                catch (Exception exPrice)
                {
                    _logger.LogWarning(exPrice, "Failed to calculate token prices for position {TokenId} on chain {Chain}", id, ctx.Chain);
                }

                var minPrice = TickToPrice(pos.TickLower, dec0, dec1).ToString("G17");
                var maxPrice = TickToPrice(pos.TickUpper, dec0, dec1).ToString("G17");
                var currentPrice = TickToPrice(currTick, dec0, dec1).ToString("G17");
                string rangeStatus = currTick < pos.TickLower ? "below" : (currTick > pos.TickUpper ? "above" : "in-range");

                resp.Data.Positions.Add(new UniswapV3Position
                {
                    Id = id.ToString(),
                    Liquidity = pos.Liquidity.ToString(),
                    DepositedToken0 = amt0.ToString("G17"),
                    DepositedToken1 = amt1.ToString("G17"),
                    WithdrawnToken0 = "0",
                    WithdrawnToken1 = "0",
                    CollectedFeesToken0 = "0", // RPC doesn't provide historical collected fees
                    CollectedFeesToken1 = "0", // RPC doesn't provide historical collected fees
                    FeeGrowthInside0LastX128 = pos.FeeGrowthInside0LastX128.ToString(),
                    FeeGrowthInside1LastX128 = pos.FeeGrowthInside1LastX128.ToString(),
                    TickLower = pos.TickLower,
                    TickUpper = pos.TickUpper,
                    RangeStatus = rangeStatus,
                    MinPriceToken1PerToken0 = minPrice,
                    MaxPriceToken1PerToken0 = maxPrice,
                    CurrentPriceToken1PerToken0 = currentPrice,
                    Token0 = new UniswapV3Token { Id = pos.Token0, TokenAddress = pos.Token0, Symbol = sym0, Name = name0, Decimals = dec0.ToString(), DerivedNative = derived0, FeesUSD = "0" },
                    Token1 = new UniswapV3Token { Id = pos.Token1, TokenAddress = pos.Token1, Symbol = sym1, Name = name1, Decimals = dec1.ToString(), DerivedNative = derived1, FeesUSD = "0" },
                    Pool = new UniswapV3Pool { Id = pool, FeeTier = pos.Fee.ToString(), Liquidity = pos.Liquidity.ToString(), FeeGrowthGlobal0X128 = (fg?.Item1 ?? 0).ToString(), FeeGrowthGlobal1X128 = (fg?.Item2 ?? 0).ToString(), Tick = currTick.ToString(), SqrtPriceX96 = (slot0?.SqrtPriceX96 ?? 0).ToString() },
                    RawTokensOwed0 = pos.TokensOwed0.ToString(),
                    RawTokensOwed1 = pos.TokensOwed1.ToString(),
                    EstimatedUncollectedToken0 = finalOwed0.ToString("G17"),
                    EstimatedUncollectedToken1 = finalOwed1.ToString("G17")
                });
            }

            if (nativePrice <= 0)
            {
                var chainlink = await chainlinkPriceTask;
                if (chainlink.HasValue && chainlink.Value > 0) nativePrice = chainlink.Value;
            }
            
            resp.Data.Bundles.Add(new UniswapV3Bundle { NativePriceUSD = nativePrice > 0 ? nativePrice.ToString("G17") : "0" });
            return resp;
        }

        private async Task<TickInfoDTO?> GetTickInfoSafeAsync(ChainContext ctx, string pool, int tick)
        {
            return await ExecuteWithRetryAsync(async () =>
            {
                try
                {
                    var result = await ctx.Web3.Eth.GetContractHandler(pool)
                        .QueryDeserializingToObjectAsync<TicksFunction, TickInfoDTO>(new TicksFunction { Tick = tick }, null);
                    _logger.LogTrace("ticks() success pool={Pool} tick={Tick} liquidityGross={Gross} liquidityNet={Net} fg0Outside={FG0} fg1Outside={FG1}", pool, tick, result?.LiquidityGross, result?.LiquidityNet, result?.FeeGrowthOutside0X128, result?.FeeGrowthOutside1X128);
                    return result;
                }
                catch (Exception ex) when (IsTransientError(ex))
                {
                    _logger.LogDebug(ex, "Transient error in GetTickInfoSafeAsync pool={Pool} tick={Tick}, will retry", pool, tick);
                    throw;
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "ticks() call failed pool={Pool} tick={Tick}", pool, tick);
                    return null;
                }
            }, $"GetTickInfoSafeAsync(pool={pool}, tick={tick})") ?? null;
        }

        private ChainContext BaseCtx => GetContext(ChainEnum.Base);
        public async Task<PositionDTO> GetPositionAsync(BigInteger tokenId) => await TryGetPositionAsync(BaseCtx, tokenId) ?? new PositionDTO();
        public async Task<BigInteger> GetFeeGrowthGlobal0X128Async(string poolAddress) => (await TryGetFeeGrowthAsync(BaseCtx, poolAddress))?.Item1 ?? 0;
        public async Task<BigInteger> GetFeeGrowthGlobal1X128Async(string poolAddress) => (await TryGetFeeGrowthAsync(BaseCtx, poolAddress))?.Item2 ?? 0;
        public async Task<(BigInteger feeGrowthGlobal0, BigInteger feeGrowthGlobal1)> GetPoolFeeGrowthAsync(string poolAddress) { var fg = await TryGetFeeGrowthAsync(BaseCtx, poolAddress); return fg ?? (0,0); }
        public async Task<int> GetCurrentTickAsync(string poolAddress) => (await TryGetSlot0Async(BaseCtx, poolAddress))?.Tick ?? 0;
        public async Task<TickInfoDTO> GetTickInfoAsync(string poolAddress, int tick)
        {
            try { return await BaseCtx.Web3.Eth.GetContractHandler(poolAddress).QueryDeserializingToObjectAsync<TicksFunction, TickInfoDTO>(new TicksFunction { Tick = tick }); } catch { return new TickInfoDTO(); }
        }
        public async Task<(TickInfoDTO lowerTick, TickInfoDTO upperTick)> GetTickRangeInfoAsync(string poolAddress, int tickLower, int tickUpper)
        { var l=await GetTickInfoAsync(poolAddress,tickLower); var u=await GetTickInfoAsync(poolAddress,tickUpper); return (l,u); }
        public async Task<UniswapV3PoolMetadata?> GetPoolMetadataAsync(string poolAddress)
        { try { var h=BaseCtx.Web3.Eth.GetContractHandler(poolAddress); var t0=await h.QueryAsync<Token0Function,string>(new()); var t1=await h.QueryAsync<Token1Function,string>(new()); var fee=await h.QueryAsync<FeeFunction,uint>(new()); return new UniswapV3PoolMetadata(poolAddress,t0,t1,fee,null,DateTimeOffset.UtcNow.ToUnixTimeSeconds()); } catch { return null; }
        }
        public async Task<UniswapV3PoolState?> GetCurrentPoolStateAsync(string poolAddress)
        { var slot=await TryGetSlot0Async(BaseCtx,poolAddress); var fg=await TryGetFeeGrowthAsync(BaseCtx,poolAddress); if(slot==null||fg==null) return null; return new UniswapV3PoolState(poolAddress,DateTimeOffset.UtcNow.ToUnixTimeSeconds(),slot.SqrtPriceX96,slot.Tick,fg.Value.Item1,fg.Value.Item2); }
        public async Task<PositionRangeInfo> GetPositionRangeAsync(BigInteger positionTokenId)
        { var pos=await GetPositionAsync(positionTokenId); var ctx=BaseCtx; var pool=await ResolvePoolAsync(ctx,pos.Token0,pos.Token1,pos.Fee); var slot=await TryGetSlot0Async(ctx,pool); int currentTick=slot?.Tick??0; var min=TickToPrice(pos.TickLower,0,0); var max=TickToPrice(pos.TickUpper,0,0); var cur=TickToPrice(currentTick,0,0); var status=currentTick<pos.TickLower?"below":(currentTick>pos.TickUpper?"above":"in-range"); return new PositionRangeInfo(positionTokenId,pool,pos.TickLower,pos.TickUpper,currentTick,min,max,cur,status); }

        public async Task<IEnumerable<BigInteger>> EnumeratePositionIdsAsync(string ownerAddress, ChainEnum chain, bool onlyOpen = true)
        {
            try
            {
                var ctx = GetContext(chain);
                var h = ctx.Web3.Eth.GetContractHandler(ctx.PositionManager);
                var bal = await h.QueryAsync<BalanceOfFunction, BigInteger>(new BalanceOfFunction { Owner = ownerAddress });
                
                if (bal == 0) return Enumerable.Empty<BigInteger>();

                var ids = new List<BigInteger>();
                for (BigInteger i = 0; i < bal && i < 50; i++)
                {
                    try 
                    {
                        var tokenId = await h.QueryAsync<TokenOfOwnerByIndexFunction, BigInteger>(
                            new TokenOfOwnerByIndexFunction { Owner = ownerAddress, Index = i });
                        
                        if (onlyOpen)
                        {
                            var pos = await TryGetPositionAsync(ctx, tokenId);
                            if (pos != null && pos.Liquidity > 0)
                            {
                                ids.Add(tokenId);
                            }
                        }
                        else
                        {
                            ids.Add(tokenId);
                        }
                    } 
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to get tokenId at index {Index} for owner {Owner}", i, ownerAddress);
                        break;
                    }
                }
                
                return ids;
            }
            catch (Exception ex) when (ex.GetType().Name == "RpcClientTimeoutException" || ex is TaskCanceledException)
            {
                // Timeout/cancellation - propagate to allow retry logic in worker
                _logger.LogError(ex, "RPC timeout while enumerating positions for owner {Owner} on chain {Chain}", ownerAddress, chain);
                throw;
            }
            catch (Exception ex)
            {
                // Other errors (contract not found, invalid address, etc.) - log and return empty
                // This is expected for wallets that don't have Uniswap positions
                _logger.LogWarning(ex, "Failed to enumerate positions for owner {Owner} on chain {Chain}, returning empty", ownerAddress, chain);
                return Enumerable.Empty<BigInteger>();
            }
        }

        public async Task<PositionDataResult> GetPositionDataSafeAsync(BigInteger tokenId, ChainEnum chain)
        {
            try
            {
                var ctx = GetContext(chain);
                var position = await TryGetPositionAsync(ctx, tokenId);
                
                if (position == null)
                {
                    return PositionDataResult.CreateFailure(tokenId, "Position not found or inaccessible");
                }

                if (string.IsNullOrEmpty(position.Token0) || string.IsNullOrEmpty(position.Token1))
                {
                    return PositionDataResult.CreateFailure(tokenId, "Position has invalid token addresses");
                }

                string? poolAddress = null;
                try
                {
                    poolAddress = await ResolvePoolAsync(ctx, position.Token0, position.Token1, position.Fee);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to resolve pool address for tokenId {TokenId}", tokenId);
                }

                _logger.LogInformation("[GetPositionDataSafe] TokenId={TokenId} returning TokensOwed0={Owed0}, TokensOwed1={Owed1}",
                    tokenId, position.TokensOwed0, position.TokensOwed1);

                return PositionDataResult.CreateSuccess(tokenId, position, poolAddress);
            }
            catch (Exception ex)
            {
                return PositionDataResult.CreateFailure(tokenId, ex.Message);
            }
        }

        public async Task<PositionDataResult> GetPositionWithCalculatedFeesAsync(BigInteger tokenId, ChainEnum chain)
        {
            try
            {
                var ctx = GetContext(chain);
                var position = await TryGetPositionAsync(ctx, tokenId);
                
                if (position == null)
                {
                    return PositionDataResult.CreateFailure(tokenId, "Position not found or inaccessible");
                }

                if (string.IsNullOrEmpty(position.Token0) || string.IsNullOrEmpty(position.Token1))
                {
                    return PositionDataResult.CreateFailure(tokenId, "Position has invalid token addresses");
                }

                string? poolAddress = null;
                try
                {
                    poolAddress = await ResolvePoolAsync(ctx, position.Token0, position.Token1, position.Fee);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to resolve pool address for tokenId {TokenId}", tokenId);
                }

                // Calculate uncollected fees if position has liquidity
                if (position.Liquidity > 0 && !string.IsNullOrEmpty(poolAddress))
                {
                    try
                    {
                        _logger.LogDebug("[GetPositionWithCalculatedFees] Calculating uncollected fees for position {TokenId}", tokenId);
                        
                        // Get token metadata for decimals
                        var meta0Task = GetErc20MetadataAsync(ctx, position.Token0);
                        var meta1Task = GetErc20MetadataAsync(ctx, position.Token1);
                        var slot0Task = TryGetSlot0Async(ctx, poolAddress);
                        var feeGrowthTask = TryGetFeeGrowthAsync(ctx, poolAddress);
                        
                        await Task.WhenAll(meta0Task, meta1Task, slot0Task, feeGrowthTask);
                        
                        var (sym0, name0, dec0) = await meta0Task;
                        var (sym1, name1, dec1) = await meta1Task;
                        var slot0 = await slot0Task;
                        var fg = await feeGrowthTask;
                        
                        if (fg != null && slot0 != null)
                        {
                            // Get tick data
                            var lowerTickTask = GetTickInfoSafeAsync(ctx, poolAddress, position.TickLower);
                            var upperTickTask = GetTickInfoSafeAsync(ctx, poolAddress, position.TickUpper);
                            await Task.WhenAll(lowerTickTask, upperTickTask);
                            
                            var lowerTickInfo = await lowerTickTask;
                            var upperTickInfo = await upperTickTask;
                            
                            int currTick = slot0.Tick;
                            
                            _logger.LogDebug("[GetPositionWithCalculatedFees] Position {TokenId} - FeeGrowthGlobal0={FG0}, FeeGrowthGlobal1={FG1}, CurrentTick={Tick}",
                                tokenId, fg.Value.Item1, fg.Value.Item2, currTick);
                            
                            // Calculate uncollected fees
                            var uncollected = new UncollectedFees().CalculateUncollectedFees(
                                position,
                                fg.Value.Item1,
                                fg.Value.Item2,
                                dec0,
                                dec1,
                                currTick,
                                lowerTickInfo,
                                upperTickInfo,
                                _logger);
                            
                            _logger.LogInformation("[GetPositionWithCalculatedFees] Position {TokenId} - Calculated fees: Token0={Amount0}, Token1={Amount1}",
                                tokenId, uncollected.Amount0, uncollected.Amount1);
                            
                            // Convert back to raw BigInteger values and update position
                            var divisor0 = (decimal)Math.Pow(10, dec0);
                            var divisor1 = (decimal)Math.Pow(10, dec1);
                            
                            position.TokensOwed0 = (BigInteger)(uncollected.Amount0 * divisor0);
                            position.TokensOwed1 = (BigInteger)(uncollected.Amount1 * divisor1);
                            
                            // Return decimals for proper scaling in the service layer
                            return PositionDataResult.CreateSuccess(tokenId, position, poolAddress, dec0, dec1);
                        }
                        else
                        {
                            _logger.LogWarning("[GetPositionWithCalculatedFees] Position {TokenId} - Missing fee growth or slot0 data, using raw TokensOwed", tokenId);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "[GetPositionWithCalculatedFees] Failed to calculate uncollected fees for position {TokenId}, using raw TokensOwed", tokenId);
                    }
                }

                return PositionDataResult.CreateSuccess(tokenId, position, poolAddress, 0, 0);
            }
            catch (Exception ex)
            {
                return PositionDataResult.CreateFailure(tokenId, ex.Message);
            }
        }

        public async Task<PoolMetadataResult> GetPoolMetadataSafeAsync(string poolAddress, ChainEnum chain)
        {
            try
            {
                if (string.IsNullOrEmpty(poolAddress))
                {
                    return PoolMetadataResult.CreateFailure(poolAddress ?? "null", "Invalid pool address");
                }

                var ctx = GetContext(chain);
                var metadata = await GetPoolMetadataAsync(poolAddress);
                
                if (metadata == null)
                {
                    return PoolMetadataResult.CreateFailure(poolAddress, "Pool metadata not available");
                }

                return PoolMetadataResult.CreateSuccess(poolAddress, metadata);
            }
            catch (Exception ex)
            {
                return PoolMetadataResult.CreateFailure(poolAddress ?? "null", ex.Message);
            }
        }

        public async Task<PoolStateResult> GetPoolStateSafeAsync(string poolAddress, ChainEnum chain)
        {
            try
            {
                if (string.IsNullOrEmpty(poolAddress))
                {
                    return PoolStateResult.CreateFailure(poolAddress ?? "null", "Invalid pool address");
                }

                var ctx = GetContext(chain);
                var state = await GetCurrentPoolStateAsync(poolAddress);
                
                if (state == null)
                {
                    return PoolStateResult.CreateFailure(poolAddress, "Pool state not available");
                }

                return PoolStateResult.CreateSuccess(poolAddress, state);
            }
            catch (Exception ex)
            {
                return PoolStateResult.CreateFailure(poolAddress ?? "null", ex.Message);
            }
        }

        public async Task<TickRangeResult> GetTickRangeSafeAsync(string poolAddress, int tickLower, int tickUpper, ChainEnum chain)
        {
            try
            {
                if (string.IsNullOrEmpty(poolAddress))
                {
                    return TickRangeResult.CreateFailure(poolAddress ?? "null", tickLower, tickUpper, "Invalid pool address");
                }

                var ctx = GetContext(chain);
                var (lowerTick, upperTick) = await GetTickRangeInfoAsync(poolAddress, tickLower, tickUpper);
                
                return TickRangeResult.CreateSuccess(poolAddress, tickLower, tickUpper, lowerTick, upperTick);
            }
            catch (Exception ex)
            {
                return TickRangeResult.CreateFailure(poolAddress ?? "null", tickLower, tickUpper, ex.Message);
            }
        }

        public async Task<TokenMetadataResult> GetTokenMetadataSafeAsync(string tokenAddress, ChainEnum chain)
        {
            try
            {
                if (string.IsNullOrEmpty(tokenAddress))
                {
                    return TokenMetadataResult.CreateFailure(tokenAddress ?? "null", "Invalid token address");
                }

                var ctx = GetContext(chain);
                var (symbol, name, decimals) = await GetErc20MetadataAsync(ctx, tokenAddress);

                return TokenMetadataResult.CreateSuccess(tokenAddress, symbol, name, decimals);
            }
            catch (Exception ex)
            {
                return TokenMetadataResult.CreateFailure(tokenAddress ?? "null", ex.Message);
            }
        }
    }
}