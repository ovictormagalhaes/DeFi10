using System.Numerics;

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
    }
}
