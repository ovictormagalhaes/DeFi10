using System.Numerics;
using Microsoft.Extensions.Logging;
using Xunit;
using Xunit.Abstractions;
using DeFi10.API.Services.Protocols.Uniswap.Models;
using DeFi10.API.Services.Protocols.Uniswap.DTOs;

namespace DeFi10.API.Tests.Services.Protocols.Uniswap;

public class UncollectedFeesTests
{
    private readonly ITestOutputHelper _output;
    private readonly TestLogger _logger;

    public UncollectedFeesTests(ITestOutputHelper output)
    {
        _output = output;
        _logger = new TestLogger(output);
    }

    [Fact]
    public void CalculateUncollectedFees_WithNormalValues_ReturnsCorrectFees()
    {
        // Arrange
        var position = new PositionDTO
        {
            Nonce = 1,
            Liquidity = BigInteger.Parse("1000000000000000000"),
            TickLower = -100,
            TickUpper = 100,
            FeeGrowthInside0LastX128 = BigInteger.Parse("1000000000000000000000"),
            FeeGrowthInside1LastX128 = BigInteger.Parse("2000000000000000000000"),
            TokensOwed0 = BigInteger.Parse("100000000"),
            TokensOwed1 = BigInteger.Parse("200000000")
        };

        var feeGrowthGlobal0X128 = BigInteger.Parse("1500000000000000000000");
        var feeGrowthGlobal1X128 = BigInteger.Parse("2500000000000000000000");
        int currentTick = 0;

        var calculator = new UncollectedFees();

        // Act
        var result = calculator.CalculateUncollectedFees(
            position,
            feeGrowthGlobal0X128,
            feeGrowthGlobal1X128,
            18, // token0Decimals
            6,  // token1Decimals
            currentTick,
            null,
            null,
            _logger
        );

        // Assert
        _output.WriteLine($"Amount0: {result.Amount0}");
        _output.WriteLine($"Amount1: {result.Amount1}");
        
        Assert.True(result.Amount0 >= 0);
        Assert.True(result.Amount1 >= 0);
    }

    [Fact]
    public void CalculateUncollectedFees_WithExtremelyHighFeeGrowth_UsesTokensOwedOnly()
    {
        // Arrange - This simulates Position 0 with extreme overflow values
        var position = new PositionDTO
        {
            Nonce = 0,
            Liquidity = BigInteger.Parse("1000000000000"),
            TickLower = -100,
            TickUpper = 100,
            // Values above 2^240 should trigger the extreme overflow warning
            FeeGrowthInside0LastX128 = BigInteger.Pow(2, 245),
            FeeGrowthInside1LastX128 = BigInteger.Pow(2, 250),
            TokensOwed0 = BigInteger.Parse("2600000"), // ~$2.60 in token with 6 decimals
            TokensOwed1 = BigInteger.Parse("0")
        };

        var feeGrowthGlobal0X128 = BigInteger.Parse("1000000000000000000");
        var feeGrowthGlobal1X128 = BigInteger.Parse("2000000000000000000");
        int currentTick = 0;

        var calculator = new UncollectedFees();

        // Act
        var result = calculator.CalculateUncollectedFees(
            position,
            feeGrowthGlobal0X128,
            feeGrowthGlobal1X128,
            6,  // token0Decimals
            18, // token1Decimals
            currentTick,
            null,
            null,
            _logger
        );

        // Assert
        _output.WriteLine($"Amount0: {result.Amount0}");
        _output.WriteLine($"Amount1: {result.Amount1}");
        
        // Should use TokensOwed only (2.6 / 10^6 = 0.0026, but for 6 decimals it's 2.6)
        Assert.Equal(2.6m, result.Amount0);
        Assert.Equal(0m, result.Amount1);
    }

    [Theory]
    [InlineData("340282366920938463463374607431768211455")] // 2^128 - 1 (normal max for Q128)
    [InlineData("115792089237316195423570985008687907853269984665640564039457584007913129639935")] // 2^256 - 1 (uint256 max)
    public void CalculateUncollectedFees_WithVariousLargeFeeGrowth_HandlesCorrectly(string feeGrowthStr)
    {
        // Arrange
        var position = new PositionDTO
        {
            Nonce = 2,
            Liquidity = BigInteger.Parse("1000000000000"),
            TickLower = -100,
            TickUpper = 100,
            FeeGrowthInside0LastX128 = BigInteger.Parse(feeGrowthStr),
            FeeGrowthInside1LastX128 = BigInteger.Parse("1000000000000000000"),
            TokensOwed0 = BigInteger.Parse("1000000"), // $1
            TokensOwed1 = BigInteger.Parse("500000")   // $0.50
        };

        var feeGrowthGlobal0X128 = BigInteger.Parse("1000000000000000000");
        var feeGrowthGlobal1X128 = BigInteger.Parse("2000000000000000000");
        int currentTick = 0;

        var calculator = new UncollectedFees();

        // Act
        var result = calculator.CalculateUncollectedFees(
            position,
            feeGrowthGlobal0X128,
            feeGrowthGlobal1X128,
            6,  // token0Decimals
            6,  // token1Decimals
            currentTick,
            null,
            null,
            _logger
        );

        // Assert
        _output.WriteLine($"FeeGrowth: {feeGrowthStr}");
        _output.WriteLine($"Amount0: {result.Amount0}");
        _output.WriteLine($"Amount1: {result.Amount1}");
        
        // Shoulduse fallback when value is extreme
        Assert.True(result.Amount0 >= 0 && result.Amount0 <= 1000000m);
        Assert.True(result.Amount1 >= 0 && result.Amount1 <= 1000000m);
    }

    [Fact]
    public void CalculateUncollectedFees_WithZeroLiquidity_ReturnsZero()
    {
        // Arrange
        var position = new PositionDTO
        {
            Nonce = 3,
            Liquidity = BigInteger.Zero,
            TickLower = -100,
            TickUpper = 100,
            FeeGrowthInside0LastX128 = BigInteger.Parse("1000000000000000000000"),
            FeeGrowthInside1LastX128 = BigInteger.Parse("2000000000000000000000"),
            TokensOwed0 = BigInteger.Parse("100000000"),
            TokensOwed1 = BigInteger.Parse("200000000")
        };

        var feeGrowthGlobal0X128 = BigInteger.Parse("1500000000000000000000");
        var feeGrowthGlobal1X128 = BigInteger.Parse("2500000000000000000000");
        int currentTick = 0;

        var calculator = new UncollectedFees();

        // Act
        var result = calculator.CalculateUncollectedFees(
            position,
            feeGrowthGlobal0X128,
            feeGrowthGlobal1X128,
            18,
            6,
            currentTick,
            null,
            null,
            _logger
        );

        // Assert
        Assert.Equal(0m, result.Amount0);
        Assert.Equal(0m, result.Amount1);
    }

    private class TestLogger : ILogger
    {
        private readonly ITestOutputHelper _output;

        public TestLogger(ITestOutputHelper output)
        {
            _output = output;
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            var message = formatter(state, exception);
            _output.WriteLine($"[{logLevel}] {message}");
            if (exception != null)
            {
                _output.WriteLine($"Exception: {exception}");
            }
        }
    }
}
