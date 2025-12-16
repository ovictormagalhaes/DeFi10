using System.Numerics;

namespace DeFi10.API.Services.Protocols.Raydium
{
    public static class RaydiumMath
    {

        private const int MIN_TICK = -443636;
        private const int MAX_TICK = 443636;
        
        private static readonly BigInteger Q64 = BigInteger.One << 64;


        private static readonly ulong[] MAGIC_FACTORS = new ulong[]
        {
            0xfffcb933bd6fb800,
            0xfff97272373d4000,
            0xfff2e50f5f657000,
            0xffe5caca7e10f000,
            0xffcb9843d60f7000,
            0xff973b41fa98e800,
            0xff2ea16466c9b000,
            0xfe5dee046a9a3800,
            0xfcbe86c7900bb000,
            0xf987a7253ac65800,
            0xf3392b0822bb6000,
            0xe7159475a2caf000,
            0xd097f3bdfd2f2000,
            0xa9f746462d9f8000,
            0x70d869a156f31c00,
            0x31be135f97ed3200,
            0x9aa508b5b85a500,
            0x5d6af8dedc582c,
            0x2216e584f5fa
        };


        public static BigInteger GetSqrtPriceAtTick(int tick)
        {
            if (tick < MIN_TICK || tick > MAX_TICK)
            {
                throw new ArgumentException($"Tick {tick} fora do range válido [{MIN_TICK}, {MAX_TICK}]");
            }

            uint absTick = (uint)Math.Abs(tick);

            BigInteger ratio = (absTick & 0x1) != 0 
                ? new BigInteger(MAGIC_FACTORS[0])
                : Q64;

            if ((absTick & 0x2) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[1]);
            if ((absTick & 0x4) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[2]);
            if ((absTick & 0x8) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[3]);
            if ((absTick & 0x10) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[4]);
            if ((absTick & 0x20) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[5]);
            if ((absTick & 0x40) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[6]);
            if ((absTick & 0x80) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[7]);
            if ((absTick & 0x100) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[8]);
            if ((absTick & 0x200) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[9]);
            if ((absTick & 0x400) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[10]);
            if ((absTick & 0x800) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[11]);
            if ((absTick & 0x1000) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[12]);
            if ((absTick & 0x2000) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[13]);
            if ((absTick & 0x4000) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[14]);
            if ((absTick & 0x8000) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[15]);
            if ((absTick & 0x10000) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[16]);
            if ((absTick & 0x20000) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[17]);
            if ((absTick & 0x40000) != 0)
                ratio = MultiplyShift(ratio, MAGIC_FACTORS[18]);

            if (tick > 0)
            {
                BigInteger maxU128 = (BigInteger.One << 128) - 1;
                ratio = maxU128 / ratio;
            }

            return ratio;
        }


        private static BigInteger MultiplyShift(BigInteger a, ulong b)
        {
            return (a * b) >> 64;
        }


        public static (BigInteger tokenA, BigInteger tokenB) CalculateTokenAmounts(
            BigInteger liquidity,
            int tickLower,
            int tickUpper,
            BigInteger sqrtPriceX64)
        {

            BigInteger sqrtLowerX64 = GetSqrtPriceAtTick(tickLower);
            BigInteger sqrtUpperX64 = GetSqrtPriceAtTick(tickUpper);

            if (sqrtLowerX64 > sqrtUpperX64)
            {
                var temp = sqrtLowerX64;
                sqrtLowerX64 = sqrtUpperX64;
                sqrtUpperX64 = temp;
            }

            BigInteger amount0 = 0;
            BigInteger amount1 = 0;

            if (sqrtPriceX64 <= sqrtLowerX64)
            {

                amount0 = GetAmount0Delta(sqrtLowerX64, sqrtUpperX64, liquidity, false);
            }
            else if (sqrtPriceX64 < sqrtUpperX64)
            {

                amount0 = GetAmount0Delta(sqrtPriceX64, sqrtUpperX64, liquidity, false);
                amount1 = GetAmount1Delta(sqrtLowerX64, sqrtPriceX64, liquidity, false);
            }
            else
            {

                amount1 = GetAmount1Delta(sqrtLowerX64, sqrtUpperX64, liquidity, false);
            }

            return (amount0, amount1);
        }


        private static BigInteger GetAmount0Delta(
            BigInteger sqrtRatioAX64,
            BigInteger sqrtRatioBX64,
            BigInteger liquidity,
            bool roundUp)
        {
            if (sqrtRatioAX64 > sqrtRatioBX64)
            {
                var temp = sqrtRatioAX64;
                sqrtRatioAX64 = sqrtRatioBX64;
                sqrtRatioBX64 = temp;
            }

            BigInteger numerator1 = liquidity << 64;

            BigInteger numerator2 = sqrtRatioBX64 - sqrtRatioAX64;

            if (sqrtRatioAX64 <= 0)
                throw new InvalidOperationException("sqrtRatioAX64 must be > 0");

            BigInteger result = (numerator1 * numerator2) / sqrtRatioBX64 / sqrtRatioAX64;

            return result;
        }


        private static BigInteger GetAmount1Delta(
            BigInteger sqrtRatioAX64,
            BigInteger sqrtRatioBX64,
            BigInteger liquidity,
            bool roundUp)
        {
            if (sqrtRatioAX64 > sqrtRatioBX64)
            {
                var temp = sqrtRatioAX64;
                sqrtRatioAX64 = sqrtRatioBX64;
                sqrtRatioBX64 = temp;
            }

            BigInteger result = (liquidity * (sqrtRatioBX64 - sqrtRatioAX64)) / Q64;

            return result;
        }
    }
}