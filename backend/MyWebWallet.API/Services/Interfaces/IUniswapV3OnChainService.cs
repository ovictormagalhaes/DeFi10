using System.Numerics;
using System.Text.Json.Serialization;
using System.Collections.Generic;
using MyWebWallet.API.Services.Models; // Added for UniswapV3GetActivePoolsResponse

namespace MyWebWallet.API.Services.Interfaces
{
    public interface IUniswapV3OnChainService
    {
        Task<PositionDTO> GetPositionAsync(BigInteger tokenId);
        Task<BigInteger> GetFeeGrowthGlobal0X128Async(string poolAddress);
        Task<BigInteger> GetFeeGrowthGlobal1X128Async(string poolAddress);
        Task<(BigInteger feeGrowthGlobal0, BigInteger feeGrowthGlobal1)> GetPoolFeeGrowthAsync(string poolAddress);
        Task<int> GetCurrentTickAsync(string poolAddress);
        Task<TickInfoDTO> GetTickInfoAsync(string poolAddress, int tick);
        Task<(TickInfoDTO lowerTick, TickInfoDTO upperTick)> GetTickRangeInfoAsync(string poolAddress, int tickLower, int tickUpper);
        // Analytics additions
        Task<UniswapV3PoolMetadata?> GetPoolMetadataAsync(string poolAddress);
        Task<UniswapV3PoolState?> GetCurrentPoolStateAsync(string poolAddress);
        Task<PositionRangeInfo> GetPositionRangeAsync(BigInteger positionTokenId);
        // Build active pools response fully on-chain from provided position tokenIds
        Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(IEnumerable<BigInteger> positionTokenIds);
        // Overload with filter for only open positions
        Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(IEnumerable<BigInteger> positionTokenIds, bool onlyOpenPositions);
        // Enumerate positions by owner (no subgraph dependency)
        Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(string ownerAddress);
        // Overload with filter for only open positions
        Task<UniswapV3GetActivePoolsResponse> GetActivePoolsOnChainAsync(string ownerAddress, bool onlyOpenPositions);
    }

    /// <summary>
    /// Static pool metadata (does not change after creation)
    /// </summary>
    public class UniswapV3PoolMetadata
    {
        [JsonPropertyOrder(0)][JsonPropertyName("poolAddress")] public string PoolAddress { get; init; } = string.Empty;
        [JsonPropertyOrder(1)][JsonPropertyName("token0")] public string Token0 { get; init; } = string.Empty;
        [JsonPropertyOrder(2)][JsonPropertyName("token1")] public string Token1 { get; init; } = string.Empty;
        [JsonPropertyOrder(3)][JsonPropertyName("fee")] public uint Fee { get; init; }
        [JsonPropertyOrder(4)][JsonPropertyName("tickSpacing")] public int? TickSpacing { get; init; }
        [JsonPropertyOrder(5)][JsonPropertyName("createdAtUnix")] public long CreatedAtUnix { get; init; }

        public UniswapV3PoolMetadata() { }
        public UniswapV3PoolMetadata(string poolAddress, string token0, string token1, uint fee, int? tickSpacing, long createdAtUnix)
        {
            PoolAddress = poolAddress; Token0 = token0; Token1 = token1; Fee = fee; TickSpacing = tickSpacing; CreatedAtUnix = createdAtUnix;
        }
    }

    /// <summary>
    /// Snapshot of dynamic pool state.
    /// </summary>
    public class UniswapV3PoolState
    {
        [JsonPropertyOrder(0)][JsonPropertyName("poolAddress")] public string PoolAddress { get; init; } = string.Empty;
        [JsonPropertyOrder(1)][JsonPropertyName("timestampUnix")] public long TimestampUnix { get; init; }
        [JsonPropertyOrder(2)][JsonPropertyName("sqrtPriceX96")] public BigInteger SqrtPriceX96 { get; init; }
        [JsonPropertyOrder(3)][JsonPropertyName("currentTick")] public int CurrentTick { get; init; }
        [JsonPropertyOrder(4)][JsonPropertyName("feeGrowthGlobal0X128")] public BigInteger FeeGrowthGlobal0X128 { get; init; }
        [JsonPropertyOrder(5)][JsonPropertyName("feeGrowthGlobal1X128")] public BigInteger FeeGrowthGlobal1X128 { get; init; }

        public UniswapV3PoolState() { }
        public UniswapV3PoolState(string poolAddress, long timestampUnix, BigInteger sqrtPriceX96, int currentTick, BigInteger feeGrowthGlobal0X128, BigInteger feeGrowthGlobal1X128)
        {
            PoolAddress = poolAddress; TimestampUnix = timestampUnix; SqrtPriceX96 = sqrtPriceX96; CurrentTick = currentTick; FeeGrowthGlobal0X128 = feeGrowthGlobal0X128; FeeGrowthGlobal1X128 = feeGrowthGlobal1X128;
        }
    }

    /// <summary>
    /// Range info for an LP position (prices are token1 per token0).
    /// </summary>
    public class PositionRangeInfo
    {
        [JsonPropertyOrder(0)][JsonPropertyName("tokenId")] public BigInteger TokenId { get; init; }
        [JsonPropertyOrder(1)][JsonPropertyName("poolAddress")] public string PoolAddress { get; init; } = string.Empty;
        [JsonPropertyOrder(2)][JsonPropertyName("tickLower")] public int TickLower { get; init; }
        [JsonPropertyOrder(3)][JsonPropertyName("tickUpper")] public int TickUpper { get; init; }
        [JsonPropertyOrder(4)][JsonPropertyName("currentTick")] public int CurrentTick { get; init; }
        [JsonPropertyOrder(5)][JsonPropertyName("minPriceToken1PerToken0")] public decimal MinPriceToken1PerToken0 { get; init; }
        [JsonPropertyOrder(6)][JsonPropertyName("maxPriceToken1PerToken0")] public decimal MaxPriceToken1PerToken0 { get; init; }
        [JsonPropertyOrder(7)][JsonPropertyName("currentPriceToken1PerToken0")] public decimal CurrentPriceToken1PerToken0 { get; init; }
        [JsonPropertyOrder(8)][JsonPropertyName("status")] public string Status { get; init; } = string.Empty;

        public PositionRangeInfo() { }
        public PositionRangeInfo(BigInteger tokenId, string poolAddress, int tickLower, int tickUpper, int currentTick, decimal minPrice, decimal maxPrice, decimal currentPrice, string status)
        {
            TokenId = tokenId; PoolAddress = poolAddress; TickLower = tickLower; TickUpper = tickUpper; CurrentTick = currentTick; MinPriceToken1PerToken0 = minPrice; MaxPriceToken1PerToken0 = maxPrice; CurrentPriceToken1PerToken0 = currentPrice; Status = status;
        }
    }
}
