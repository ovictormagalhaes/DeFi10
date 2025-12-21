using System.Numerics;
using Microsoft.Extensions.Logging;
using DeFi10.API.Services.Protocols.Raydium.Clmm.DTO;

namespace DeFi10.API.Services.Protocols.Raydium.Models
{
    public class RaydiumUncollectedFees
    {
        public decimal Amount0 { get; set; }
        public decimal Amount1 { get; set; }

        /// <summary>
        /// Calculate uncollected fees for a Raydium CLMM position
        /// Raydium uses Q64 fixed-point representation (unlike Uniswap's Q128)
        /// </summary>
        public RaydiumUncollectedFees CalculateUncollectedFees(
            ClmmPositionDTO position,
            ClmmPoolDTO pool,
            int token0Decimals,
            int token1Decimals,
            ClmmTickDTO? tickLowerData,
            ClmmTickDTO? tickUpperData,
            ILogger? logger = null)
        {
            BigInteger Q64 = BigInteger.Pow(2, 64);

            logger?.LogDebug("[Raydium Fees] Calculating uncollected fees for position with liquidity {Liquidity}", 
                position.Liquidity);

            if (position.Liquidity == 0)
            {
                logger?.LogDebug("[Raydium Fees] Position has zero liquidity, returning zero fees");
                return new RaydiumUncollectedFees { Amount0 = 0, Amount1 = 0 };
            }

            logger?.LogTrace("[Raydium Fees] Position - Liquidity: {Liquidity}, CurrentTick: {CurrentTick}, TickRange: [{TickLower}, {TickUpper}]",
                position.Liquidity, pool.TickCurrent, position.TickLower, position.TickUpper);
            
            logger?.LogTrace("[Raydium Fees] Fee growth - Global0: {FeeGrowthGlobal0}, Global1: {FeeGrowthGlobal1}",
                pool.FeeGrowthGlobal0X64, pool.FeeGrowthGlobal1X64);
            
            logger?.LogTrace("[Raydium Fees] Position fee growth last - Inside0Last: {FeeGrowthInside0Last}, Inside1Last: {FeeGrowthInside1Last}",
                position.FeeGrowthInsideA, position.FeeGrowthInsideB);
            
            logger?.LogTrace("[Raydium Fees] Tokens owed - TokensOwed0: {TokensOwed0}, TokensOwed1: {TokensOwed1}",
                position.FeesOwedTokenA, position.FeesOwedTokenB);

            // Check if position is in range
            bool inRange = pool.TickCurrent >= position.TickLower && pool.TickCurrent < position.TickUpper;
            logger?.LogDebug("[Raydium Fees] Position in range: {InRange} (current tick: {CurrentTick}, range: [{Lower}, {Upper}])",
                inRange, pool.TickCurrent, position.TickLower, position.TickUpper);

            // Check if we have tick data available
            bool hasTickData = tickLowerData != null && tickUpperData != null;
            logger?.LogDebug("[Raydium Fees] Tick data available: {HasTickData}", hasTickData);

            BigInteger feeGrowthInside0X64;
            BigInteger feeGrowthInside1X64;

            if (hasTickData)
            {
                // We have tick data - calculate accurately using feeGrowthOutside from ticks
                // This works correctly for BOTH in-range and out-of-range positions
                feeGrowthInside0X64 = CalculateFeeGrowthInside(
                    position.TickLower, 
                    position.TickUpper, 
                    pool.TickCurrent,
                    pool.FeeGrowthGlobal0X64, 
                    tickLowerData!.FeeGrowthOutside0X64,
                    tickUpperData!.FeeGrowthOutside0X64,  // Fixed: was using FeeGrowthOutside1X64
                    logger);

                feeGrowthInside1X64 = CalculateFeeGrowthInside(
                    position.TickLower, 
                    position.TickUpper, 
                    pool.TickCurrent,
                    pool.FeeGrowthGlobal1X64,
                    tickLowerData!.FeeGrowthOutside1X64,
                    tickUpperData!.FeeGrowthOutside1X64,
                    logger);
            }
            else if (inRange)
            {
                // Position is in range but no tick data - approximate with global values
                // This is less accurate but better than nothing
                logger?.LogWarning("[Raydium Fees] No tick data available, approximating with global fee growth for in-range position");
                feeGrowthInside0X64 = CalculateFeeGrowthInside(
                    position.TickLower, 
                    position.TickUpper, 
                    pool.TickCurrent,
                    pool.FeeGrowthGlobal0X64, 
                    BigInteger.Zero,
                    BigInteger.Zero,
                    logger);

                feeGrowthInside1X64 = CalculateFeeGrowthInside(
                    position.TickLower, 
                    position.TickUpper, 
                    pool.TickCurrent,
                    pool.FeeGrowthGlobal1X64,
                    BigInteger.Zero,
                    BigInteger.Zero,
                    logger);
            }
            else
            {
                // Position is out of range AND no tick data
                // Use the last recorded values (fees were accumulated when position was in range)
                feeGrowthInside0X64 = position.FeeGrowthInsideA;
                feeGrowthInside1X64 = position.FeeGrowthInsideB;
                logger?.LogWarning("[Raydium Fees] Position out of range and no tick data - using last recorded fee growth values");
            }

            logger?.LogTrace("[Raydium Fees] Calculated feeGrowthInside - Token0: {FeeGrowthInside0}, Token1: {FeeGrowthInside1}",
                feeGrowthInside0X64, feeGrowthInside1X64);

            // Calculate fee growth delta
            var feeGrowthDelta0X64 = SubtractUint128(feeGrowthInside0X64, position.FeeGrowthInsideA, logger);
            var feeGrowthDelta1X64 = SubtractUint128(feeGrowthInside1X64, position.FeeGrowthInsideB, logger);

            logger?.LogTrace("[Raydium Fees] Fee growth delta - Token0: {FeeGrowthDelta0}, Token1: {FeeGrowthDelta1}",
                feeGrowthDelta0X64, feeGrowthDelta1X64);

            // Calculate fees earned: (liquidity * feeGrowthDelta) / Q64
            var feesEarned0 = (position.Liquidity * feeGrowthDelta0X64) / Q64;
            var feesEarned1 = (position.Liquidity * feeGrowthDelta1X64) / Q64;

            logger?.LogTrace("[Raydium Fees] Fees earned - Token0: {FeesEarned0}, Token1: {FeesEarned1}",
                feesEarned0, feesEarned1);

            // Add to tokens already owed
            var totalOwed0 = position.FeesOwedTokenA + feesEarned0;
            var totalOwed1 = position.FeesOwedTokenB + feesEarned1;

            logger?.LogTrace("[Raydium Fees] Total owed - Token0: {TotalOwed0}, Token1: {TotalOwed1}",
                totalOwed0, totalOwed1);

            var amount0 = ScaleTokenSafely(totalOwed0, token0Decimals, logger);
            var amount1 = ScaleTokenSafely(totalOwed1, token1Decimals, logger);

            logger?.LogDebug("[Raydium Fees] Final uncollected fees - Token0: {Amount0}, Token1: {Amount1}",
                amount0, amount1);

            return new RaydiumUncollectedFees
            {
                Amount0 = amount0,
                Amount1 = amount1
            };
        }

        /// <summary>
        /// Calculate fee growth inside the position's tick range
        /// This follows the Uniswap V3 logic which Raydium CLMM is based on
        /// </summary>
        private static BigInteger CalculateFeeGrowthInside(
            int tickLower,
            int tickUpper,
            int currentTick,
            BigInteger feeGrowthGlobalX64,
            BigInteger feeGrowthOutsideLowerX64,
            BigInteger feeGrowthOutsideUpperX64,
            ILogger? logger = null)
        {
            logger?.LogTrace("[Raydium Fees] Calculating fee growth inside - CurrentTick: {CurrentTick}, TickRange: [{TickLower}, {TickUpper}]",
                currentTick, tickLower, tickUpper);

            // Calculate fee growth below the position
            BigInteger feeGrowthBelowX64;
            if (currentTick >= tickLower)
            {
                feeGrowthBelowX64 = feeGrowthOutsideLowerX64;
            }
            else
            {
                feeGrowthBelowX64 = SubtractUint128(feeGrowthGlobalX64, feeGrowthOutsideLowerX64, logger);
            }

            // Calculate fee growth above the position
            BigInteger feeGrowthAboveX64;
            if (currentTick < tickUpper)
            {
                feeGrowthAboveX64 = feeGrowthOutsideUpperX64;
            }
            else
            {
                feeGrowthAboveX64 = SubtractUint128(feeGrowthGlobalX64, feeGrowthOutsideUpperX64, logger);
            }

            // Fee growth inside = global - below - above
            var feeGrowthInsideX64 = SubtractUint128(
                SubtractUint128(feeGrowthGlobalX64, feeGrowthBelowX64, logger), 
                feeGrowthAboveX64, logger);

            logger?.LogTrace("[Raydium Fees] Fee growth calculation - Below: {Below}, Above: {Above}, Inside: {Inside}",
                feeGrowthBelowX64, feeGrowthAboveX64, feeGrowthInsideX64);

            return feeGrowthInsideX64;
        }

        /// <summary>
        /// Subtract two uint128 values with overflow handling
        /// Raydium uses 128-bit values (stored in BigInteger)
        /// </summary>
        private static BigInteger SubtractUint128(BigInteger current, BigInteger last, ILogger? logger = null)
        {
            if (current >= last)
            {
                var result = current - last;
                logger?.LogTrace("[Raydium Fees] Uint128 subtraction - {Current} - {Last} = {Result}", current, last, result);
                return result;
            }
            else
            {
                // Handle overflow: current has wrapped around
                // This is NORMAL in Uniswap V3 / Raydium CLMM when fees accumulate
                BigInteger MAX_UINT128 = BigInteger.Pow(2, 128) - 1;
                var result = (MAX_UINT128 - last) + current + 1;
                
                logger?.LogTrace("[Raydium Fees] Uint128 subtraction with overflow - {Current} - {Last} = {Result}", current, last, result);

                // Important: Don't reject large values! They can be legitimate fee growth
                // Only reject truly absurd values (> 2^120)
                var maxReasonableResult = BigInteger.Pow(2, 120);
                if (result > maxReasonableResult)
                {
                    logger?.LogWarning("[Raydium Fees] Uint128 subtraction result too large, likely data corruption - {Current} - {Last} = {Result}, returning 0", 
                        current, last, result);
                    return BigInteger.Zero;
                }
                
                return result;
            }
        }

        /// <summary>
        /// Safely convert token amounts from raw to decimal, handling extreme values
        /// </summary>
        private static decimal ScaleTokenSafely(BigInteger rawAmount, int decimals, ILogger? logger = null)
        {
            if (rawAmount <= 0)
            {
                return 0;
            }

            try
            {
                var divisor = BigInteger.Pow(10, decimals);
                
                // Check if the result would be too large for decimal
                var maxDecimalValue = new BigInteger(decimal.MaxValue);
                if (rawAmount > maxDecimalValue * divisor)
                {
                    logger?.LogWarning("[Raydium Fees] Token amount {RawAmount} too large for decimal conversion with {Decimals} decimals, returning max decimal", 
                        rawAmount, decimals);
                    return decimal.MaxValue;
                }

                var integerPart = rawAmount / divisor;
                var remainder = rawAmount % divisor;
                
                var result = (decimal)integerPart + ((decimal)remainder / (decimal)divisor);
                
                logger?.LogTrace("[Raydium Fees] Scaled token - Raw: {RawAmount}, Decimals: {Decimals}, Result: {Result}",
                    rawAmount, decimals, result);
                
                return result;
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "[Raydium Fees] Error scaling token amount {RawAmount} with {Decimals} decimals", 
                    rawAmount, decimals);
                return 0;
            }
        }
    }
}
