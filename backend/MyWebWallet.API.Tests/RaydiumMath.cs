using System;
using System.Numerics;
using Xunit.Abstractions;

namespace MyWebWallet.API.Raydium
{
    public static class RaydiumMath
    {
        // Constantes do Raydium CLMM (baseado em tick_math.rs)
        private const int MIN_TICK = -443636;
        private const int MAX_TICK = 443636;
        
        private static readonly BigInteger Q64 = BigInteger.One << 64;
        
        // Magic factors do Raydium para calcular 1.0001^(tick/2)
        // Estes são os valores usados no código Rust oficial
        private static readonly ulong[] MAGIC_FACTORS = new ulong[]
        {
            0xfffcb933bd6fb800, // i=0: bit 0x1
            0xfff97272373d4000, // i=1: bit 0x2
            0xfff2e50f5f657000, // i=2: bit 0x4
            0xffe5caca7e10f000, // i=3: bit 0x8
            0xffcb9843d60f7000, // i=4: bit 0x10
            0xff973b41fa98e800, // i=5: bit 0x20
            0xff2ea16466c9b000, // i=6: bit 0x40
            0xfe5dee046a9a3800, // i=7: bit 0x80
            0xfcbe86c7900bb000, // i=8: bit 0x100
            0xf987a7253ac65800, // i=9: bit 0x200
            0xf3392b0822bb6000, // i=10: bit 0x400
            0xe7159475a2caf000, // i=11: bit 0x800
            0xd097f3bdfd2f2000, // i=12: bit 0x1000
            0xa9f746462d9f8000, // i=13: bit 0x2000
            0x70d869a156f31c00, // i=14: bit 0x4000
            0x31be135f97ed3200, // i=15: bit 0x8000
            0x9aa508b5b85a500,  // i=16: bit 0x10000
            0x5d6af8dedc582c,   // i=17: bit 0x20000
            0x2216e584f5fa       // i=18: bit 0x40000
        };

        /// <summary>
        /// Implementação exata do get_sqrt_price_at_tick do Raydium
        /// Calcula 1.0001^(tick/2) como U64.64 (sqrtPriceX64)
        /// </summary>
        public static BigInteger GetSqrtPriceAtTick(int tick, ITestOutputHelper? output)
        {
            output?.WriteLine($"[GetSqrtPriceAtTick] Tick: {tick}");
            
            if (tick < MIN_TICK || tick > MAX_TICK)
            {
                throw new ArgumentException($"Tick {tick} fora do range válido [{MIN_TICK}, {MAX_TICK}]");
            }

            uint absTick = (uint)Math.Abs(tick);
            
            // Começar com ratio = 1.0 em Q64 (ou magic[0] se bit 0 está set)
            BigInteger ratio = (absTick & 0x1) != 0 
                ? new BigInteger(MAGIC_FACTORS[0])
                : Q64;

            // Aplicar os magic factors para cada bit set
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

            // Se tick positivo, inverter o ratio
            if (tick > 0)
            {
                BigInteger maxU128 = (BigInteger.One << 128) - 1;
                ratio = maxU128 / ratio;
            }

            output?.WriteLine($"[GetSqrtPriceAtTick] Result: {ratio}");
            return ratio;
        }

        /// <summary>
        /// Multiplica dois U128 em Q64 e shifta para manter escala Q64
        /// Equivalente a: (a * b) >> 64
        /// </summary>
        private static BigInteger MultiplyShift(BigInteger a, ulong b)
        {
            return (a * b) >> 64;
        }

        /// <summary>
        /// Calcula token amounts baseado na implementação liquidity_math.rs
        /// </summary>
        public static (BigInteger tokenA, BigInteger tokenB) CalculateTokenAmounts(
            BigInteger liquidity,
            int tickLower,
            int tickUpper,
            BigInteger sqrtPriceX64,
            ITestOutputHelper? output)
        {
            output?.WriteLine($"\n[CalculateTokenAmounts] Inputs:");
            output?.WriteLine($"  Liquidity: {liquidity}");
            output?.WriteLine($"  TickLower: {tickLower}, TickUpper: {tickUpper}");
            output?.WriteLine($"  SqrtPriceX64: {sqrtPriceX64}");

            // Obter sqrt prices dos ticks
            BigInteger sqrtLowerX64 = GetSqrtPriceAtTick(tickLower, output);
            BigInteger sqrtUpperX64 = GetSqrtPriceAtTick(tickUpper, output);

            // Garantir que lower < upper
            if (sqrtLowerX64 > sqrtUpperX64)
            {
                var temp = sqrtLowerX64;
                sqrtLowerX64 = sqrtUpperX64;
                sqrtUpperX64 = temp;
            }

            output?.WriteLine($"  SqrtLowerX64: {sqrtLowerX64}");
            output?.WriteLine($"  SqrtUpperX64: {sqrtUpperX64}");

            BigInteger amount0 = 0;
            BigInteger amount1 = 0;

            if (sqrtPriceX64 <= sqrtLowerX64)
            {
                // Preço atual abaixo do range → apenas token0
                output?.WriteLine("[Status] BELOW range → 100% token0");
                amount0 = GetAmount0Delta(sqrtLowerX64, sqrtUpperX64, liquidity, false);
            }
            else if (sqrtPriceX64 < sqrtUpperX64)
            {
                // Preço atual dentro do range → ambos tokens
                output?.WriteLine("[Status] IN-RANGE → mixed tokens");
                amount0 = GetAmount0Delta(sqrtPriceX64, sqrtUpperX64, liquidity, false);
                amount1 = GetAmount1Delta(sqrtLowerX64, sqrtPriceX64, liquidity, false);
            }
            else
            {
                // Preço atual acima do range → apenas token1
                output?.WriteLine("[Status] ABOVE range → 100% token1");
                amount1 = GetAmount1Delta(sqrtLowerX64, sqrtUpperX64, liquidity, false);
            }

            output?.WriteLine($"[CalculateTokenAmounts] Results:");
            output?.WriteLine($"  Amount0: {amount0}");
            output?.WriteLine($"  Amount1: {amount1}");

            return (amount0, amount1);
        }

        /// <summary>
        /// Calcula delta amount0 (token A)
        /// Formula: Δx = L * (√P_upper - √P_lower) / (√P_upper * √P_lower)
        /// Equivalente a: L * (1/√P_lower - 1/√P_upper)
        /// </summary>
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

            // numerator1 = liquidity << 64
            BigInteger numerator1 = liquidity << 64;
            
            // numerator2 = sqrtRatioBX64 - sqrtRatioAX64
            BigInteger numerator2 = sqrtRatioBX64 - sqrtRatioAX64;

            if (sqrtRatioAX64 <= 0)
                throw new InvalidOperationException("sqrtRatioAX64 must be > 0");

            // result = (numerator1 * numerator2 / sqrtRatioBX64) / sqrtRatioAX64
            BigInteger result = (numerator1 * numerator2) / sqrtRatioBX64 / sqrtRatioAX64;

            return result;
        }

        /// <summary>
        /// Calcula delta amount1 (token B)
        /// Formula: Δy = L * (√P_upper - √P_lower)
        /// </summary>
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

            // result = liquidity * (sqrtRatioBX64 - sqrtRatioAX64) / Q64
            BigInteger result = (liquidity * (sqrtRatioBX64 - sqrtRatioAX64)) / Q64;

            return result;
        }
    }
}
