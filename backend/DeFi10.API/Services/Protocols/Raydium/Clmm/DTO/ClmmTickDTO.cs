using System.Numerics;

namespace DeFi10.API.Services.Protocols.Raydium.Clmm.DTO
{
    /// <summary>
    /// Represents a tick account in Raydium CLMM
    /// Similar to Uniswap V3 tick data structure
    /// </summary>
    public class ClmmTickDTO
    {
        /// <summary>
        /// Tick index
        /// </summary>
        public int TickIndex { get; set; }

        /// <summary>
        /// Fee growth outside this tick for token 0
        /// Q64.64 fixed point number
        /// </summary>
        public BigInteger FeeGrowthOutside0X64 { get; set; }

        /// <summary>
        /// Fee growth outside this tick for token 1
        /// Q64.64 fixed point number
        /// </summary>
        public BigInteger FeeGrowthOutside1X64 { get; set; }

        /// <summary>
        /// Liquidity provided by this tick
        /// </summary>
        public BigInteger LiquidityGross { get; set; }

        /// <summary>
        /// Liquidity delta when crossing this tick (can be negative)
        /// </summary>
        public BigInteger LiquidityNet { get; set; }

        /// <summary>
        /// Reward growth outside this tick (array of 3 rewards)
        /// </summary>
        public BigInteger[] RewardGrowthsOutsideX64 { get; set; } = new BigInteger[3];
    }
}
