using System.Numerics;

namespace MyWebWallet.API.Services.Models
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
            TickInfoDTO? upperTickInfo = null)
        {
            BigInteger Q128 = BigInteger.Pow(2, 128);

            if (position.Liquidity == 0)
            {
                return new UncollectedFees { Amount0 = 0, Amount1 = 0 };
            }

            BigInteger feeGrowthInside0X128, feeGrowthInside1X128;

            if (lowerTickInfo != null && upperTickInfo != null)
            {
                (feeGrowthInside0X128, feeGrowthInside1X128) = CalculateFeeGrowthInside(
                    feeGrowthGlobal0X128, feeGrowthGlobal1X128,
                    currentTick, position.TickLower, position.TickUpper,
                    lowerTickInfo, upperTickInfo);
            }
            else
            {
                if (currentTick >= position.TickLower && currentTick < position.TickUpper)
                {
                    feeGrowthInside0X128 = feeGrowthGlobal0X128;
                    feeGrowthInside1X128 = feeGrowthGlobal1X128;
                }
                else
                {
                    feeGrowthInside0X128 = feeGrowthGlobal0X128;
                    feeGrowthInside1X128 = feeGrowthGlobal1X128;
                }
            }

            var feeGrowthDelta0X128 = SubtractUint256(feeGrowthInside0X128, position.FeeGrowthInside0LastX128);
            var feeGrowthDelta1X128 = SubtractUint256(feeGrowthInside1X128, position.FeeGrowthInside1LastX128);

            var feesEarned0 = (position.Liquidity * feeGrowthDelta0X128) / Q128;
            var feesEarned1 = (position.Liquidity * feeGrowthDelta1X128) / Q128;

            var totalOwed0 = position.TokensOwed0 + feesEarned0;
            var totalOwed1 = position.TokensOwed1 + feesEarned1;

            var amount0 = SafeBigIntegerToDecimal(totalOwed0) / (decimal)BigInteger.Pow(10, token0Decimals);
            var amount1 = SafeBigIntegerToDecimal(totalOwed1) / (decimal)BigInteger.Pow(10, token1Decimals);

            return new UncollectedFees
            {
                Amount0 = amount0,
                Amount1 = amount1
            };
        }

        private (BigInteger feeGrowthInside0X128, BigInteger feeGrowthInside1X128) CalculateFeeGrowthInside(
            BigInteger feeGrowthGlobal0X128,
            BigInteger feeGrowthGlobal1X128,
            int currentTick,
            int tickLower,
            int tickUpper,
            TickInfoDTO lowerTickInfo,
            TickInfoDTO upperTickInfo)
        {
            BigInteger feeGrowthBelow0X128, feeGrowthBelow1X128;
            BigInteger feeGrowthAbove0X128, feeGrowthAbove1X128;

            if (currentTick >= tickLower)
            {
                feeGrowthBelow0X128 = lowerTickInfo.FeeGrowthOutside0X128;
                feeGrowthBelow1X128 = lowerTickInfo.FeeGrowthOutside1X128;
            }
            else
            {
                feeGrowthBelow0X128 = SubtractUint256(feeGrowthGlobal0X128, lowerTickInfo.FeeGrowthOutside0X128);
                feeGrowthBelow1X128 = SubtractUint256(feeGrowthGlobal1X128, lowerTickInfo.FeeGrowthOutside1X128);
            }

            if (currentTick < tickUpper)
            {
                feeGrowthAbove0X128 = upperTickInfo.FeeGrowthOutside0X128;
                feeGrowthAbove1X128 = upperTickInfo.FeeGrowthOutside1X128;
            }
            else
            {
                feeGrowthAbove0X128 = SubtractUint256(feeGrowthGlobal0X128, upperTickInfo.FeeGrowthOutside0X128);
                feeGrowthAbove1X128 = SubtractUint256(feeGrowthGlobal1X128, upperTickInfo.FeeGrowthOutside1X128);
            }

            var feeGrowthInside0X128 = SubtractUint256(
                SubtractUint256(feeGrowthGlobal0X128, feeGrowthBelow0X128), 
                feeGrowthAbove0X128);
            
            var feeGrowthInside1X128 = SubtractUint256(
                SubtractUint256(feeGrowthGlobal1X128, feeGrowthBelow1X128), 
                feeGrowthAbove1X128);

            return (feeGrowthInside0X128, feeGrowthInside1X128);
        }

        private BigInteger SubtractUint256(BigInteger current, BigInteger last)
        {
            if (current >= last)
            {
                return current - last;
            }
            else
            {
                BigInteger MAX_UINT256 = BigInteger.Pow(2, 256) - 1;
                return (MAX_UINT256 - last) + current + 1;
            }
        }

        private decimal SafeBigIntegerToDecimal(BigInteger value)
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
