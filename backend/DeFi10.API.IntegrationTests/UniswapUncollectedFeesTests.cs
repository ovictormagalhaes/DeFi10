using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using Xunit.Abstractions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using DeFi10.API.Services.Protocols.Uniswap;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Configuration;
using DeFi10.API.Models;

namespace DeFi10.API.IntegrationTests
{
    public class UniswapUncollectedFeesTests
    {
        private readonly ITestOutputHelper _output;
        private readonly IConfiguration _configuration;
        private const string TEST_WALLET = "0xF6998ed7484b4aDB3B5aD636D24CB1c576C12b27";

        public UniswapUncollectedFeesTests(ITestOutputHelper output)
        {
            _output = output;
            _configuration = new ConfigurationBuilder()
                .SetBasePath(System.IO.Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
                .Build();
        }

        [Fact]
        public async Task Wallet_Should_Have_3_ActivePools_With_UncollectedFees()
        {
            // Arrange
            _output.WriteLine($"Testing wallet: {TEST_WALLET}");
            _output.WriteLine($"Chain: Base");
            _output.WriteLine("");

            // Load environment variables from .env file
            var envFilePath = System.IO.Path.Combine(
                System.IO.Directory.GetCurrentDirectory(),
                "..", "..", "..", "..", ".env");

            string? alchemyKey = null;

            if (System.IO.File.Exists(envFilePath))
            {
                _output.WriteLine($"Loading .env from: {envFilePath}");
                var envLines = System.IO.File.ReadAllLines(envFilePath);
                _output.WriteLine($"Found {envLines.Length} lines in .env");
                
                foreach (var line in envLines)
                {
                    if (string.IsNullOrWhiteSpace(line) || line.TrimStart().StartsWith("#"))
                        continue;

                    var parts = line.Split('=', 2);
                    if (parts.Length == 2)
                    {
                        var key = parts[0].Trim();
                        
                        // Support both ALCHEMY_API_KEY and Alchemy__ApiKey formats
                        if (key == "ALCHEMY_API_KEY" || key == "Alchemy__ApiKey")
                        {
                            alchemyKey = parts[1].Trim().Trim('"', '\'');
                            _output.WriteLine($"Found {key} in .env (length: {alchemyKey.Length})");
                            break;
                        }
                    }
                }
            }
            else
            {
                _output.WriteLine($".env file not found at: {envFilePath}");
            }

            // Fallback to configuration
            if (string.IsNullOrEmpty(alchemyKey))
            {
                alchemyKey = _configuration["Alchemy:ApiKey"];
            }

            Assert.False(string.IsNullOrEmpty(alchemyKey) || alchemyKey.Contains("$"), 
                "Alchemy API key must be configured. Set ALCHEMY_API_KEY in .env file or Alchemy:ApiKey in appsettings.json");

            var chainCfg = _configuration.GetSection("ChainConfiguration").Get<ChainConfiguration>() ?? new ChainConfiguration();
            
            // Ensure Base RPC is configured
            if (!chainCfg.Chains.ContainsKey("Base"))
                chainCfg.Chains["Base"] = new ChainConfig();
            if (chainCfg.Chains["Base"].Rpc == null)
                chainCfg.Chains["Base"].Rpc = new RpcConfiguration();

            chainCfg.Chains["Base"].Rpc.Primary = Chain.Base.GetAlchemyRpcUrl(alchemyKey);
            
            _output.WriteLine($"Using RPC: {chainCfg.Chains["Base"].Rpc.Primary?.Substring(0, 50)}...");

            var chainCfgLogger = new TestLogger<ChainConfigurationService>(_output);
            var chainConfigService = new ChainConfigurationService(Options.Create(chainCfg), chainCfgLogger);

            var onChainLogger = new TestLogger<UniswapV3OnChainService>(_output);
            var onChainService = new UniswapV3OnChainService(_configuration, chainConfigService, onChainLogger);

            // Act
            _output.WriteLine("Fetching positions from on-chain...");
            var response = await onChainService.GetActivePoolsOnChainAsync(TEST_WALLET, onlyOpenPositions: false, Chain.Base);

            // Assert
            Assert.NotNull(response);
            Assert.NotNull(response.Data);
            Assert.NotNull(response.Data.Positions);

            var positions = response.Data.Positions;
            _output.WriteLine($"\nFound {positions.Count} active positions\n");

            // Should have exactly 3 active pools
            Assert.Equal(3, positions.Count);

            // Validate each position
            int positionIndex = 0;
            foreach (var position in positions)
            {
                positionIndex++;
                _output.WriteLine($"=== Position {positionIndex} (Token ID: {position.Id}) ===");
                _output.WriteLine($"Pool: {position.Token0?.Symbol}/{position.Token1?.Symbol}");
                _output.WriteLine($"Fee Tier: {position.Pool?.FeeTier}");
                
                // Parse uncollected fees
                var uncollected0 = decimal.TryParse(position.EstimatedUncollectedToken0, 
                    System.Globalization.NumberStyles.Float, 
                    System.Globalization.CultureInfo.InvariantCulture, 
                    out var u0) ? u0 : 0m;
                
                var uncollected1 = decimal.TryParse(position.EstimatedUncollectedToken1, 
                    System.Globalization.NumberStyles.Float, 
                    System.Globalization.CultureInfo.InvariantCulture, 
                    out var u1) ? u1 : 0m;

                _output.WriteLine($"Uncollected {position.Token0?.Symbol}: {uncollected0:N8}");
                _output.WriteLine($"Uncollected {position.Token1?.Symbol}: {uncollected1:N8}");

                // Calculate USD value if prices are available
                var price0 = decimal.TryParse(position.Token0?.DerivedNative,
                    System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture,
                    out var p0) ? p0 : 0m;

                var price1 = decimal.TryParse(position.Token1?.DerivedNative,
                    System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture,
                    out var p1) ? p1 : 0m;

                if (price0 > 0 || price1 > 0)
                {
                    // Get native price in USD from bundle
                    var nativeUsd = 0m;
                    if (response.Data.Bundles?.Any() == true)
                    {
                        decimal.TryParse(response.Data.Bundles[0].NativePriceUSD,
                            System.Globalization.NumberStyles.Float,
                            System.Globalization.CultureInfo.InvariantCulture,
                            out nativeUsd);
                    }

                    var totalUsd = (uncollected0 * price0 * nativeUsd) + (uncollected1 * price1 * nativeUsd);
                    _output.WriteLine($"Total Uncollected USD: ${totalUsd:N2}");
                }

                _output.WriteLine("");

                // Each position must have uncollected fees > 0 (at least one token)
                Assert.True(uncollected0 > 0 || uncollected1 > 0, 
                    $"Position {position.Id} should have uncollected fees > 0, but got Token0={uncollected0}, Token1={uncollected1}");
            }

            // Summary
            var totalPositionsWithFees = positions.Count(p =>
            {
                var u0 = decimal.TryParse(p.EstimatedUncollectedToken0, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var val0) ? val0 : 0m;
                var u1 = decimal.TryParse(p.EstimatedUncollectedToken1, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var val1) ? val1 : 0m;
                return u0 > 0 || u1 > 0;
            });

            _output.WriteLine($"=== Test Summary ===");
            _output.WriteLine($"Total Positions: {positions.Count}");
            _output.WriteLine($"Positions with Fees: {totalPositionsWithFees}");
            _output.WriteLine($"Test Status: ✅ PASSED");

            Assert.Equal(3, totalPositionsWithFees);
        }

        private class TestLogger<T> : ILogger<T>
        {
            private readonly ITestOutputHelper _output;
            
            public TestLogger(ITestOutputHelper output) => _output = output;
            
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
}
