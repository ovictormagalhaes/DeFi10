using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.ABI;
using Nethereum.Contracts;
using Nethereum.Util;
using Nethereum.Web3;
using Nethereum.Hex.HexConvertors.Extensions;
using System.Numerics;
using ChainEnum = MyWebWallet.API.Models.Chain;
using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace MyWebWallet.API.Services
{
    #region DTO / Function / Event Definitions (unchanged)
    [FunctionOutput]
    public class PositionDTO : IFunctionOutputDTO
    {
        [Parameter("uint96", "nonce", 1)]
        public BigInteger Nonce { get; set; }
        [Parameter("address", "operator", 2)]
        public string Operator { get; set; } = string.Empty;
        [Parameter("address", "token0", 3)]
        public string Token0 { get; set; } = string.Empty;
        [Parameter("address", "token1", 4)]
        public string Token1 { get; set; } = string.Empty;
        [Parameter("uint24", "fee", 5)]
        public uint Fee { get; set; }
        [Parameter("int24", "tickLower", 6)]
        public int TickLower { get; set; }
        [Parameter("int24", "tickUpper", 7)]
        public int TickUpper { get; set; }
        [Parameter("uint128", "liquidity", 8)]
        public BigInteger Liquidity { get; set; }
        [Parameter("uint256", "feeGrowthInside0LastX128", 9)]
        public BigInteger FeeGrowthInside0LastX128 { get; set; }
        [Parameter("uint256", "feeGrowthInside1LastX128", 10)]
        public BigInteger FeeGrowthInside1LastX128 { get; set; }
        [Parameter("uint128", "tokensOwed0", 11)]
        public BigInteger TokensOwed0 { get; set; }
        [Parameter("uint128", "tokensOwed1", 12)]
        public BigInteger TokensOwed1 { get; set; }
    }
    [Function("positions", typeof(PositionDTO))]
    public class PositionsFunction : FunctionMessage
    {
        [Parameter("uint256", "tokenId", 1)]
        public BigInteger TokenId { get; set; }
    }
    [Function("token0", "address")] public class Token0Function : FunctionMessage { }
    [Function("token1", "address")] public class Token1Function : FunctionMessage { }
    [Function("fee", "uint24")] public class FeeFunction : FunctionMessage { }
    [Function("tickSpacing", "int24")] public class TickSpacingFunction : FunctionMessage { }
    [Function("feeGrowthGlobal0X128", "uint256")] public class FeeGrowthGlobal0X128Function : FunctionMessage { }
    [Function("feeGrowthGlobal1X128", "uint256")] public class FeeGrowthGlobal1X128Function : FunctionMessage { }
    [Function("slot0", typeof(Slot0OutputDTO))] public class Slot0Function : FunctionMessage { }
    [FunctionOutput]
    public class Slot0OutputDTO : IFunctionOutputDTO
    {
        [Parameter("uint160", "sqrtPriceX96", 1)] public BigInteger SqrtPriceX96 { get; set; }
        [Parameter("int24", "tick", 2)] public int Tick { get; set; }
    }
    [Function("ticks", typeof(TickInfoDTO))] public class TicksFunction : FunctionMessage { [Parameter("int24", "tick", 1)] public int Tick { get; set; } }
    [FunctionOutput]
    public class TickInfoDTO : IFunctionOutputDTO
    {
        [Parameter("uint128", "liquidityGross", 1)] public BigInteger LiquidityGross { get; set; }
        [Parameter("int128", "liquidityNet", 2)] public BigInteger LiquidityNet { get; set; }
        [Parameter("uint256", "feeGrowthOutside0X128", 3)] public BigInteger FeeGrowthOutside0X128 { get; set; }
        [Parameter("uint256", "feeGrowthOutside1X128", 4)] public BigInteger FeeGrowthOutside1X128 { get; set; }
    }
    [Event("PoolCreated")] public class PoolCreatedEventDTO : IEventDTO { [Parameter("address","token0",1,true)] public string Token0 {get;set;} [Parameter("address","token1",2,true)] public string Token1 {get;set;} [Parameter("uint24","fee",3,false)] public uint Fee {get;set;} [Parameter("int24","tickSpacing",4,false)] public int TickSpacing {get;set;} [Parameter("address","pool",5,true)] public string Pool {get;set;} }
    [Function("balanceOf","uint256")] public class BalanceOfFunction : FunctionMessage { [Parameter("address","owner",1)] public string Owner {get;set;} }
    [Function("tokenOfOwnerByIndex","uint256")] public class TokenOfOwnerByIndexFunction : FunctionMessage { [Parameter("address","owner",1)] public string Owner {get;set;} [Parameter("uint256","index",2)] public BigInteger Index {get;set;} }
    [Function("decimals","uint8")] public class ERC20DecimalsFunction : FunctionMessage { }
    [Function("symbol","string")] public class ERC20SymbolFunction : FunctionMessage { }
    [Function("name","string")] public class ERC20NameFunction : FunctionMessage { }
    [Function("getPool","address")] public class GetPoolFunction : FunctionMessage { [Parameter("address","token0",1)] public string Token0 {get;set;} [Parameter("address","token1",2)] public string Token1 {get;set;} [Parameter("uint24","fee",3)] public uint Fee {get;set;} }
    #endregion

    public class UniswapV3OnChainService : IUniswapV3OnChainService
    {
        // Chainlink Aggregator (only fields we need)
        [Function("latestRoundData", typeof(LatestRoundDataOutputDTO))]
        private class LatestRoundDataFunction : FunctionMessage { }
        [FunctionOutput]
        private class LatestRoundDataOutputDTO : IFunctionOutputDTO
        {
            [Parameter("uint80","roundId",1)] public BigInteger RoundId { get; set; }
            [Parameter("int256","answer",2)] public BigInteger Answer { get; set; }
            [Parameter("uint256","startedAt",3)] public BigInteger StartedAt { get; set; }
            [Parameter("uint256","updatedAt",4)] public BigInteger UpdatedAt { get; set; }
            [Parameter("uint80","answeredInRound",5)] public BigInteger AnsweredInRound { get; set; }
        }

        private async Task<double?> TryGetNativeUsdFromChainlinkAsync(ChainContext ctx)
        {
            try
            {
                // Allow configuration override per chain: Chainlink:<Chain>:EthUsd (e.g. Chainlink:Base:EthUsd)
                string configured = _configuration[$"Chainlink:{ctx.Chain}:EthUsd"]
                                     ?? _configuration[$"Chainlink:{ctx.Chain}:ETHUSD"]
                                     ?? _configuration[$"Chainlink:{ctx.Chain}:EthUSD:Aggregator"];

                string aggregator = configured ?? ctx.Chain switch
                {
                    // Keep Arbitrum hard-coded fallback (ETH / USD 8 decimals)
                    ChainEnum.Arbitrum => "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
                    // For Base we require config unless a verified address is supplied later
                    // (avoid hard-coding possibly stale or incorrect feed address)
                    ChainEnum.Base => string.Empty,
                    _ => string.Empty
                };

                if (string.IsNullOrWhiteSpace(aggregator))
                {
                    Console.WriteLine($"CHAINLINK_NATIVE_PRICE_SKIP: chain={ctx.Chain} reason=no-aggregator-configured");
                    return null;
                }

                var handler = ctx.Web3.Eth.GetContractHandler(aggregator);
                var data = await handler.QueryDeserializingToObjectAsync<LatestRoundDataFunction, LatestRoundDataOutputDTO>(new LatestRoundDataFunction());
                if (data == null)
                {
                    Console.WriteLine($"CHAINLINK_NATIVE_PRICE_WARN: chain={ctx.Chain} reason=null-response");
                    return null;
                }
                var answer = data.Answer;
                if (answer <= 0)
                {
                    Console.WriteLine($"CHAINLINK_NATIVE_PRICE_WARN: chain={ctx.Chain} reason=non-positive-answer value={answer}");
                    return null;
                }
                // ETH / USD feeds use 8 decimals
                double val = (double)answer / Math.Pow(10, 8);
                Console.WriteLine($"CHAINLINK_NATIVE_PRICE: chain={ctx.Chain} priceUSD={val:G17} source={(configured!=null?"config":"default")}");
                return val;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"CHAINLINK_NATIVE_PRICE_WARN: chain={ctx.Chain} msg={ex.Message}");
                return null;
            }
        }

        private readonly IConfiguration _configuration;
        private readonly ILogger<UniswapV3OnChainService> _logger;
        private const string BASE_FACTORY_ADDRESS = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
        private const string BASE_POSITION_MANAGER_ADDRESS = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
        private const string ARBITRUM_FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
        private const string ARBITRUM_POSITION_MANAGER_ADDRESS = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

        private sealed record ChainContext(ChainEnum Chain, Web3 Web3, string PositionManager, string Factory, string PoolInitCodeHash);
        private readonly ConcurrentDictionary<ChainEnum, ChainContext> _contexts = new();

        public UniswapV3OnChainService(IConfiguration configuration, ILogger<UniswapV3OnChainService> logger)
        {
            _configuration = configuration;
            _logger = logger;
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
            Console.WriteLine($"INFO: UniswapV3OnChainService: Created ctx chain={chain} rpc={rpc} pm={pm} factory={factory}");
            return new(chain, new Web3(rpc), pm, factory, init);
        }

        private static string Normalize(string? a) 
        {
            if (string.IsNullOrEmpty(a)) 
                return "0x0000000000000000000000000000000000000000"; // endereço zero como fallback
            
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
                return ("0x" + hash[^40..]).ToLowerInvariant();
            }
            catch { return string.Empty; }
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
                return pool.ToLowerInvariant();
            }
            catch { return string.Empty; }
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
            catch { return (string.Empty, string.Empty, 0); }
        }

        private async Task<PositionDTO?> TryGetPositionAsync(ChainContext ctx, BigInteger id)
        {
            try
            {
                // Get position details from contract
                var positionResult = await ctx.Web3.Eth.GetContractHandler(ctx.PositionManager)
                    .QueryDeserializingToObjectAsync<PositionsFunction, PositionDTO>(new PositionsFunction { TokenId = id });
                
                if (positionResult == null)
                {
                    Console.WriteLine($"WARNING: position {id} chain={ctx.Chain} failed: Position not found");
                    return null;
                }

                return positionResult;
            }
            catch (Exception ex) when (ex.Message.Contains("Invalid token ID") || ex.Message.Contains("ERC721: owner query"))
            {
                Console.WriteLine($"WARNING: position {id} chain={ctx.Chain} failed: {ex.Message}");
                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: position {id} chain={ctx.Chain} failed with exception: {ex.Message}");
                throw;
            }
        }

        private async Task<Slot0OutputDTO?> TryGetSlot0Async(ChainContext ctx, string pool)
        {
            try { return await ctx.Web3.Eth.GetContractHandler(pool).QueryDeserializingToObjectAsync<Slot0Function, Slot0OutputDTO>(new()); }
            catch { return null; }
        }

        private async Task<(BigInteger fg0, BigInteger fg1)?> TryGetFeeGrowthAsync(ChainContext ctx, string pool)
        {
            try
            {
                var h = ctx.Web3.Eth.GetContractHandler(pool);
                var t0 = h.QueryAsync<FeeGrowthGlobal0X128Function, BigInteger>(new());
                var t1 = h.QueryAsync<FeeGrowthGlobal1X128Function, BigInteger>(new());
                await Task.WhenAll(t0, t1);
                return (await t0, await t1);
            }
            catch { return null; }
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

        // Interface: tokenId list (Base default)
        public Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(IEnumerable<BigInteger> positionTokenIds) => GetActivePoolsOnChainAsync(positionTokenIds, false);
        public async Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(IEnumerable<BigInteger> positionTokenIds, bool onlyOpenPositions)
        {
            var ctx = GetContext(ChainEnum.Base);
            return await BuildFromIds(ctx, positionTokenIds, onlyOpenPositions);
        }

        // Interface: owner (Base default wrappers)
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
            
            // Pre-fetch Chainlink price fallback (only if chain supports and we have any ids)
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

                var pool = await ResolvePoolAsync(ctx, pos.Token0, pos.Token1, pos.Fee);
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
                
                int currTick = slot0?.Tick ?? 0;
                var (amt0, amt1, branch) = ComputePositionAmountsPrecise(pos.Liquidity, pos.TickLower, pos.TickUpper, slot0?.SqrtPriceX96 ?? 0, currTick, dec0, dec1);

                // Calculate uncollected fees using improved formula with proper logging
                decimal finalOwed0 = ScaleToken(pos.TokensOwed0, dec0); 
                decimal finalOwed1 = ScaleToken(pos.TokensOwed1, dec1);
                
                if (fg != null)
                {
                    try
                    {
                        var uncollected = new UncollectedFees().CalculateUncollectedFees(
                            pos,
                            fg.Value.Item1,
                            fg.Value.Item2,
                            dec0,
                            dec1,
                            currTick,
                            lowerTickInfo,
                            upperTickInfo,
                            _logger); // Pass logger for proper structured logging
                            
                        finalOwed0 = uncollected.Amount0;
                        finalOwed1 = uncollected.Amount1;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to calculate uncollected fees for position {TokenId} on chain {Chain}", id, ctx.Chain);
                        // Keep base values as fallback
                    }
                }

                _logger.LogDebug("Position {TokenId} on chain {Chain} - Liquidity: {Liquidity}, Tick Range: [{TickLower}, {TickUpper}], Current Tick: {CurrentTick}, Fees: [{Fees0}, {Fees1}]",
                    id, ctx.Chain, pos.Liquidity, pos.TickLower, pos.TickUpper, currTick, finalOwed0, finalOwed1);

                // Derive token native ratios (restore previous logic)
                string derived0 = "0", derived1 = "0";
                try
                {
                    double ratio = 0d;
                    if (slot0?.SqrtPriceX96 > 0)
                    {
                        var sqrt = (double)slot0.SqrtPriceX96 / Math.Pow(2, 96); // sqrt(token1/token0)
                        ratio = sqrt * sqrt * Math.Pow(10d, dec0 - dec1); // token1 per token0
                    }
                    bool t0W = IsWeth(sym0, pos.Token0); bool t1W = IsWeth(sym1, pos.Token1);
                    bool t0S = IsStable(sym0); bool t1S = IsStable(sym1);

                    if (nativePrice <= 0 && slot0 != null && (t0W ^ t1W) && (t0S || t1S))
                    {
                        if (ratio > 0)
                            nativePrice = t0W ? ratio : (ratio == 0 ? 0 : 1d / ratio);
                    }

                    // After attempt, still no nativePrice? Use Chainlink fallback
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
                    CollectedFeesToken0 = finalOwed0.ToString("G17"),
                    CollectedFeesToken1 = finalOwed1.ToString("G17"),
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
            
            // If nativePrice still zero, try chainlink fallback result at end (maybe no positions produced ratio)
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
            try
            {
                return await ctx.Web3.Eth.GetContractHandler(pool)
                    .QueryDeserializingToObjectAsync<TicksFunction, TickInfoDTO>(new TicksFunction { Tick = tick }, null);
            }
            catch
            {
                return null;
            }
        }
        // Interface single calls (Base chain default)
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
        
        // Implementações dos novos métodos granulares resilientes
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
                        Console.WriteLine($"WARNING: Failed to get tokenId at index {i} for owner {ownerAddress}: {ex.Message}");
                        break;
                    }
                }
                
                return ids;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: Failed to enumerate positions for owner {ownerAddress}: {ex.Message}");
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

                // Validação extra de campos obrigatórios
                if (string.IsNullOrEmpty(position.Token0) || string.IsNullOrEmpty(position.Token1))
                {
                    return PositionDataResult.CreateFailure(tokenId, "Position has invalid token addresses");
                }

                // Tenta resolver o endereço do pool
                string? poolAddress = null;
                try
                {
                    poolAddress = await ResolvePoolAsync(ctx, position.Token0, position.Token1, position.Fee);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"WARNING: Failed to resolve pool address for tokenId {tokenId}: {ex.Message}");
                }

                return PositionDataResult.CreateSuccess(tokenId, position, poolAddress);
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
                
                // Considera sucesso mesmo se alguns campos estão vazios
                return TokenMetadataResult.CreateSuccess(tokenAddress, symbol, name, decimals);
            }
            catch (Exception ex)
            {
                return TokenMetadataResult.CreateFailure(tokenAddress ?? "null", ex.Message);
            }
        }
    }
}
