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

namespace MyWebWallet.API.Services
{
    [FunctionOutput]
    public class PositionDTO : IFunctionOutputDTO
    {
        [Parameter("uint96", "nonce", 1)]
        public BigInteger Nonce { get; set; }
        [Parameter("address", "operator", 2)]
        public string Operator { get; set; }
        [Parameter("address", "token0", 3)]
        public string Token0 { get; set; }
        [Parameter("address", "token1", 4)]
        public string Token1 { get; set; }
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

    // Added missing basic pool query functions
    [Function("token0", "address")] 
    public class Token0Function : FunctionMessage { }

    [Function("token1", "address")]
    public class Token1Function : FunctionMessage { }

    [Function("fee", "uint24")]
    public class FeeFunction : FunctionMessage { }

    [Function("tickSpacing", "int24")]
    public class TickSpacingFunction : FunctionMessage { }

    [Function("feeGrowthGlobal0X128", "uint256")]
    public class FeeGrowthGlobal0X128Function : FunctionMessage { }

    [Function("feeGrowthGlobal1X128", "uint256")]

    public class FeeGrowthGlobal1X128Function : FunctionMessage { }
    [Function("slot0", typeof(Slot0OutputDTO))]
    public class Slot0Function : FunctionMessage { }

    [FunctionOutput]
    public class Slot0OutputDTO : IFunctionOutputDTO
    {
        [Parameter("uint160", "sqrtPriceX96", 1)]
        public BigInteger SqrtPriceX96 { get; set; }
        [Parameter("int24", "tick", 2)]
        public int Tick { get; set; }
        [Parameter("uint16", "observationIndex", 3)]
        public ushort ObservationIndex { get; set; }
        [Parameter("uint16", "observationCardinality", 4)]
        public ushort ObservationCardinality { get; set; }
        [Parameter("uint16", "observationCardinalityNext", 5)]
        public ushort ObservationCardinalityNext { get; set; }
        [Parameter("uint8", "feeProtocol", 6)]
        public byte FeeProtocol { get; set; }
        [Parameter("bool", "unlocked", 7)]
        public bool Unlocked { get; set; }
    }

    [Function("ticks", typeof(TickInfoDTO))]
    public class TicksFunction : FunctionMessage
    {
        [Parameter("int24", "tick", 1)]
        public int Tick { get; set; }
    }

    [FunctionOutput]
    public class TickInfoDTO : IFunctionOutputDTO
    {
        [Parameter("uint128", "liquidityGross", 1)]
        public BigInteger LiquidityGross { get; set; }
        [Parameter("int128", "liquidityNet", 2)]
        public BigInteger LiquidityNet { get; set; }
        [Parameter("uint256", "feeGrowthOutside0X128", 3)]
        public BigInteger FeeGrowthOutside0X128 { get; set; }
        [Parameter("uint256", "feeGrowthOutside1X128", 4)]
        public BigInteger FeeGrowthOutside1X128 { get; set; }
        [Parameter("int56", "tickCumulativeOutside", 5)]
        public BigInteger TickCumulativeOutside { get; set; }
        [Parameter("uint160", "secondsPerLiquidityOutsideX128", 6)]
        public BigInteger SecondsPerLiquidityOutsideX128 { get; set; }
        [Parameter("uint32", "secondsOutside", 7)]
        public uint SecondsOutside { get; set; }
        [Parameter("bool", "initialized", 8)]
        public bool Initialized { get; set; }
    }

    // Factory event to derive creation timestamp (placeholder - real scan TBD)
    [Event("PoolCreated")]
    public class PoolCreatedEventDTO : IEventDTO
    {
        [Parameter("address", "token0", 1, true)]
        public string Token0 { get; set; } = string.Empty;
        [Parameter("address", "token1", 2, true)]
        public string Token1 { get; set; } = string.Empty;
        [Parameter("uint24", "fee", 3, false)]
        public uint Fee { get; set; }
        [Parameter("int24", "tickSpacing", 4, false)]
        public int TickSpacing { get; set; }
        [Parameter("address", "pool", 5, true)]
        public string Pool { get; set; } = string.Empty;
    }

    [Function("balanceOf", "uint256")] public class BalanceOfFunction : FunctionMessage { [Parameter("address", "owner", 1)] public string Owner { get; set; } }
    [Function("tokenOfOwnerByIndex", "uint256")] public class TokenOfOwnerByIndexFunction : FunctionMessage { [Parameter("address", "owner", 1)] public string Owner { get; set; } [Parameter("uint256", "index", 2)] public BigInteger Index { get; set; } }
    [Function("liquidity", "uint128")] public class PoolLiquidityFunction : FunctionMessage { }

    // ERC20 metadata
    [Function("decimals", "uint8")] public class ERC20DecimalsFunction : FunctionMessage { }
    [Function("symbol", "string")] public class ERC20SymbolFunction : FunctionMessage { }
    [Function("name", "string")] public class ERC20NameFunction : FunctionMessage { }

    [Event("Swap")]
    public class SwapEventDTO : IEventDTO
    {
        [Parameter("address", "sender", 1, true)] public string Sender { get; set; }
        [Parameter("address", "recipient", 2, true)] public string Recipient { get; set; }
        [Parameter("int256", "amount0", 3, false)] public BigInteger Amount0 { get; set; }
        [Parameter("int256", "amount1", 4, false)] public BigInteger Amount1 { get; set; }
        [Parameter("uint160", "sqrtPriceX96", 5, false)] public BigInteger SqrtPriceX96 { get; set; }
        [Parameter("uint128", "liquidity", 6, false)] public BigInteger Liquidity { get; set; }
        [Parameter("int24", "tick", 7, false)] public int Tick { get; set; }
    }

    [Function("getPool", "address")]
    public class GetPoolFunction : FunctionMessage
    {
        [Parameter("address", "token0", 1)] public string Token0 { get; set; } = string.Empty;
        [Parameter("address", "token1", 2)] public string Token1 { get; set; } = string.Empty;
        [Parameter("uint24", "fee", 3)] public uint Fee { get; set; }
    }

    public class UniswapV3OnChainService : IUniswapV3OnChainService
    {
        private readonly Web3 _web3;
        private readonly IConfiguration _configuration;
        private const string BASE_POSITION_MANAGER_ADDRESS = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
        private const string BASE_FACTORY_ADDRESS = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
        private readonly string _poolInitCodeHash; // single definition

        public UniswapV3OnChainService(IConfiguration configuration)
        {
            _configuration = configuration;
            var alchemyApiKey = configuration["Alchemy:ApiKey"];
            var rpcUrl = string.IsNullOrEmpty(alchemyApiKey) ? configuration["Alchemy:BaseRpcUrl"] : MyWebWallet.API.Models.Chain.Base.GetAlchemyRpcUrl(alchemyApiKey);
            _web3 = new Web3(rpcUrl);
            _poolInitCodeHash = (configuration["UniswapV3:PoolInitCodeHash"] ?? "0xe34f4a2e3af081af0d5af2c5d0a8f0d492adefafbd18e23601d79d64c6f3d6f").ToLowerInvariant();
        }

        private static string NormalizeAddress(string addr) => addr.StartsWith("0x") ? addr.ToLowerInvariant() : "0x" + addr.ToLowerInvariant();

        // --- ORIGINAL (fallback) manual computation (may be wrong if init code hash differs) ---
        private string ComputePoolAddress(string tokenA, string tokenB, uint fee)
        {
            try
            {
                tokenA = NormalizeAddress(tokenA); tokenB = NormalizeAddress(tokenB);
                var (token0, token1) = string.CompareOrdinal(tokenA, tokenB) < 0 ? (tokenA, tokenB) : (tokenB, tokenA);
                var encoder = new ABIEncode();
                var saltInput = encoder.GetABIEncodedPacked(new ABIValue("address", token0), new ABIValue("address", token1), new ABIValue("uint24", fee));
                var saltHashHex = Sha3Keccack.Current.CalculateHash(saltInput).ToHex(false);
                if (saltHashHex.StartsWith("0x")) saltHashHex = saltHashHex[2..];
                var factoryNo0x = BASE_FACTORY_ADDRESS[2..];
                var initNo0x = _poolInitCodeHash.StartsWith("0x") ? _poolInitCodeHash[2..] : _poolInitCodeHash;
                var packedHex = "ff" + factoryNo0x + saltHashHex + initNo0x;
                if (!System.Text.RegularExpressions.Regex.IsMatch(packedHex, "^[0-9a-fA-F]+$")) return string.Empty;
                var poolHashHex = Sha3Keccack.Current.CalculateHash(packedHex.HexToByteArray()).ToHex(false);
                if (poolHashHex.StartsWith("0x")) poolHashHex = poolHashHex[2..];
                return ("0x" + poolHashHex[^40..]).ToLowerInvariant();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: ComputePoolAddress failed: {ex.Message}");
                return string.Empty;
            }
        }

        private async Task<string> GetPoolAddressFromFactoryAsync(string tokenA, string tokenB, uint fee)
        {
            try
            {
                var tA = NormalizeAddress(tokenA);
                var tB = NormalizeAddress(tokenB);
                var (token0, token1) = string.CompareOrdinal(tA, tB) < 0 ? (tA, tB) : (tB, tA);
                var handler = _web3.Eth.GetContractHandler(BASE_FACTORY_ADDRESS);
                var pool = await handler.QueryAsync<GetPoolFunction, string>(new GetPoolFunction
                {
                    Token0 = token0,
                    Token1 = token1,
                    Fee = fee
                });
                if (string.IsNullOrWhiteSpace(pool) || pool == "0x0000000000000000000000000000000000000000")
                {
                    Console.WriteLine($"WARNING: Factory getPool returned zero address token0={token0} token1={token1} fee={fee}");
                    return string.Empty;
                }
                // Validate code exists
                var code = await _web3.Eth.GetCode.SendRequestAsync(pool);
                if (string.IsNullOrEmpty(code) || code == "0x")
                {
                    Console.WriteLine($"WARNING: getPool address has no code pool={pool} token0={token0} token1={token1} fee={fee}");
                    return string.Empty;
                }
                Console.WriteLine($"DEBUG: FactoryPool token0={token0} token1={token1} fee={fee} pool={pool}");
                return pool.ToLowerInvariant();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"WARNING: GetPoolAddressFromFactoryAsync failed: {ex.Message}");
                return string.Empty;
            }
        }

        private async Task<string> ResolvePoolAddressAsync(string token0, string token1, uint fee)
        {
            // Try on-chain factory first
            var fromFactory = await GetPoolAddressFromFactoryAsync(token0, token1, fee);
            if (!string.IsNullOrEmpty(fromFactory)) return fromFactory;
            // Fallback to manual computation
            var computed = ComputePoolAddress(token0, token1, fee);
            if (!string.IsNullOrEmpty(computed))
            {
                var code = await _web3.Eth.GetCode.SendRequestAsync(computed);
                if (!string.IsNullOrEmpty(code) && code != "0x")
                {
                    Console.WriteLine($"DEBUG: FallbackComputedPool valid pool={computed}");
                    return computed;
                }
                Console.WriteLine($"WARNING: Fallback computed pool has no code pool={computed}");
            }
            return string.Empty;
        }

        private async Task<string> ResolvePoolAsync(string token0, string token1, uint fee)
        {
            // Reuse existing resolve logic (factory first then compute) already implemented as ResolvePoolAddressAsync
            return await ResolvePoolAddressAsync(token0, token1, fee);
        }

        private async Task<(string symbol, string name, int decimals)> GetErc20MetadataAsync(string tokenAddress)
        {
            try
            {
                var handler = _web3.Eth.GetContractHandler(tokenAddress);
                var decTask = handler.QueryAsync<ERC20DecimalsFunction, byte>(new ERC20DecimalsFunction());
                var symTask = handler.QueryAsync<ERC20SymbolFunction, string>(new ERC20SymbolFunction());
                var nameTask = handler.QueryAsync<ERC20NameFunction, string>(new ERC20NameFunction());
                await Task.WhenAll(decTask, symTask, nameTask);
                return ((await symTask) ?? string.Empty, (await nameTask) ?? string.Empty, (int)await decTask);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"WARNING: ERC20 metadata fetch failed for {tokenAddress}: {ex.Message}");
                return (string.Empty, string.Empty, 0);
            }
        }

        public async Task<PositionDTO> GetPositionAsync(BigInteger tokenId)
        {
            var handler = _web3.Eth.GetContractHandler(BASE_POSITION_MANAGER_ADDRESS);
            return await handler.QueryDeserializingToObjectAsync<PositionsFunction, PositionDTO>(new PositionsFunction { TokenId = tokenId }, null);
        }

        public async Task<BigInteger> GetFeeGrowthGlobal0X128Async(string poolAddress) => await _web3.Eth.GetContractHandler(poolAddress).QueryAsync<FeeGrowthGlobal0X128Function, BigInteger>(new FeeGrowthGlobal0X128Function());
        public async Task<BigInteger> GetFeeGrowthGlobal1X128Async(string poolAddress) => await _web3.Eth.GetContractHandler(poolAddress).QueryAsync<FeeGrowthGlobal1X128Function, BigInteger>(new FeeGrowthGlobal1X128Function());

        public async Task<(BigInteger feeGrowthGlobal0, BigInteger feeGrowthGlobal1)> GetPoolFeeGrowthAsync(string poolAddress)
        {
            var h = _web3.Eth.GetContractHandler(poolAddress);
            var t0 = h.QueryAsync<FeeGrowthGlobal0X128Function, BigInteger>(new FeeGrowthGlobal0X128Function());
            var t1 = h.QueryAsync<FeeGrowthGlobal1X128Function, BigInteger>(new FeeGrowthGlobal1X128Function());
            await Task.WhenAll(t0, t1);
            return (await t0, await t1);
        }

        public async Task<int> GetCurrentTickAsync(string poolAddress)
        {
            var slot0 = await _web3.Eth.GetContractHandler(poolAddress).QueryDeserializingToObjectAsync<Slot0Function, Slot0OutputDTO>(new Slot0Function());
            return slot0?.Tick ?? 0;
        }

        public async Task<TickInfoDTO> GetTickInfoAsync(string poolAddress, int tick) => await _web3.Eth.GetContractHandler(poolAddress).QueryDeserializingToObjectAsync<TicksFunction, TickInfoDTO>(new TicksFunction { Tick = tick }, null);

        public async Task<(TickInfoDTO lowerTick, TickInfoDTO upperTick)> GetTickRangeInfoAsync(string poolAddress, int tickLower, int tickUpper)
        {
            var h = _web3.Eth.GetContractHandler(poolAddress);
            var lt = h.QueryDeserializingToObjectAsync<TicksFunction, TickInfoDTO>(new TicksFunction { Tick = tickLower }, null);
            var ut = h.QueryDeserializingToObjectAsync<TicksFunction, TickInfoDTO>(new TicksFunction { Tick = tickUpper }, null);
            await Task.WhenAll(lt, ut);
            return (await lt, await ut);
        }

        public async Task<UniswapV3PoolMetadata?> GetPoolMetadataAsync(string poolAddress)
        {
            try
            {
                var h = _web3.Eth.GetContractHandler(poolAddress.ToLowerInvariant());
                var token0 = await h.QueryAsync<Token0Function, string>(new Token0Function());
                var token1 = await h.QueryAsync<Token1Function, string>(new Token1Function());
                var fee = await h.QueryAsync<FeeFunction, uint>(new FeeFunction());
                int? ts = null; try { ts = await h.QueryAsync<TickSpacingFunction, int>(new TickSpacingFunction()); } catch { }
                long createdAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                return new UniswapV3PoolMetadata(poolAddress, token0, token1, fee, ts, createdAt);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: GetPoolMetadataAsync {poolAddress} ex={ex.Message}");
                return null;
            }
        }

        public async Task<UniswapV3PoolState?> GetCurrentPoolStateAsync(string poolAddress)
        {
            if (string.IsNullOrWhiteSpace(poolAddress)) return null;
            try
            {
                var (fg0, fg1) = await GetPoolFeeGrowthAsync(poolAddress);
                Slot0OutputDTO slot0 = null;
                try { slot0 = await _web3.Eth.GetContractHandler(poolAddress).QueryDeserializingToObjectAsync<Slot0Function, Slot0OutputDTO>(new Slot0Function()); }
                catch (Exception exSlot) { Console.WriteLine($"WARNING: slot0 query failed pool={poolAddress} ex={exSlot.Message}"); return null; }
                if (slot0 == null) return null;
                return new UniswapV3PoolState(poolAddress, DateTimeOffset.UtcNow.ToUnixTimeSeconds(), slot0.SqrtPriceX96, slot0.Tick, fg0, fg1);
            }
            catch (Exception ex) { Console.WriteLine($"ERROR: GetCurrentPoolStateAsync failed pool={poolAddress} ex={ex.Message}"); return null; }
        }

        // --- Position range uses resolved pool ---
        public async Task<PositionRangeInfo> GetPositionRangeAsync(BigInteger positionTokenId)
        {
            var pos = await GetPositionAsync(positionTokenId);
            var poolAddress = await ResolvePoolAddressAsync(pos.Token0, pos.Token1, pos.Fee);
            int currentTick = 0; try { if (!string.IsNullOrEmpty(poolAddress)) currentTick = await GetCurrentTickAsync(poolAddress); } catch { }
            decimal minPrice = TickToPrice(pos.TickLower, 0, 0);
            decimal maxPrice = TickToPrice(pos.TickUpper, 0, 0);
            decimal currentPrice = TickToPrice(currentTick, 0, 0);
            string status = currentTick < pos.TickLower ? "below" : (currentTick > pos.TickUpper ? "above" : "in-range");
            return new PositionRangeInfo(positionTokenId, poolAddress, pos.TickLower, pos.TickUpper, currentTick, minPrice, maxPrice, currentPrice, status);
        }

        private static decimal TickToPrice(int tick, int dec0, int dec1) => (decimal)(Math.Pow(1.0001, tick) * Math.Pow(10, dec0 - dec1));

        private static (decimal amount0, decimal amount1, string branch) ComputeAmountsFromSqrt(BigInteger liquidity, int tickLower, int tickUpper, BigInteger sqrtPriceX96, int currentTick)
        {
            // Use actual sqrtPrice from slot0 for current; boundaries from ticks (unscaled sqrt)
            double sqrtCurrent = (double)sqrtPriceX96 / Math.Pow(2, 96); // unscaled
            double sqrtLower = Math.Pow(1.0001, tickLower / 2.0);
            double sqrtUpper = Math.Pow(1.0001, tickUpper / 2.0);
            if (sqrtLower > sqrtUpper) (sqrtLower, sqrtUpper) = (sqrtUpper, sqrtLower);
            double L = (double) (liquidity > long.MaxValue ? (long) (liquidity % long.MaxValue) : (long)liquidity); // approximation
            string branch;
            double a0=0, a1=0;
            if (sqrtCurrent <= sqrtLower) { branch = "below"; a0 = L * (sqrtUpper - sqrtLower) / (sqrtUpper * sqrtLower); }
            else if (sqrtCurrent < sqrtUpper) { branch = "in-range"; a0 = L * (sqrtUpper - sqrtCurrent) / (sqrtUpper * sqrtCurrent); a1 = L * (sqrtCurrent - sqrtLower); }
            else { branch = "above"; a1 = L * (sqrtUpper - sqrtLower); }
            decimal d0=0, d1=0; try { d0=(decimal)a0; } catch {}; try { d1=(decimal)a1; } catch {};
            Console.WriteLine($"DEBUG: AmountCalc2 | L={liquidity} tickL={tickLower} tickU={tickUpper} curTick={currentTick} sqrtC={sqrtCurrent} sqrtL={sqrtLower} sqrtU={sqrtUpper} branch={branch} raw0={a0} raw1={a1} amt0={d0} amt1={d1}");
            return (d0,d1,branch);
        }

        private static decimal ScaleDown(decimal value, int decimals) => decimals <=0 ? value : value / (decimal)Math.Pow(10, decimals);
        private static decimal ScaleToken(BigInteger value, int decimals) { if (value==0) return 0; decimal pow; try { pow=(decimal)Math.Pow(10,decimals); } catch { pow=1; } if (pow==0) pow=1; return (decimal)value / pow; }
        private static bool IsStable(string symbol) => !string.IsNullOrEmpty(symbol) && (symbol.ToUpperInvariant().Contains("USDC") || symbol.ToUpperInvariant().Contains("USDT") || symbol.ToUpperInvariant().Contains("DAI") || symbol.ToUpperInvariant().Contains("USD"));
        private static bool IsWeth(string symbol, string addr) => symbol.Equals("WETH", StringComparison.OrdinalIgnoreCase) || addr.Equals("0x4200000000000000000000000000000000000006", StringComparison.OrdinalIgnoreCase);

        public async Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(IEnumerable<BigInteger> positionTokenIds)
        {
            // Backward-compatible default: include all positions
            return await GetActivePoolsOnChainAsync(positionTokenIds, false);
        }

        public async Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(IEnumerable<BigInteger> positionTokenIds, bool onlyOpenPositions)
        {
            var resp = new UniswapV3GetActivePoolsResponse();
            if (positionTokenIds == null) { resp.Data.Bundles.Add(new UniswapV3Bundle { NativePriceUSD = "0" }); return resp; }
            double nativePrice = 0d;
            foreach (var id in positionTokenIds)
            {
                PositionDTO pos;
                try { pos = await GetPositionAsync(id); }
                catch (Exception ex) { Console.WriteLine($"WARNING: position {id} fetch failed: {ex.Message}"); continue; }

                if (onlyOpenPositions && pos.Liquidity == 0)
                {
                    Console.WriteLine($"INFO: Skipping position {id} due to zero liquidity (closed)");
                    continue;
                }

                var pool = await ResolvePoolAsync(pos.Token0, pos.Token1, pos.Fee);
                var meta0Task = GetErc20MetadataAsync(pos.Token0);
                var meta1Task = GetErc20MetadataAsync(pos.Token1);
                var stateTask = GetCurrentPoolStateAsync(pool);
                var poolMetaTask = GetPoolMetadataAsync(pool);
                await Task.WhenAll(meta0Task, meta1Task, stateTask, poolMetaTask);
                var (sym0, name0, dec0) = meta0Task.Result; var (sym1, name1, dec1) = meta1Task.Result; var state = stateTask.Result; var poolMeta = poolMetaTask.Result;
                int currentTick = state?.CurrentTick ?? 0;
                var (amt0Human, amt1Human, branch) = ComputePositionAmountsPrecise(pos.Liquidity, pos.TickLower, pos.TickUpper, state?.SqrtPriceX96 ?? 0, currentTick, dec0, dec1);
                Console.WriteLine($"DEBUG: DepositedFinal tokenId={id} branch={branch} amount0={amt0Human} amount1={amt1Human} dec0={dec0} dec1={dec1}");
                var owed0 = ScaleToken(pos.TokensOwed0, dec0); var owed1 = ScaleToken(pos.TokensOwed1, dec1);
                bool t0W = IsWeth(sym0, pos.Token0); bool t1W = IsWeth(sym1, pos.Token1); bool t0S = IsStable(sym0); bool t1S = IsStable(sym1);
                if (nativePrice <= 0 && state != null && (t0W ^ t1W) && (t0S || t1S))
                {
                    try
                    {
                        double sqrt = (double)state.SqrtPriceX96 / Math.Pow(2, 96);
                        double ratio = sqrt * sqrt;
                        double adjust = Math.Pow(10d, dec0 - dec1);
                        double price1per0 = ratio * adjust;
                        if (price1per0 > 0)
                        {
                            nativePrice = t0W ? price1per0 : (price1per0 == 0 ? 0 : 1d / price1per0);
                            Console.WriteLine($"DEBUG: DerivedNativePrice tokenId={id} price={nativePrice}");
                        }
                    }
                    catch { }
                }

                // Compute derivedNative for both tokens using slot0 ratio and decimals
                string d0 = "0", d1 = "0";
                try
                {
                    double ratio = 0d;
                    if (state != null && state.SqrtPriceX96 > 0)
                    {
                        var sqrt = (double)state.SqrtPriceX96 / Math.Pow(2, 96);
                        ratio = sqrt * sqrt * Math.Pow(10d, dec0 - dec1); // token1 per token0
                    }
                    if (t0W)
                    {
                        d0 = "1";
                        if (ratio > 0) d1 = (1d / ratio).ToString("G17");
                    }
                    else if (t1W)
                    {
                        d1 = "1";
                        if (ratio > 0) d0 = (ratio).ToString("G17");
                    }
                    else if (nativePrice > 0)
                    {
                        if (t0S)
                        {
                            d0 = (1d / nativePrice).ToString("G17");
                            if (ratio > 0) d1 = (1d / (ratio * nativePrice)).ToString("G17");
                        }
                        else if (t1S)
                        {
                            d1 = (1d / nativePrice).ToString("G17");
                            if (ratio > 0) d0 = (ratio / nativePrice).ToString("G17"); // (r USD) / nativePrice
                        }
                    }
                }
                catch { }

                // Range computations and status in human units (token1 per token0)
                var minPrice = TickToPrice(pos.TickLower, dec0, dec1).ToString("G17");
                var maxPrice = TickToPrice(pos.TickUpper, dec0, dec1).ToString("G17");
                var currentPrice = TickToPrice(currentTick, dec0, dec1).ToString("G17");
                string rangeStatus = currentTick < pos.TickLower ? "below" : (currentTick > pos.TickUpper ? "above" : "in-range");

                resp.Data.Positions.Add(new UniswapV3Position
                {
                    Id = id.ToString(), Liquidity = pos.Liquidity.ToString(),
                    DepositedToken0 = amt0Human.ToString("G17"), DepositedToken1 = amt1Human.ToString("G17"),
                    WithdrawnToken0 = "0", WithdrawnToken1 = "0",
                    CollectedFeesToken0 = owed0.ToString("G17"), CollectedFeesToken1 = owed1.ToString("G17"),
                    FeeGrowthInside0LastX128 = pos.FeeGrowthInside0LastX128.ToString(), FeeGrowthInside1LastX128 = pos.FeeGrowthInside1LastX128.ToString(),
                    TickLower = pos.TickLower, TickUpper = pos.TickUpper,
                    RangeStatus = rangeStatus,
                    MinPriceToken1PerToken0 = minPrice,
                    MaxPriceToken1PerToken0 = maxPrice,
                    CurrentPriceToken1PerToken0 = currentPrice,
                    Token0 = new UniswapV3Token { Id = pos.Token0, TokenAddress = pos.Token0, Symbol = sym0, Name = name0, Decimals = dec0.ToString(), FeesUSD = "0", DerivedNative = d0 },
                    Token1 = new UniswapV3Token { Id = pos.Token1, TokenAddress = pos.Token1, Symbol = sym1, Name = name1, Decimals = dec1.ToString(), FeesUSD = "0", DerivedNative = d1 },
                    Pool = new UniswapV3Pool {
                        Id = pool,
                        FeeTier = pos.Fee.ToString(),
                        Liquidity = pos.Liquidity.ToString(),
                        FeeGrowthGlobal0X128 = (state?.FeeGrowthGlobal0X128 ?? 0).ToString(),
                        FeeGrowthGlobal1X128 = (state?.FeeGrowthGlobal1X128 ?? 0).ToString(),
                        Tick = currentTick.ToString(),
                        TickSpacing = (poolMeta?.TickSpacing?.ToString() ?? string.Empty),
                        SqrtPriceX96 = (state?.SqrtPriceX96 ?? 0).ToString(),
                        CreatedAtUnix = (poolMeta?.CreatedAtUnix.ToString() ?? string.Empty)
                    }
                });
            }
            resp.Data.Bundles.Add(new UniswapV3Bundle { NativePriceUSD = nativePrice>0? nativePrice.ToString("G17"):"0" });
            return resp;
        }

        public async Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(string ownerAddress)
        {
            // Backward-compatible default: include all positions
            return await GetActivePoolsOnChainAsync(ownerAddress, false);
        }

        public async Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(string ownerAddress, bool onlyOpenPositions)
        {
            var resp = new UniswapV3GetActivePoolsResponse();
            try
            {
                var h = _web3.Eth.GetContractHandler(BASE_POSITION_MANAGER_ADDRESS);
                var bal = await h.QueryAsync<BalanceOfFunction, BigInteger>(new BalanceOfFunction { Owner = ownerAddress });
                if (bal==0){ resp.Data.Bundles.Add(new UniswapV3Bundle{NativePriceUSD="0"}); return resp; }
                var ids = new List<BigInteger>();
                for(BigInteger i=0; i<bal && i<50; i++)
                { try { ids.Add(await h.QueryAsync<TokenOfOwnerByIndexFunction, BigInteger>(new TokenOfOwnerByIndexFunction{Owner=ownerAddress, Index=i})); } catch { break; } }
                return await GetActivePoolsOnChainAsync(ids, onlyOpenPositions);
            }
            catch { resp.Data.Bundles.Add(new UniswapV3Bundle{NativePriceUSD="0"}); return resp; }
        }

        public async Task<(decimal token0Balance, decimal token1Balance, int token0Decimals, int token1Decimals)> GetPoolTvlRawAsync(string poolAddress)
        {
            try
            {
                var meta = await GetPoolMetadataAsync(poolAddress); if (meta==null) return (0,0,0,0);
                var h0=_web3.Eth.GetContractHandler(meta.Token0); var h1=_web3.Eth.GetContractHandler(meta.Token1);
                var b0=h0.QueryAsync<BalanceOfFunction, BigInteger>(new BalanceOfFunction{Owner=poolAddress}); var b1=h1.QueryAsync<BalanceOfFunction, BigInteger>(new BalanceOfFunction{Owner=poolAddress}); var d0=h0.QueryAsync<ERC20DecimalsFunction, byte>(new ERC20DecimalsFunction()); var d1=h1.QueryAsync<ERC20DecimalsFunction, byte>(new ERC20DecimalsFunction()); await Task.WhenAll(b0,b1,d0,d1);
                int dec0=(await d0), dec1=(await d1); decimal v0=(decimal)(await b0)/(decimal)Math.Pow(10,dec0); decimal v1=(decimal)(await b1)/(decimal)Math.Pow(10,dec1); return (v0,v1,dec0,dec1);
            }
            catch { return (0,0,0,0); }
        }

        private static (decimal amount0Human, decimal amount1Human, string branch) ComputePositionAmountsPrecise(BigInteger liquidity, int tickLower, int tickUpper, BigInteger sqrtPriceX96Current, int currentTick, int dec0, int dec1)
        {
            const int Q96_SHIFT = 96;
            if (liquidity == 0 || sqrtPriceX96Current == 0) return (0m, 0m, "zero");

            // Helper to get sqrtPriceX96 for a tick (approx via double then to BigInteger)
            static BigInteger GetSqrtPriceX96FromTick(int tick)
            {
                // sqrtPrice = sqrt(1.0001^tick) = 1.0001^(tick/2)
                double sqrt = Math.Pow(1.0001, tick / 2.0);
                double scaled = sqrt * Math.Pow(2, Q96_SHIFT);
                if (scaled < 0) scaled = 0;
                return new BigInteger(scaled);
            }

            var sqrtLower = GetSqrtPriceX96FromTick(tickLower);
            var sqrtUpper = GetSqrtPriceX96FromTick(tickUpper);
            var sqrtCurrent = sqrtPriceX96Current;

            if (sqrtLower == 0 || sqrtUpper == 0) return (0m, 0m, "bad-bounds");
            if (sqrtLower > sqrtUpper) (sqrtLower, sqrtUpper) = (sqrtUpper, sqrtLower);

            // BigInteger Q96 constant
            var Q96 = BigInteger.One << Q96_SHIFT; // 2^96

            BigInteger amount0BI = BigInteger.Zero;
            BigInteger amount1BI = BigInteger.Zero;
            string branch;

            if (sqrtCurrent <= sqrtLower) // fully in token0
            {
                branch = "below";
                // amount0 = L * (sqrtUpper - sqrtLower) / (sqrtUpper * sqrtLower / Q96)
                var numerator = liquidity * (sqrtUpper - sqrtLower) * Q96;
                var denominator = sqrtUpper * sqrtLower;
                if (denominator != 0) amount0BI = numerator / denominator;
            }
            else if (sqrtCurrent < sqrtUpper) // in range
            {
                branch = "in-range";
                // amount0 = L * (sqrtUpper - sqrtCurrent) / (sqrtUpper * sqrtCurrent / Q96)
                var num0 = liquidity * (sqrtUpper - sqrtCurrent) * Q96;
                var den0 = sqrtUpper * sqrtCurrent;
                if (den0 != 0) amount0BI = num0 / den0;
                // amount1 = L * (sqrtCurrent - sqrtLower) / Q96
                amount1BI = (liquidity * (sqrtCurrent - sqrtLower)) / Q96;
            }
            else // fully in token1
            {
                branch = "above";
                // amount1 = L * (sqrtUpper - sqrtLower) / Q96
                amount1BI = (liquidity * (sqrtUpper - sqrtLower)) / Q96;
            }

            decimal Scale(BigInteger v, int decimals)
            {
                if (v == 0) return 0m;
                decimal pow; try { pow = (decimal)Math.Pow(10, decimals); } catch { pow = 1m; }
                if (pow == 0) pow = 1m;
                // Cap conversion to avoid overflow
                if (v > (BigInteger)decimal.MaxValue) v = (BigInteger)decimal.MaxValue;
                return (decimal)v / pow;
            }

            var amount0Human = Scale(amount0BI, dec0);
            var amount1Human = Scale(amount1BI, dec1);

            Console.WriteLine($"DEBUG: PreciseAmounts | L={liquidity} tickL={tickLower} tickU={tickUpper} curTick={currentTick} branch={branch} amt0Raw={amount0BI} amt1Raw={amount1BI} amt0={amount0Human} amt1={amount1Human}");
            return (amount0Human, amount1Human, branch);
        }
    }
}
