using System.Numerics;
using Microsoft.Extensions.Logging;
using DeFi10.API.Services.Protocols.Uniswap.DTOs;

namespace DeFi10.API.Services.Protocols.Uniswap.Models
{


    public class UncollectedFees
    {
        public decimal Amount0 { get; set; }
        public decimal Amount1 { get; set; }


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


            BigInteger Q128 = BigInteger.Pow(2, 128);

            if (position.Liquidity == 0)
            {
                return new UncollectedFees { Amount0 = 0, Amount1 = 0 };
            }

            if (HasInvalidData(feeGrowthGlobal0X128, feeGrowthGlobal1X128, currentTick, position, logger))
            {
                return HandleInvalidDataWithFallback(position, token0Decimals, token1Decimals, logger);
            }

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

            var feeGrowthDelta0X128 = SubtractUint256WithThreshold(feeGrowthInside0X128, position.FeeGrowthInside0LastX128, BigInteger.Pow(2, 64), logger);
            var feeGrowthDelta1X128 = SubtractUint256WithThreshold(feeGrowthInside1X128, position.FeeGrowthInside1LastX128, BigInteger.Pow(2, 64), logger);

            var feesEarned0 = (position.Liquidity * feeGrowthDelta0X128) / Q128;
            var feesEarned1 = (position.Liquidity * feeGrowthDelta1X128) / Q128;

            var totalOwed0 = position.TokensOwed0 + feesEarned0;
            var totalOwed1 = position.TokensOwed1 + feesEarned1;

            var amount0 = ScaleTokenSafely(totalOwed0, token0Decimals, logger);
            var amount1 = ScaleTokenSafely(totalOwed1, token1Decimals, logger);

            return new UncollectedFees
            {
                Amount0 = amount0,
                Amount1 = amount1
            };
        }


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


        private static UncollectedFees HandleInvalidDataWithFallback(PositionDTO position, 
            int token0Decimals, int token1Decimals, ILogger? logger)
        {
            logger?.LogWarning("Position {TokenId} has invalid data, using TokensOwed fallback", position.Nonce);

            var baseAmount0 = ScaleTokenSafely(position.TokensOwed0, token0Decimals, logger);
            var baseAmount1 = ScaleTokenSafely(position.TokensOwed1, token1Decimals, logger);
            
            return new UncollectedFees { Amount0 = baseAmount0, Amount1 = baseAmount1 };
        }


        private static BigInteger CalculateFeeGrowthInside(
            int tickLower,
            int tickUpper,
            int currentTick,
            BigInteger feeGrowthGlobalX128,
            BigInteger feeGrowthOutsideLowerX128,
            BigInteger feeGrowthOutsideUpperX128,
            ILogger? logger = null)
        {
            BigInteger feeGrowthBelowX128;
            if (currentTick >= tickLower)
            {
                feeGrowthBelowX128 = feeGrowthOutsideLowerX128;
            }
            else
            {
                feeGrowthBelowX128 = SubtractUint256(feeGrowthGlobalX128, feeGrowthOutsideLowerX128, logger);
            }


            BigInteger feeGrowthAboveX128;
            if (currentTick < tickUpper)
            {
                feeGrowthAboveX128 = feeGrowthOutsideUpperX128;
            }
            else
            {
                feeGrowthAboveX128 = SubtractUint256(feeGrowthGlobalX128, feeGrowthOutsideUpperX128, logger);
            }


            var feeGrowthInsideX128 = SubtractUint256(
                SubtractUint256(feeGrowthGlobalX128, feeGrowthBelowX128, logger), 
                feeGrowthAboveX128, logger);

            return feeGrowthInsideX128;
        }


        private static BigInteger SubtractUint256(BigInteger current, BigInteger last, ILogger? logger = null)
        {
            return SubtractUint256WithThreshold(current, last, null, logger);
        }

        private static BigInteger SubtractUint256WithThreshold(BigInteger current, BigInteger last, BigInteger? maxReasonableResult, ILogger? logger = null)
        {
            if (current >= last)
            {
                return current - last;
            }
            else
            {
                // Handle uint256 overflow: when current < last, it wrapped around
                BigInteger MAX_UINT256 = BigInteger.Pow(2, 256) - 1;
                var result = (MAX_UINT256 - last) + current + 1;

                // Apply threshold only if specified
                if (maxReasonableResult.HasValue && result > maxReasonableResult.Value)
                {
                    logger?.LogWarning("Position fee delta too large ({Result}), threshold exceeded ({MaxReasonable}). Returning 0.", 
                        result, maxReasonableResult.Value);
                    return BigInteger.Zero;
                }
                
                return result;
            }
        }


        private static decimal ScaleTokenSafely(BigInteger value, int decimals, ILogger? logger = null)
        {
            try
            {
                if (value == 0) return 0;

                if (decimals < 0) decimals = 0;
                if (decimals > 28) decimals = 28;

                var divisor = BigInteger.Pow(10, decimals);
                if (divisor == 0) return 0;

                var scaledValue = SafeBigIntegerToDecimal(value);
                var divisorDecimal = (decimal)Math.Pow(10, decimals);
                
                if (divisorDecimal == 0) return 0;

                var result = scaledValue / divisorDecimal;

                const decimal MAX_REASONABLE_FEE = 1_000_000m; 
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
                return 0; 
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Token scaling error for value {Value} with {Decimals} decimals", value, decimals);
                return 0;
            }
        }


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
