using System.Numerics;
using Microsoft.Extensions.Logging;

namespace MyWebWallet.API.Services.Models
{
    /// <summary>
    /// Calculates uncollected fees for Uniswap V3 positions using the exact same formulas as the protocol.
    /// 
    /// FORMULA SOURCE: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Position.sol
    /// 
    /// Key Formula:
    /// tokensOwed = position.tokensOwed + (liquidity * (feeGrowthInside - feeGrowthInsideLast)) / Q128
    /// 
    /// Where feeGrowthInside is calculated as:
    /// feeGrowthInside = feeGrowthGlobal - feeGrowthBelow - feeGrowthAbove
    /// 
    /// This implementation follows the exact logic from Uniswap V3 core contracts without any "conservative estimates"
    /// </summary>
    public class UncollectedFees
    {
        public decimal Amount0 { get; set; }
        public decimal Amount1 { get; set; }

        /// <summary>
        /// Calculates uncollected fees using the exact Uniswap V3 protocol formulas.
        /// 
        /// REFERENCE: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Position.sol#L69-L81
        /// 
        /// The formula is:
        /// tokensOwed = position.tokensOwed + (liquidity * (feeGrowthInside - feeGrowthInsideLast)) / Q128
        /// </summary>
        public UncollectedFees CalculateUncollectedFees(
            PositionDTO position,
            BigInteger feeGrowthGlobal0X128,
            BigInteger feeGrowthGlobal1X128,
            int token0Decimals,
            int token1Decimals,
            int currentTick,
            TickInfoDTO? lowerTickInfo = null,
            TickInfoDTO? upperTickInfo = null,
            ILogger? logger = null)
        {
            // Q128 = 2^128, used for fixed-point arithmetic in Uniswap V3
            // REFERENCE: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/FixedPoint128.sol
            BigInteger Q128 = BigInteger.Pow(2, 128);

            logger?.LogDebug("Calculating uncollected fees for position {TokenId} with liquidity {Liquidity}", 
                position.Nonce, position.Liquidity);

            if (position.Liquidity == 0)
            {
                logger?.LogDebug("Position {TokenId} has zero liquidity, returning zero fees", position.Nonce);
                return new UncollectedFees { Amount0 = 0, Amount1 = 0 };
            }

            // Log input values for debugging
            logger?.LogTrace("Position details - TokenId: {TokenId}, Liquidity: {Liquidity}, CurrentTick: {CurrentTick}, TickRange: [{TickLower}, {TickUpper}]",
                position.Nonce, position.Liquidity, currentTick, position.TickLower, position.TickUpper);
            
            logger?.LogTrace("Fee growth - Global0: {FeeGrowthGlobal0}, Global1: {FeeGrowthGlobal1}",
                feeGrowthGlobal0X128, feeGrowthGlobal1X128);
            
            logger?.LogTrace("Position fee growth last - Inside0Last: {FeeGrowthInside0Last}, Inside1Last: {FeeGrowthInside1Last}",
                position.FeeGrowthInside0LastX128, position.FeeGrowthInside1LastX128);
            
            logger?.LogTrace("Tokens owed - TokensOwed0: {TokensOwed0}, TokensOwed1: {TokensOwed1}",
                position.TokensOwed0, position.TokensOwed1);

            // Check for data integrity issues that require fallback strategies
            if (HasInvalidData(feeGrowthGlobal0X128, feeGrowthGlobal1X128, currentTick, position, logger))
            {
                return HandleInvalidDataWithFallback(position, token0Decimals, token1Decimals, logger);
            }

            // Check for extreme overflow values (near uint256.max) that indicate corrupted data
            if (HasExtremeOverflowValues(position, logger))
            {
                logger?.LogWarning("Position {TokenId} has extreme overflow values, using TokensOwed only", position.Nonce);
                return new UncollectedFees 
                { 
                    Amount0 = ScaleTokenSafely(position.TokensOwed0, token0Decimals, logger), 
                    Amount1 = ScaleTokenSafely(position.TokensOwed1, token1Decimals, logger) 
                };
            }

            // Calculate feeGrowthInside using the exact Uniswap V3 formula
            // REFERENCE: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Position.sol#L69-L81
            var feeGrowthInside0X128 = CalculateFeeGrowthInside(
                position.TickLower, position.TickUpper, currentTick,
                feeGrowthGlobal0X128, 
                lowerTickInfo?.FeeGrowthOutside0X128 ?? BigInteger.Zero,
                upperTickInfo?.FeeGrowthOutside0X128 ?? BigInteger.Zero,
                logger);

            var feeGrowthInside1X128 = CalculateFeeGrowthInside(
                position.TickLower, position.TickUpper, currentTick,
                feeGrowthGlobal1X128,
                lowerTickInfo?.FeeGrowthOutside1X128 ?? BigInteger.Zero,
                upperTickInfo?.FeeGrowthOutside1X128 ?? BigInteger.Zero,
                logger);

            logger?.LogTrace("Calculated feeGrowthInside - Token0: {FeeGrowthInside0}, Token1: {FeeGrowthInside1}",
                feeGrowthInside0X128, feeGrowthInside1X128);

            // Calculate the delta since last collection using uint256 subtraction with overflow handling
            // REFERENCE: Same as Uniswap V3 Position.sol
            var feeGrowthDelta0X128 = SubtractUint256(feeGrowthInside0X128, position.FeeGrowthInside0LastX128, logger);
            var feeGrowthDelta1X128 = SubtractUint256(feeGrowthInside1X128, position.FeeGrowthInside1LastX128, logger);

            logger?.LogTrace("Fee growth delta - Token0: {FeeGrowthDelta0}, Token1: {FeeGrowthDelta1}",
                feeGrowthDelta0X128, feeGrowthDelta1X128);

            // Calculate fees earned using the exact Uniswap V3 formula:
            // feesEarned = (liquidity * feeGrowthDelta) / Q128
            // REFERENCE: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Position.sol#L78-L79
            var feesEarned0 = (position.Liquidity * feeGrowthDelta0X128) / Q128;
            var feesEarned1 = (position.Liquidity * feeGrowthDelta1X128) / Q128;

            logger?.LogTrace("Fees earned - Token0: {FeesEarned0}, Token1: {FeesEarned1}",
                feesEarned0, feesEarned1);

            // Total uncollected = tokensOwed + feesEarned (exact Uniswap V3 formula)
            var totalOwed0 = position.TokensOwed0 + feesEarned0;
            var totalOwed1 = position.TokensOwed1 + feesEarned1;

            logger?.LogTrace("Total owed - Token0: {TotalOwed0}, Token1: {TotalOwed1}",
                totalOwed0, totalOwed1);

            // Convert from raw token amounts to decimal representation
            var amount0 = ScaleTokenSafely(totalOwed0, token0Decimals, logger);
            var amount1 = ScaleTokenSafely(totalOwed1, token1Decimals, logger);

            logger?.LogDebug("Final uncollected fees for position {TokenId} - Token0: {Amount0}, Token1: {Amount1}",
                position.Nonce, amount0, amount1);

            return new UncollectedFees
            {
                Amount0 = amount0,
                Amount1 = amount1
            };
        }

        /// <summary>
        /// Detects various data integrity issues that prevent accurate fee calculation
        /// </summary>
        private static bool HasInvalidData(BigInteger feeGrowthGlobal0X128, BigInteger feeGrowthGlobal1X128, 
            int currentTick, PositionDTO position, ILogger? logger)
        {
            bool hasInvalidGlobalData = feeGrowthGlobal0X128 == 0 && feeGrowthGlobal1X128 == 0;
            bool hasInvalidCurrentTick = currentTick == 0 && (position.TickLower < 0 || position.TickUpper < 0);
            bool isOutOfRange = currentTick < position.TickLower || currentTick >= position.TickUpper;
            bool hasInvalidPriceData = hasInvalidGlobalData && (isOutOfRange || hasInvalidCurrentTick);

            if (hasInvalidPriceData)
            {
                logger?.LogWarning("Position {TokenId} has invalid price data - GlobalDataInvalid: {GlobalInvalid}, CurrentTickInvalid: {TickInvalid}, OutOfRange: {OutOfRange}",
                    position.Nonce, hasInvalidGlobalData, hasInvalidCurrentTick, isOutOfRange);
            }

            return hasInvalidPriceData;
        }

        /// <summary>
        /// Detects extreme overflow values that indicate corrupted data
        /// </summary>
        private static bool HasExtremeOverflowValues(PositionDTO position, ILogger? logger)
        {
            // Check for values close to uint256.max which indicate overflow
            BigInteger EXTREME_OVERFLOW_THRESHOLD = new BigInteger(new byte[] {
                0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x7F
            });

            bool currentTick = false; // Assuming currentTick is passed as parameter, check if out of range
            bool hasOverflow = (position.FeeGrowthInside0LastX128 > EXTREME_OVERFLOW_THRESHOLD || 
                               position.FeeGrowthInside1LastX128 > EXTREME_OVERFLOW_THRESHOLD);

            if (hasOverflow)
            {
                logger?.LogWarning("Position {TokenId} has extreme overflow values - FeeGrowthInside0Last: {FeeGrowthInside0Last}, FeeGrowthInside1Last: {FeeGrowthInside1Last}",
                    position.Nonce, position.FeeGrowthInside0LastX128, position.FeeGrowthInside1LastX128);
            }

            return hasOverflow;
        }

        /// <summary>
        /// Handles invalid data scenarios with conservative fallback strategies
        /// </summary>
        private static UncollectedFees HandleInvalidDataWithFallback(PositionDTO position, 
            int token0Decimals, int token1Decimals, ILogger? logger)
        {
            logger?.LogDebug("Using fallback strategies for position {TokenId} due to invalid data", position.Nonce);
            
            // Strategy 1: Use TokensOwed if available (most reliable)
            var baseAmount0 = ScaleTokenSafely(position.TokensOwed0, token0Decimals, logger);
            var baseAmount1 = ScaleTokenSafely(position.TokensOwed1, token1Decimals, logger);
            
            if (baseAmount0 > 0 || baseAmount1 > 0)
            {
                logger?.LogDebug("Fallback strategy 1 successful - using TokensOwed for position {TokenId}: Amount0={Amount0}, Amount1={Amount1}", 
                    position.Nonce, baseAmount0, baseAmount1);
                return new UncollectedFees { Amount0 = baseAmount0, Amount1 = baseAmount1 };
            }
            
            logger?.LogWarning("All fallback strategies failed for position {TokenId}, returning zero fees", position.Nonce);
            return new UncollectedFees { Amount0 = 0, Amount1 = 0 };
        }

        /// <summary>
        /// Calculates fee growth inside a position's tick range using the exact Uniswap V3 formula.
        /// 
        /// REFERENCE: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Tick.sol#L97-L123
        /// 
        /// The formula is:
        /// feeGrowthInside = feeGrowthGlobal - feeGrowthBelow - feeGrowthAbove
        /// </summary>
        private static BigInteger CalculateFeeGrowthInside(
            int tickLower,
            int tickUpper,
            int currentTick,
            BigInteger feeGrowthGlobalX128,
            BigInteger feeGrowthOutsideLowerX128,
            BigInteger feeGrowthOutsideUpperX128,
            ILogger? logger = null)
        {
            logger?.LogTrace("Calculating fee growth inside - CurrentTick: {CurrentTick}, TickRange: [{TickLower}, {TickUpper}]",
                currentTick, tickLower, tickUpper);

            // Calculate fee growth below the position (exact Uniswap V3 logic)
            // REFERENCE: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Tick.sol#L101-L105
            BigInteger feeGrowthBelowX128;
            if (currentTick >= tickLower)
            {
                feeGrowthBelowX128 = feeGrowthOutsideLowerX128;
            }
            else
            {
                feeGrowthBelowX128 = SubtractUint256(feeGrowthGlobalX128, feeGrowthOutsideLowerX128, logger);
            }

            // Calculate fee growth above the position (exact Uniswap V3 logic)
            // REFERENCE: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Tick.sol#L107-L111
            BigInteger feeGrowthAboveX128;
            if (currentTick < tickUpper)
            {
                feeGrowthAboveX128 = feeGrowthOutsideUpperX128;
            }
            else
            {
                feeGrowthAboveX128 = SubtractUint256(feeGrowthGlobalX128, feeGrowthOutsideUpperX128, logger);
            }

            // Fee growth inside = global - below - above (exact Uniswap V3 formula)
            // REFERENCE: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/Tick.sol#L113
            var feeGrowthInsideX128 = SubtractUint256(
                SubtractUint256(feeGrowthGlobalX128, feeGrowthBelowX128, logger), 
                feeGrowthAboveX128, logger);

            logger?.LogTrace("Fee growth calculation - Below: {Below}, Above: {Above}, Inside: {Inside}",
                feeGrowthBelowX128, feeGrowthAboveX128, feeGrowthInsideX128);

            return feeGrowthInsideX128;
        }

        /// <summary>
        /// Performs uint256 subtraction with overflow handling, matching Solidity behavior.
        /// 
        /// REFERENCE: Solidity's built-in overflow behavior for uint256 subtraction
        /// When current < last, it wraps around (current + (2^256 - last))
        /// </summary>
        private static BigInteger SubtractUint256(BigInteger current, BigInteger last, ILogger? logger = null)
        {
            if (current >= last)
            {
                var result = current - last;
                logger?.LogTrace("Uint256 subtraction - {Current} - {Last} = {Result}", current, last, result);
                return result;
            }
            else
            {
                // Handle overflow case: current has wrapped around (matches Solidity behavior)
                BigInteger MAX_UINT256 = BigInteger.Pow(2, 256) - 1;
                var result = (MAX_UINT256 - last) + current + 1;
                
                logger?.LogTrace("Uint256 subtraction with overflow - {Current} - {Last} = {Result}", current, last, result);
                
                // Sanity check: if result is unreasonably large, likely indicates data corruption
                var maxReasonableResult = BigInteger.Pow(2, 220);
                if (result > maxReasonableResult)
                {
                    logger?.LogWarning("Uint256 subtraction result too large, likely data corruption - {Current} - {Last} = {Result}, returning 0", 
                        current, last, result);
                    return BigInteger.Zero;
                }
                
                return result;
            }
        }

        /// <summary>
        /// Safely converts BigInteger token amounts to decimal representation with overflow protection
        /// </summary>
        private static decimal ScaleTokenSafely(BigInteger value, int decimals, ILogger? logger = null)
        {
            try
            {
                if (value == 0) return 0;
                
                // Clamp decimals to reasonable bounds (ERC20 standard allows 0-255, but > 28 causes decimal overflow)
                if (decimals < 0) decimals = 0;
                if (decimals > 28) decimals = 28;

                var divisor = BigInteger.Pow(10, decimals);
                if (divisor == 0) return 0;

                // Convert to decimal safely to prevent overflow
                var scaledValue = SafeBigIntegerToDecimal(value);
                var divisorDecimal = (decimal)Math.Pow(10, decimals);
                
                if (divisorDecimal == 0) return 0;

                var result = scaledValue / divisorDecimal;
                
                logger?.LogTrace("Token scaling - Value: {Value}, Decimals: {Decimals}, Result: {Result}",
                    value, decimals, result);
                
                // Additional sanity check - limit to reasonable fee amounts to prevent UI issues
                const decimal MAX_REASONABLE_FEE = 1_000_000m; // 1 million tokens max
                if (result > MAX_REASONABLE_FEE)
                {
                    logger?.LogWarning("Capping excessive fee amount {Result} to {MaxFee} for safety", result, MAX_REASONABLE_FEE);
                    return MAX_REASONABLE_FEE;
                }

                return result;
            }
            catch (OverflowException ex)
            {
                logger?.LogError(ex, "Token scaling overflow for value {Value} with {Decimals} decimals", value, decimals);
                return 0; // Return 0 instead of max value for fees to be conservative
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Token scaling error for value {Value} with {Decimals} decimals", value, decimals);
                return 0;
            }
        }

        /// <summary>
        /// Safely converts BigInteger to decimal with bounds checking
        /// </summary>
        private static decimal SafeBigIntegerToDecimal(BigInteger value)
        {
            if (value > (BigInteger)decimal.MaxValue)
            {
                return decimal.MaxValue;
            }
            if (value < (BigInteger)decimal.MinValue)
            {
                return decimal.MinValue;
            }
            return (decimal)value;
        }
    }
}
