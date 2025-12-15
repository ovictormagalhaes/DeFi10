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

            logger?.LogDebug("Calculating uncollected fees for position {TokenId} with liquidity {Liquidity}", 
                position.Nonce, position.Liquidity);

            if (position.Liquidity == 0)
            {
                logger?.LogDebug("Position {TokenId} has zero liquidity, returning zero fees", position.Nonce);
                return new UncollectedFees { Amount0 = 0, Amount1 = 0 };
            }

            logger?.LogTrace("Position details - TokenId: {TokenId}, Liquidity: {Liquidity}, CurrentTick: {CurrentTick}, TickRange: [{TickLower}, {TickUpper}]",
                position.Nonce, position.Liquidity, currentTick, position.TickLower, position.TickUpper);
            
            logger?.LogTrace("Fee growth - Global0: {FeeGrowthGlobal0}, Global1: {FeeGrowthGlobal1}",
                feeGrowthGlobal0X128, feeGrowthGlobal1X128);
            
            logger?.LogTrace("Position fee growth last - Inside0Last: {FeeGrowthInside0Last}, Inside1Last: {FeeGrowthInside1Last}",
                position.FeeGrowthInside0LastX128, position.FeeGrowthInside1LastX128);
            
            logger?.LogTrace("Tokens owed - TokensOwed0: {TokensOwed0}, TokensOwed1: {TokensOwed1}",
                position.TokensOwed0, position.TokensOwed1);

            if (HasInvalidData(feeGrowthGlobal0X128, feeGrowthGlobal1X128, currentTick, position, logger))
            {
                return HandleInvalidDataWithFallback(position, token0Decimals, token1Decimals, logger);
            }

            if (HasExtremeOverflowValues(position, logger))
            {
                logger?.LogWarning("Position {TokenId} has extreme overflow values, using TokensOwed only", position.Nonce);
                return new UncollectedFees 
                { 
                    Amount0 = ScaleTokenSafely(position.TokensOwed0, token0Decimals, logger), 
                    Amount1 = ScaleTokenSafely(position.TokensOwed1, token1Decimals, logger) 
                };
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

            logger?.LogTrace("Calculated feeGrowthInside - Token0: {FeeGrowthInside0}, Token1: {FeeGrowthInside1}",
                feeGrowthInside0X128, feeGrowthInside1X128);


            var feeGrowthDelta0X128 = SubtractUint256(feeGrowthInside0X128, position.FeeGrowthInside0LastX128, logger);
            var feeGrowthDelta1X128 = SubtractUint256(feeGrowthInside1X128, position.FeeGrowthInside1LastX128, logger);

            logger?.LogTrace("Fee growth delta - Token0: {FeeGrowthDelta0}, Token1: {FeeGrowthDelta1}",
                feeGrowthDelta0X128, feeGrowthDelta1X128);


            var feesEarned0 = (position.Liquidity * feeGrowthDelta0X128) / Q128;
            var feesEarned1 = (position.Liquidity * feeGrowthDelta1X128) / Q128;

            logger?.LogTrace("Fees earned - Token0: {FeesEarned0}, Token1: {FeesEarned1}",
                feesEarned0, feesEarned1);

            var totalOwed0 = position.TokensOwed0 + feesEarned0;
            var totalOwed1 = position.TokensOwed1 + feesEarned1;

            logger?.LogTrace("Total owed - Token0: {TotalOwed0}, Token1: {TotalOwed1}",
                totalOwed0, totalOwed1);

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


        private static bool HasExtremeOverflowValues(PositionDTO position, ILogger? logger)
        {

            BigInteger EXTREME_OVERFLOW_THRESHOLD = new BigInteger(new byte[] {
                0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
                0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x7F
            });

            bool currentTick = false; 
            bool hasOverflow = (position.FeeGrowthInside0LastX128 > EXTREME_OVERFLOW_THRESHOLD || 
                               position.FeeGrowthInside1LastX128 > EXTREME_OVERFLOW_THRESHOLD);

            if (hasOverflow)
            {
                logger?.LogWarning("Position {TokenId} has extreme overflow values - FeeGrowthInside0Last: {FeeGrowthInside0Last}, FeeGrowthInside1Last: {FeeGrowthInside1Last}",
                    position.Nonce, position.FeeGrowthInside0LastX128, position.FeeGrowthInside1LastX128);
            }

            return hasOverflow;
        }


        private static UncollectedFees HandleInvalidDataWithFallback(PositionDTO position, 
            int token0Decimals, int token1Decimals, ILogger? logger)
        {
            logger?.LogDebug("Using fallback strategies for position {TokenId} due to invalid data", position.Nonce);

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

            logger?.LogTrace("Fee growth calculation - Below: {Below}, Above: {Above}, Inside: {Inside}",
                feeGrowthBelowX128, feeGrowthAboveX128, feeGrowthInsideX128);

            return feeGrowthInsideX128;
        }


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

                BigInteger MAX_UINT256 = BigInteger.Pow(2, 256) - 1;
                var result = (MAX_UINT256 - last) + current + 1;
                
                logger?.LogTrace("Uint256 subtraction with overflow - {Current} - {Last} = {Result}", current, last, result);

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
                
                logger?.LogTrace("Token scaling - Value: {Value}, Decimals: {Decimals}, Result: {Result}",
                    value, decimals, result);

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
