using Microsoft.Extensions.Logging;
using DeFi10.API.Services.Solana.Raydium.Clmm;
using Xunit.Abstractions;

namespace DeFi10.API.Tests
{
    public class RaydiumApiServiceTests
    {
        private readonly ITestOutputHelper _output;
        private readonly RaydiumApiService _service;

        public RaydiumApiServiceTests(ITestOutputHelper output)
        {
            _output = output;
            
            var httpClient = new HttpClient();
            var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
            var logger = loggerFactory.CreateLogger<RaydiumApiService>();
            
            _service = new RaydiumApiService(httpClient, logger);
        }

        [Fact]
        [Trait("Category", "Integration")]
        public async Task Should_Get_Pool_Info_From_Raydium_API()
        {
            // Arrange
            var poolId = "3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv"; // SOL/USDC pool

            // Act
            var result = await _service.GetPoolInfoAsync(poolId);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("Concentrated", result.Type);
            Assert.Equal(poolId, result.Id);
            
            _output.WriteLine($"Pool Type: {result.Type}");
            _output.WriteLine($"Pool ID: {result.Id}");
            _output.WriteLine($"Program ID: {result.ProgramId}");
            
            // Verify token A (SOL)
            Assert.NotNull(result.MintA);
            Assert.Equal("So11111111111111111111111111111111111111112", result.MintA.Address);
            Assert.Equal("WSOL", result.MintA.Symbol);
            Assert.Equal(9, result.MintA.Decimals);
            
            _output.WriteLine($"Token A: {result.MintA.Symbol} ({result.MintA.Name})");
            _output.WriteLine($"  Address: {result.MintA.Address}");
            _output.WriteLine($"  Decimals: {result.MintA.Decimals}");
            
            // Verify token B (USDC)
            Assert.NotNull(result.MintB);
            Assert.Equal("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", result.MintB.Address);
            Assert.Equal("USDC", result.MintB.Symbol);
            Assert.Equal(6, result.MintB.Decimals);
            
            _output.WriteLine($"Token B: {result.MintB.Symbol} ({result.MintB.Name})");
            _output.WriteLine($"  Address: {result.MintB.Address}");
            _output.WriteLine($"  Decimals: {result.MintB.Decimals}");
            
            // Verify pool metrics
            Assert.True(result.Price > 0);
            Assert.True(result.Tvl > 0);
            Assert.True(result.FeeRate > 0);
            
            _output.WriteLine($"\nPool Metrics:");
            _output.WriteLine($"  Price: {result.Price:F6}");
            _output.WriteLine($"  TVL: ${result.Tvl:N2}");
            _output.WriteLine($"  Fee Rate: {result.FeeRate * 100:F2}%");
            _output.WriteLine($"  Amount A: {result.MintAmountA:F9}");
            _output.WriteLine($"  Amount B: {result.MintAmountB:F6}");
            
            // Verify stats
            if (result.Day != null)
            {
                _output.WriteLine($"\n24h Stats:");
                _output.WriteLine($"  Volume: ${result.Day.Volume:N2}");
                _output.WriteLine($"  Volume Fee: ${result.Day.VolumeFee:N2}");
                _output.WriteLine($"  APR: {result.Day.Apr:F2}%");
                _output.WriteLine($"  Fee APR: {result.Day.FeeApr:F2}%");
                _output.WriteLine($"  Price Min: {result.Day.PriceMin:F6}");
                _output.WriteLine($"  Price Max: {result.Day.PriceMax:F6}");
            }
            
            // Verify config
            if (result.Config != null)
            {
                Assert.True(result.Config.TickSpacing > 0);
                
                _output.WriteLine($"\nPool Config:");
                _output.WriteLine($"  Config ID: {result.Config.Id}");
                _output.WriteLine($"  Tick Spacing: {result.Config.TickSpacing}");
                _output.WriteLine($"  Trade Fee Rate: {result.Config.TradeFeeRate}");
                _output.WriteLine($"  Protocol Fee Rate: {result.Config.ProtocolFeeRate}");
            }
            
            // Verify rewards
            if (result.RewardDefaultInfos != null && result.RewardDefaultInfos.Count > 0)
            {
                _output.WriteLine($"\nRewards:");
                foreach (var reward in result.RewardDefaultInfos)
                {
                    _output.WriteLine($"  Token: {reward.Mint?.Symbol} ({reward.Mint?.Name})");
                    _output.WriteLine($"  Per Second: {reward.PerSecond}");
                    _output.WriteLine($"  Start Time: {reward.StartTime}");
                    _output.WriteLine($"  End Time: {reward.EndTime}");
                }
            }
        }

        [Fact]
        [Trait("Category", "Integration")]
        public async Task Should_Return_Null_For_Invalid_Pool_Id()
        {
            // Arrange
            var invalidPoolId = "InvalidPoolId123456789";

            // Act
            var result = await _service.GetPoolInfoAsync(invalidPoolId);

            // Assert
            Assert.Null(result);
            _output.WriteLine("Correctly returned null for invalid pool ID");
        }

        [Fact]
        [Trait("Category", "Integration")]
        public async Task Should_Handle_Multiple_Pool_Requests()
        {
            // Arrange
            var poolIds = new[]
            {
                "3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv", // SOL/USDC
                // Add more pool IDs if needed
            };

            // Act
            var tasks = poolIds.Select(id => _service.GetPoolInfoAsync(id));
            var results = await Task.WhenAll(tasks);

            // Assert
            Assert.All(results, result => Assert.NotNull(result));
            
            _output.WriteLine($"Successfully fetched {results.Length} pools");
            foreach (var result in results)
            {
                if (result != null)
                {
                    _output.WriteLine($"  Pool: {result.MintA.Symbol}/{result.MintB.Symbol} - TVL: ${result.Tvl:N2}");
                }
            }
        }

        [Fact]
        [Trait("Category", "Integration")]
        public async Task Should_Parse_All_Required_Fields()
        {
            // Arrange
            var poolId = "3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv";

            // Act
            var result = await _service.GetPoolInfoAsync(poolId);

            // Assert
            Assert.NotNull(result);
            
            // Required fields
            Assert.NotEmpty(result.Id);
            Assert.NotEmpty(result.Type);
            Assert.NotEmpty(result.ProgramId);
            
            // Token mints
            Assert.NotNull(result.MintA);
            Assert.NotEmpty(result.MintA.Address);
            Assert.NotEmpty(result.MintA.Symbol);
            Assert.True(result.MintA.Decimals > 0);
            
            Assert.NotNull(result.MintB);
            Assert.NotEmpty(result.MintB.Address);
            Assert.NotEmpty(result.MintB.Symbol);
            Assert.True(result.MintB.Decimals > 0);
            
            // Numeric fields
            Assert.True(result.Price > 0, "Price should be positive");
            Assert.True(result.MintAmountA > 0, "MintAmountA should be positive");
            Assert.True(result.MintAmountB > 0, "MintAmountB should be positive");
            Assert.True(result.FeeRate > 0, "FeeRate should be positive");
            Assert.True(result.Tvl > 0, "TVL should be positive");
            
            _output.WriteLine("All required fields present and valid");
        }

        [Fact]
        [Trait("Category", "Integration")]
        public async Task Should_Have_Valid_Token_Decimals()
        {
            // Arrange
            var poolId = "3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv";

            // Act
            var result = await _service.GetPoolInfoAsync(poolId);

            // Assert
            Assert.NotNull(result);
            
            // SOL should have 9 decimals
            Assert.Equal(9, result.MintA.Decimals);
            
            // USDC should have 6 decimals
            Assert.Equal(6, result.MintB.Decimals);
            
            _output.WriteLine($"Token A decimals: {result.MintA.Decimals} ✓");
            _output.WriteLine($"Token B decimals: {result.MintB.Decimals} ✓");
        }
    }
}
