using System.Numerics;
using MyWebWallet.API.Raydium;
using Xunit;
using Xunit.Abstractions;

namespace MyWebWallet.API.Tests
{
    public class RaydiumMathTests
    {
        private readonly ITestOutputHelper _output;

        public RaydiumMathTests(ITestOutputHelper output)
        {
            _output = output;
        }

        [Fact]
        public void Test_GetSqrtPriceAtTick_ExtremeNegativeTick()
        {
            // Arrange
            int extremeTick = -443636; // MIN_TICK

            // Act
            BigInteger sqrtPriceX64 = RaydiumMath.GetSqrtPriceAtTick(extremeTick, _output);

            _output.WriteLine($"Tick: {extremeTick}");
            _output.WriteLine($"SqrtPriceX64 calculado: {sqrtPriceX64}");

            // Assert
            Assert.True(sqrtPriceX64 > 0, "GetSqrtPriceAtTick deve retornar valor positivo");
        }

        [Fact]
        public void Test_GetSqrtPriceAtTick_NormalTick()
        {
            // Arrange
            int normalTick = -20444;

            // Act
            BigInteger sqrtPriceX64 = RaydiumMath.GetSqrtPriceAtTick(normalTick, _output);

            _output.WriteLine($"Tick: {normalTick}");
            _output.WriteLine($"SqrtPriceX64 calculado: {sqrtPriceX64}");

            // Assert
            Assert.True(sqrtPriceX64 > 1, "GetSqrtPriceAtTick para ticks normais deve ser maior que 1.");
        }

        [Fact]
        public void Test_BelowRangePosition()
        {
            BigInteger liquidity = new BigInteger(14150000000); // 14.15 SOL scaled
            int tickLower = -20000;   // dentro do range válido
            int tickUpper = -19000;   // dentro do range válido
            BigInteger sqrtPriceX64 = RaydiumMath.GetSqrtPriceAtTick(-21000, _output); // preço abaixo do lower

            var (amountA, amountB) = RaydiumMath.CalculateTokenAmounts(
                liquidity, tickLower, tickUpper, sqrtPriceX64, _output);

            _output.WriteLine($"Resultado: SOL={amountA}, USDC={amountB}");

            Assert.True(amountA > 0, "Deveria ter SOL");
            Assert.Equal(BigInteger.Zero, amountB);
        }

        [Fact]
        public void Test_AboveRangePosition()
        {
            BigInteger liquidity = new BigInteger(5000000);
            int tickLower = -20000;
            int tickUpper = -19000;
            BigInteger sqrtPriceX64 = RaydiumMath.GetSqrtPriceAtTick(-18000, _output); // acima do upper

            var (amountA, amountB) = RaydiumMath.CalculateTokenAmounts(
                liquidity, tickLower, tickUpper, sqrtPriceX64, _output);

            Assert.Equal(BigInteger.Zero, amountA);
            Assert.True(amountB > 0, "Deveria ter USDC");
        }

        [Fact]
        public void Test_InRangePosition()
        {
            BigInteger liquidity = new BigInteger(1000000);
            int tickLower = -20000;
            int tickUpper = -19000;
            BigInteger sqrtPriceX64 = RaydiumMath.GetSqrtPriceAtTick(-19500, _output); // dentro do range

            var (amountA, amountB) = RaydiumMath.CalculateTokenAmounts(
                liquidity, tickLower, tickUpper, sqrtPriceX64, _output);

            Assert.True(amountA > 0, "Deveria ter SOL parcial");
            Assert.True(amountB > 0, "Deveria ter USDC parcial");
        }
    }
}
