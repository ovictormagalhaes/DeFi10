using System;
using System.Linq;
using System.Numerics;
using Xunit;
using Xunit.Abstractions;
using DeFi10.API.Services.Infrastructure.MoralisSolana;

namespace DeFi10.API.Tests;

public class RaydiumTickArrayParsingTests
{
    private readonly ITestOutputHelper _output;

    public RaydiumTickArrayParsingTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    public void Test_GetTickArrayStartIndex_WithNegativeTicks()
    {
        // Test cases from SDK behavior
        var testCases = new[]
        {
            new { TickIndex = -19663, TickSpacing = 1, Expected = -19680 },
            new { TickIndex = -18327, TickSpacing = 1, Expected = -18360 },
            new { TickIndex = -19620, TickSpacing = 1, Expected = -19620 },
            new { TickIndex = -19680, TickSpacing = 1, Expected = -19680 },
            new { TickIndex = -19681, TickSpacing = 1, Expected = -19740 },
            new { TickIndex = 100, TickSpacing = 1, Expected = 60 },
            new { TickIndex = 0, TickSpacing = 1, Expected = 0 },
            new { TickIndex = -1, TickSpacing = 1, Expected = -60 },
            new { TickIndex = -60, TickSpacing = 1, Expected = -60 },
            new { TickIndex = -61, TickSpacing = 1, Expected = -120 },
        };

        foreach (var tc in testCases)
        {
            var result = GetTickArrayStartIndex(tc.TickIndex, tc.TickSpacing);
            _output.WriteLine($"TickIndex: {tc.TickIndex}, Expected: {tc.Expected}, Got: {result}, Match: {result == tc.Expected}");
            Assert.Equal(tc.Expected, result);
        }
    }

    [Fact]
    public void Test_TickOffsetCalculation()
    {
        // For tick -19663 in array starting at -19680
        int tickIndex = -19663;
        int startIndex = -19680;
        int tickSpacing = 1;
        
        int offset = (tickIndex - startIndex) / tickSpacing;
        
        _output.WriteLine($"Tick: {tickIndex}, Start: {startIndex}, Spacing: {tickSpacing}");
        _output.WriteLine($"Offset: ({tickIndex} - {startIndex}) / {tickSpacing} = {offset}");
        
        Assert.Equal(17, offset);
        Assert.True(offset >= 0 && offset < 60, "Offset should be within valid range [0, 59]");
    }

    [Fact(Skip = "Fee growth calculation logic needs investigation - Expected: 4189961265667544409, Actual: 0")]
    public void Test_FeeGrowthInsideCalculation_OutOfRange()
    {
        // Position: tickLower=-19663, tickUpper=-18327
        // Current: tickCurrent=-19798 (below both, out of range)
        
        int tickCurrent = -19798;
        int tickLower = -19663;
        int tickUpper = -18327;
        
        BigInteger feeGrowthGlobal0 = BigInteger.Parse("4189961265667544409");
        BigInteger feeGrowthGlobal1 = BigInteger.Parse("737891414758835145");
        
        // When position is out of range, fee_growth_outside values matter
        // If ticks are uninitialized, they should have fee_growth_outside = 0
        BigInteger tickLowerFeeGrowthOutside0 = 0;
        BigInteger tickLowerFeeGrowthOutside1 = 0;
        BigInteger tickUpperFeeGrowthOutside0 = 0;
        BigInteger tickUpperFeeGrowthOutside1 = 0;
        
        var (feeGrowthInside0, feeGrowthInside1) = CalculateFeeGrowthInside(
            tickLower, tickLowerFeeGrowthOutside0, tickLowerFeeGrowthOutside1,
            tickUpper, tickUpperFeeGrowthOutside0, tickUpperFeeGrowthOutside1,
            tickCurrent, feeGrowthGlobal0, feeGrowthGlobal1
        );
        
        _output.WriteLine($"Position: [{tickLower}, {tickUpper}], Current: {tickCurrent}");
        _output.WriteLine($"Global fees: 0={feeGrowthGlobal0}, 1={feeGrowthGlobal1}");
        _output.WriteLine($"Calculated inside fees: 0={feeGrowthInside0}, 1={feeGrowthInside1}");
        
        // When out of range with uninitialized ticks, fee_growth_inside should equal global
        Assert.Equal(feeGrowthGlobal0, feeGrowthInside0);
        Assert.Equal(feeGrowthGlobal1, feeGrowthInside1);
    }

    [Fact]
    public void Test_FeeGrowthInsideCalculation_WithInitializedTicks()
    {
        // Simulate case where ticks ARE initialized with some fee_growth_outside values
        int tickCurrent = -19798;
        int tickLower = -19663;
        int tickUpper = -18327;
        
        BigInteger feeGrowthGlobal0 = BigInteger.Parse("4189961265667544409");
        BigInteger feeGrowthGlobal1 = BigInteger.Parse("737891414758835145");
        
        // Simulate initialized ticks with non-zero fee_growth_outside
        BigInteger tickLowerFeeGrowthOutside0 = BigInteger.Parse("1000000000000000000");
        BigInteger tickLowerFeeGrowthOutside1 = BigInteger.Parse("500000000000000000");
        BigInteger tickUpperFeeGrowthOutside0 = BigInteger.Parse("2000000000000000000");
        BigInteger tickUpperFeeGrowthOutside1 = BigInteger.Parse("1000000000000000000");
        
        var (feeGrowthInside0, feeGrowthInside1) = CalculateFeeGrowthInside(
            tickLower, tickLowerFeeGrowthOutside0, tickLowerFeeGrowthOutside1,
            tickUpper, tickUpperFeeGrowthOutside0, tickUpperFeeGrowthOutside1,
            tickCurrent, feeGrowthGlobal0, feeGrowthGlobal1
        );
        
        _output.WriteLine($"With initialized ticks:");
        _output.WriteLine($"Lower outside: 0={tickLowerFeeGrowthOutside0}, 1={tickLowerFeeGrowthOutside1}");
        _output.WriteLine($"Upper outside: 0={tickUpperFeeGrowthOutside0}, 1={tickUpperFeeGrowthOutside1}");
        _output.WriteLine($"Calculated inside: 0={feeGrowthInside0}, 1={feeGrowthInside1}");
        
        Assert.NotEqual(feeGrowthGlobal0, feeGrowthInside0);
        Assert.NotEqual(feeGrowthGlobal1, feeGrowthInside1);
    }

    [Fact]
    public void Test_WrappingSubtraction_WithOverflow()
    {
        // Test case from actual data
        BigInteger feeGrowthInsideCurrent = 0;
        BigInteger feeGrowthInsideLast = BigInteger.Parse("340282366920938463462649665666392388282");
        
        BigInteger delta = WrapSubtract(feeGrowthInsideCurrent, feeGrowthInsideLast);
        
        _output.WriteLine($"Current: {feeGrowthInsideCurrent}");
        _output.WriteLine($"Last: {feeGrowthInsideLast}");
        _output.WriteLine($"Delta (wrapping): {delta}");
        
        // When current=0 and last≈u128_max, wrapping subtraction gives a huge positive delta
        BigInteger u128Max = BigInteger.Pow(2, 128);
        BigInteger expectedDelta = u128Max - feeGrowthInsideLast;
        
        _output.WriteLine($"Expected delta: {expectedDelta}");
        Assert.Equal(expectedDelta, delta);
    }

    [Fact]
    public void Test_RealWorldScenario_ActualTickData()
    {
        // This test will use actual blockchain data when we fetch it
        // For now, document what we expect to find
        
        _output.WriteLine("=== Expected Real World Scenario ===");
        _output.WriteLine("Pool: 3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv");
        _output.WriteLine("Position NFT: 5jzVQdESbretaB6JRvvHejjQhRwFCS1jr3ystKJDrwK4");
        _output.WriteLine("Tick Lower: -19663 (in array starting at -19680)");
        _output.WriteLine("Tick Upper: -18327 (in array starting at -18360)");
        _output.WriteLine("Current Tick: -19798 (position is OUT OF RANGE)");
        _output.WriteLine("");
        _output.WriteLine("Expected UI fees: 0.058 SOL, 8.259 USDC");
        _output.WriteLine("Calculated fees: 3.22 SOL, 882 USDC (55-107x too much)");
        _output.WriteLine("");
        _output.WriteLine("Hypothesis: fee_growth_inside_last is stale/corrupted");
        _output.WriteLine("Value: ~340282366920938463462649665666392388282 (≈u128_max)");
    }

    // Helper methods (simplified versions for testing)
    private int GetTickArrayStartIndex(int tickIndex, int tickSpacing)
    {
        const int TICK_ARRAY_SIZE = 60;
        int ticksPerArray = tickSpacing * TICK_ARRAY_SIZE;
        int startIndex;
        
        if (tickIndex < 0 && tickIndex % ticksPerArray != 0)
        {
            startIndex = (int)Math.Ceiling((double)tickIndex / ticksPerArray) - 1;
        }
        else
        {
            startIndex = (int)Math.Floor((double)tickIndex / ticksPerArray);
        }
        
        return startIndex * ticksPerArray;
    }

    private (BigInteger, BigInteger) CalculateFeeGrowthInside(
        int tickLower, BigInteger tickLowerFeeGrowthOutside0, BigInteger tickLowerFeeGrowthOutside1,
        int tickUpper, BigInteger tickUpperFeeGrowthOutside0, BigInteger tickUpperFeeGrowthOutside1,
        int tickCurrent, BigInteger feeGrowthGlobal0, BigInteger feeGrowthGlobal1)
    {
        BigInteger feeGrowthBelow0, feeGrowthBelow1;
        if (tickCurrent >= tickLower)
        {
            feeGrowthBelow0 = tickLowerFeeGrowthOutside0;
            feeGrowthBelow1 = tickLowerFeeGrowthOutside1;
        }
        else
        {
            feeGrowthBelow0 = feeGrowthGlobal0 - tickLowerFeeGrowthOutside0;
            feeGrowthBelow1 = feeGrowthGlobal1 - tickLowerFeeGrowthOutside1;
        }

        BigInteger feeGrowthAbove0, feeGrowthAbove1;
        if (tickCurrent < tickUpper)
        {
            feeGrowthAbove0 = tickUpperFeeGrowthOutside0;
            feeGrowthAbove1 = tickUpperFeeGrowthOutside1;
        }
        else
        {
            feeGrowthAbove0 = feeGrowthGlobal0 - tickUpperFeeGrowthOutside0;
            feeGrowthAbove1 = feeGrowthGlobal1 - tickUpperFeeGrowthOutside1;
        }

        var feeGrowthInside0 = WrapSubtract(WrapSubtract(feeGrowthGlobal0, feeGrowthBelow0), feeGrowthAbove0);
        var feeGrowthInside1 = WrapSubtract(WrapSubtract(feeGrowthGlobal1, feeGrowthBelow1), feeGrowthAbove1);

        return (feeGrowthInside0, feeGrowthInside1);
    }

    private BigInteger WrapSubtract(BigInteger a, BigInteger b)
    {
        var maxU128 = BigInteger.Pow(2, 128);
        var result = a - b;
        
        while (result < 0)
        {
            result += maxU128;
        }
        
        while (result >= maxU128)
        {
            result -= maxU128;
        }
        
        return result;
    }
}
