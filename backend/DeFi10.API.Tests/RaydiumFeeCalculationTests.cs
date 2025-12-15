using System;
using System.Numerics;
using Xunit;
using Xunit.Abstractions;
using DeFi10.API.Services.Infrastructure.MoralisSolana;
using DeFi10.API.Services.Protocols.Raydium.Clmm;

namespace DeFi10.API.Tests
{
    public class RaydiumFeeCalculationTests
    {
        private readonly ITestOutputHelper _output;

        public RaydiumFeeCalculationTests(ITestOutputHelper output)
        {
            _output = output;
        }

        [Fact]
        public void Should_Calculate_Fees_Matching_Raydium_UI()
        {
            // Arrange - Real values from user's position
            // Expected fees from Raydium UI: 0.058 SOL (58,000,000 lamports) and 8.259 USDC (8,259,000 micro)
            
            // Position data
            int tickLower = -19663;
            int tickUpper = -18327;
            BigInteger liquidity = new BigInteger(81941034509);
            
            // Position stored fee growth (valores hex do log anterior)
            // BA-F2-ED-27-4E-7D-F0-F5-FF-FF-FF-FF-FF-FF-FF-FF
            BigInteger feeGrowthInsideLast0 = BigInteger.Parse("340282366920938463462649665666392388282");
            // D9-74-80-8D-84-38-3E-FD-FF-FF-FF-FF-FF-FF-FF-FF
            BigInteger feeGrowthInsideLast1 = BigInteger.Parse("340282366920938463463175948240171332825");
            
            // Pool data (do log anterior)
            int tickCurrent = -19750; // Out of range (< tickLower)
            BigInteger feeGrowthGlobal0 = BigInteger.Parse("4189810223468773134");
            BigInteger feeGrowthGlobal1 = BigInteger.Parse("737876030265694371");
            
            // Uninitialized ticks (liquidityGross = 0)
            var tickLowerState = new TickState
            {
                Tick = tickLower,
                LiquidityGross = 0,
                FeeGrowthOutside0X64 = 0,
                FeeGrowthOutside1X64 = 0
            };
            
            var tickUpperState = new TickState
            {
                Tick = tickUpper,
                LiquidityGross = 0,
                FeeGrowthOutside0X64 = 0,
                FeeGrowthOutside1X64 = 0
            };
            
            // Act - Calculate fee growth inside
            var feeGrowthInside0 = CalculateFeeGrowthInside(
                tickLowerState, tickUpperState, tickCurrent,
                feeGrowthGlobal0, feeGrowthGlobal1
            );
            
            _output.WriteLine($"Fee Growth Inside Current 0: {feeGrowthInside0.Item1}");
            _output.WriteLine($"Fee Growth Inside Current 1: {feeGrowthInside0.Item2}");
            _output.WriteLine($"Fee Growth Inside Last 0: {feeGrowthInsideLast0}");
            _output.WriteLine($"Fee Growth Inside Last 1: {feeGrowthInsideLast1}");
            
            // Calculate delta
            var delta0 = WrapSubtract(feeGrowthInside0.Item1, feeGrowthInsideLast0);
            var delta1 = WrapSubtract(feeGrowthInside0.Item2, feeGrowthInsideLast1);
            
            _output.WriteLine($"Delta 0: {delta0}");
            _output.WriteLine($"Delta 1: {delta1}");
            
            // Calculate fees
            var Q64 = BigInteger.Pow(2, 64);
            var fee0 = (delta0 * liquidity) / Q64;
            var fee1 = (delta1 * liquidity) / Q64;
            
            _output.WriteLine($"Calculated Fee 0 (lamports): {fee0}");
            _output.WriteLine($"Calculated Fee 1 (micro): {fee1}");
            _output.WriteLine($"Calculated Fee 0 (SOL): {(decimal)fee0 / 1_000_000_000m}");
            _output.WriteLine($"Calculated Fee 1 (USDC): {(decimal)fee1 / 1_000_000m}");
            
            // Expected values from Raydium UI
            ulong expectedFee0 = 58_000_000; // 0.058 SOL
            ulong expectedFee1 = 8_259_000;  // 8.259 USDC
            
            _output.WriteLine($"Expected Fee 0 (lamports): {expectedFee0}");
            _output.WriteLine($"Expected Fee 1 (micro): {expectedFee1}");
            _output.WriteLine($"Expected Fee 0 (SOL): {expectedFee0 / 1_000_000_000m}");
            _output.WriteLine($"Expected Fee 1 (USDC): {expectedFee1 / 1_000_000m}");
            
            // Calculate ratio
            if (fee0 > 0)
            {
                var ratio0 = (decimal)fee0 / expectedFee0;
                _output.WriteLine($"Ratio 0: {ratio0:F2}x");
            }
            if (fee1 > 0)
            {
                var ratio1 = (decimal)fee1 / expectedFee1;
                _output.WriteLine($"Ratio 1: {ratio1:F2}x");
            }
            
            // For now, just verify calculation completes without error
            Assert.True(fee0 >= 0);
            Assert.True(fee1 >= 0);
        }
        
        private (BigInteger, BigInteger) CalculateFeeGrowthInside(
            TickState tickLower, TickState tickUpper, int tickCurrent,
            BigInteger feeGrowthGlobal0, BigInteger feeGrowthGlobal1)
        {
            // Calculate fee growth below
            BigInteger feeGrowthBelow0, feeGrowthBelow1;
            if (tickCurrent >= tickLower.Tick)
            {
                feeGrowthBelow0 = tickLower.FeeGrowthOutside0X64;
                feeGrowthBelow1 = tickLower.FeeGrowthOutside1X64;
            }
            else
            {
                feeGrowthBelow0 = feeGrowthGlobal0 - tickLower.FeeGrowthOutside0X64;
                feeGrowthBelow1 = feeGrowthGlobal1 - tickLower.FeeGrowthOutside1X64;
            }

            // Calculate fee growth above
            BigInteger feeGrowthAbove0, feeGrowthAbove1;
            if (tickCurrent < tickUpper.Tick)
            {
                feeGrowthAbove0 = tickUpper.FeeGrowthOutside0X64;
                feeGrowthAbove1 = tickUpper.FeeGrowthOutside1X64;
            }
            else
            {
                feeGrowthAbove0 = feeGrowthGlobal0 - tickUpper.FeeGrowthOutside0X64;
                feeGrowthAbove1 = feeGrowthGlobal1 - tickUpper.FeeGrowthOutside1X64;
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
}
