using MyWebWallet.API.Services.Interfaces;
using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;
using Nethereum.Web3;
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

    public class UniswapV3OnChainService : IUniswapV3OnChainService
    {
        private readonly Web3 _web3;
        private const string BASE_POSITION_MANAGER_ADDRESS = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
        public UniswapV3OnChainService(IConfiguration configuration)
        {
            var rpcUrl = configuration["Alchemy:BaseRpcUrl"];
            _web3 = new Web3(rpcUrl);
        }

        public async Task<PositionDTO> GetPositionAsync(BigInteger tokenId)
        {
            try
            {
                Console.WriteLine($"DEBUG: UniswapV3OnChainService: Starting GetPositionAsync for tokenId: {tokenId}");
                
                var contractHandler = _web3.Eth.GetContractHandler(BASE_POSITION_MANAGER_ADDRESS);
                var functionMessage = new PositionsFunction { TokenId = tokenId };
                
                Console.WriteLine($"DEBUG: UniswapV3OnChainService: Making blockchain call...");
                var position = await contractHandler
                    .QueryDeserializingToObjectAsync<PositionsFunction, PositionDTO>(functionMessage, null);
                
                Console.WriteLine($"SUCCESS: UniswapV3OnChainService: Successfully retrieved position data");
                return position;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: UniswapV3OnChainService: Error in GetPositionAsync for tokenId {tokenId} - {ex.Message}");
                Console.WriteLine($"ERROR: UniswapV3OnChainService: Stack trace - {ex.StackTrace}");
                throw new Exception($"UniswapV3OnChainService GetPositionAsync error: {ex.Message}", ex);
            }
        }

        public async Task<BigInteger> GetFeeGrowthGlobal0X128Async(string poolAddress)
        {
            try
            {
                Console.WriteLine($"DEBUG: UniswapV3OnChainService: Starting GetFeeGrowthGlobal0X128Async for pool: {poolAddress}");
                
                var contractHandler = _web3.Eth.GetContractHandler(poolAddress);
                var result = await contractHandler.QueryAsync<FeeGrowthGlobal0X128Function, BigInteger>(new FeeGrowthGlobal0X128Function());
                
                Console.WriteLine($"SUCCESS: UniswapV3OnChainService: Successfully retrieved fee growth global 0");
                return result;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: UniswapV3OnChainService: Error in GetFeeGrowthGlobal0X128Async for pool {poolAddress} - {ex.Message}");
                throw new Exception($"UniswapV3OnChainService GetFeeGrowthGlobal0X128Async error: {ex.Message}", ex);
            }
        }

        public async Task<BigInteger> GetFeeGrowthGlobal1X128Async(string poolAddress)
        {
            try
            {
                Console.WriteLine($"DEBUG: UniswapV3OnChainService: Starting GetFeeGrowthGlobal1X128Async for pool: {poolAddress}");
                
                var contractHandler = _web3.Eth.GetContractHandler(poolAddress);
                var result = await contractHandler.QueryAsync<FeeGrowthGlobal1X128Function, BigInteger>(new FeeGrowthGlobal1X128Function());
                
                Console.WriteLine($"SUCCESS: UniswapV3OnChainService: Successfully retrieved fee growth global 1");
                return result;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: UniswapV3OnChainService: Error in GetFeeGrowthGlobal1X128Async for pool {poolAddress} - {ex.Message}");
                throw new Exception($"UniswapV3OnChainService GetFeeGrowthGlobal1X128Async error: {ex.Message}", ex);
            }
        }

        // New method to get both fee growth values
        public async Task<(BigInteger feeGrowthGlobal0, BigInteger feeGrowthGlobal1)> GetPoolFeeGrowthAsync(string poolAddress)
        {
            try
            {
                Console.WriteLine($"DEBUG: UniswapV3OnChainService: Starting GetPoolFeeGrowthAsync for pool: {poolAddress}");
                
                var contractHandler = _web3.Eth.GetContractHandler(poolAddress);
                
                var feeGrowthGlobal0Task = contractHandler.QueryAsync<FeeGrowthGlobal0X128Function, BigInteger>(new FeeGrowthGlobal0X128Function());
                var feeGrowthGlobal1Task = contractHandler.QueryAsync<FeeGrowthGlobal1X128Function, BigInteger>(new FeeGrowthGlobal1X128Function());
                
                await Task.WhenAll(feeGrowthGlobal0Task, feeGrowthGlobal1Task);
                
                Console.WriteLine($"SUCCESS: UniswapV3OnChainService: Successfully retrieved both fee growth values");
                return (await feeGrowthGlobal0Task, await feeGrowthGlobal1Task);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: UniswapV3OnChainService: Error in GetPoolFeeGrowthAsync for pool {poolAddress} - {ex.Message}");
                throw new Exception($"UniswapV3OnChainService GetPoolFeeGrowthAsync error: {ex.Message}", ex);
            }
        }

        public async Task<int> GetCurrentTickAsync(string poolAddress)
        {
            try
            {
                Console.WriteLine($"DEBUG: UniswapV3OnChainService: Starting GetCurrentTickAsync for pool: {poolAddress}");
                
                var contractHandler = _web3.Eth.GetContractHandler(poolAddress);
                var slot0 = await contractHandler.QueryDeserializingToObjectAsync<Slot0Function, Slot0OutputDTO>(new Slot0Function());
                
                Console.WriteLine($"SUCCESS: UniswapV3OnChainService: Successfully retrieved current tick: {slot0.Tick}");
                return slot0.Tick;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: UniswapV3OnChainService: Error in GetCurrentTickAsync for pool {poolAddress} - {ex.Message}");
                throw new Exception($"UniswapV3OnChainService GetCurrentTickAsync error: {ex.Message}", ex);
            }
        }

        public async Task<TickInfoDTO> GetTickInfoAsync(string poolAddress, int tick)
        {
            try
            {
                Console.WriteLine($"DEBUG: UniswapV3OnChainService: Starting GetTickInfoAsync for pool: {poolAddress}, tick: {tick}");
                
                var contractHandler = _web3.Eth.GetContractHandler(poolAddress);
                var functionMessage = new TicksFunction { Tick = tick };
                var tickInfo = await contractHandler
                    .QueryDeserializingToObjectAsync<TicksFunction, TickInfoDTO>(functionMessage, null);
                
                Console.WriteLine($"SUCCESS: UniswapV3OnChainService: Successfully retrieved tick info");
                return tickInfo;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: UniswapV3OnChainService: Error in GetTickInfoAsync for pool {poolAddress}, tick {tick} - {ex.Message}");
                throw new Exception($"UniswapV3OnChainService GetTickInfoAsync error: {ex.Message}", ex);
            }
        }

        public async Task<(TickInfoDTO lowerTick, TickInfoDTO upperTick)> GetTickRangeInfoAsync(string poolAddress, int tickLower, int tickUpper)
        {
            try
            {
                Console.WriteLine($"DEBUG: UniswapV3OnChainService: Starting GetTickRangeInfoAsync for pool: {poolAddress}, range: {tickLower} to {tickUpper}");
                
                var contractHandler = _web3.Eth.GetContractHandler(poolAddress);
                
                var lowerTickTask = contractHandler.QueryDeserializingToObjectAsync<TicksFunction, TickInfoDTO>(
                    new TicksFunction { Tick = tickLower }, null);
                var upperTickTask = contractHandler.QueryDeserializingToObjectAsync<TicksFunction, TickInfoDTO>(
                    new TicksFunction { Tick = tickUpper }, null);
                
                await Task.WhenAll(lowerTickTask, upperTickTask);
                
                Console.WriteLine($"SUCCESS: UniswapV3OnChainService: Successfully retrieved tick range info");
                return (await lowerTickTask, await upperTickTask);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: UniswapV3OnChainService: Error in GetTickRangeInfoAsync for pool {poolAddress}, range {tickLower}-{tickUpper} - {ex.Message}");
                throw new Exception($"UniswapV3OnChainService GetTickRangeInfoAsync error: {ex.Message}", ex);
            }
        }
    }
}
