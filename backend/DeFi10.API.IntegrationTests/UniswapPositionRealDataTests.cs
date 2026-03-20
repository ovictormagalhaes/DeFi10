using DeFi10.API.Configuration;
using DeFi10.API.Models;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Protocols.Uniswap;
using DeFi10.API.Services.Protocols.Uniswap.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;
using Xunit.Abstractions;

namespace DeFi10.API.IntegrationTests;

public class UniswapPositionRealDataTests
{
    private readonly ITestOutputHelper _output;
    private readonly IConfiguration _configuration;
    private readonly string _testWalletAddress;

    public UniswapPositionRealDataTests(ITestOutputHelper output)
    {
        _output = output;
        
        _configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
            .Build();

        _testWalletAddress = "0xF6998ed7484b4aDB3B5aD636D24CB1c576C12b27";
    }

    [Fact]
    public async Task Position_With_Real_Blockchain_Data_Should_Calculate_Fees_Correctly()
    {
        // Arrange - Load API key from .env
        var envPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "..", ".env");
        _output.WriteLine($"Loading .env from: {envPath}");
        
        string? alchemyApiKey = null;
        if (File.Exists(envPath))
        {
            var lines = File.ReadAllLines(envPath);
            _output.WriteLine($"Found {lines.Length} lines in .env");
            
            foreach (var line in lines)
            {
                if (line.StartsWith("ALCHEMY_API_KEY=") || line.StartsWith("Alchemy__ApiKey="))
                {
                    alchemyApiKey = line.Split('=', 2)[1].Trim().Trim('"');
                    _output.WriteLine($"Found Alchemy API Key (length: {alchemyApiKey.Length})");
                    break;
                }
            }
        }
        else
        {
            _output.WriteLine($".env file not found at: {envPath}");
        }

        Assert.NotNull(alchemyApiKey);
        Assert.NotEmpty(alchemyApiKey);

        // Build chain configuration
        var chainCfg = _configuration.GetSection("ChainConfiguration").Get<ChainConfiguration>() ?? new ChainConfiguration();
        if (!chainCfg.Chains.ContainsKey("Base")) chainCfg.Chains["Base"] = new ChainConfig();
        if (chainCfg.Chains["Base"].Rpc == null) chainCfg.Chains["Base"].Rpc = new RpcConfiguration();
        
        var baseRpc = Chain.Base.GetAlchemyRpcUrl(alchemyApiKey);
        chainCfg.Chains["Base"].Rpc.Primary = baseRpc;
        _output.WriteLine($"Using RPC: {baseRpc.Substring(0, 50)}...");

        var chainCfgLogger = new TestLogger<ChainConfigurationService>(_output);
        var chainConfigService = new ChainConfigurationService(Options.Create(chainCfg), chainCfgLogger);
        
        var onChainLogger = new TestLogger<UniswapV3OnChainService>(_output);
        
        // Create service using test configuration
        var testConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Alchemy:ApiKey"] = alchemyApiKey
            })
            .Build();
        
        var service = new UniswapV3OnChainService(testConfig, chainConfigService, onChainLogger);
        
        _output.WriteLine($"Fetching positions for wallet: {_testWalletAddress}");

        // Get active pools
        var response = await service.GetActivePoolsOnChainAsync(_testWalletAddress, false, Chain.Base);
        
        _output.WriteLine($"Found {response.Data.Positions.Count} positions");
        Assert.NotEmpty(response.Data.Positions);

        // Test each position
        foreach (var position in response.Data.Positions)
        {
            _output.WriteLine($"\n========== Testing Position {position.Id} ==========");
            _output.WriteLine($"Position Details:");
            _output.WriteLine($"  Pool: {position.Pool.Id}");
            _output.WriteLine($"  Token0: {position.Token0.Symbol}");
            _output.WriteLine($"  Token1: {position.Token1.Symbol}");
            _output.WriteLine($"  Fee Tier: {position.Pool.FeeTier}");
            _output.WriteLine($"  TickLower: {position.TickLower}");
            _output.WriteLine($"  TickUpper: {position.TickUpper}");
            _output.WriteLine($"  Liquidity: {position.Liquidity}");
            _output.WriteLine($"  RawTokensOwed0: {position.RawTokensOwed0}");
            _output.WriteLine($"  RawTokensOwed1: {position.RawTokensOwed1}");
            _output.WriteLine($"  EstimatedUncollectedToken0: {position.EstimatedUncollectedToken0}");
            _output.WriteLine($"  EstimatedUncollectedToken1: {position.EstimatedUncollectedToken1}");
            _output.WriteLine($"  FeeGrowthInside0LastX128: {position.FeeGrowthInside0LastX128}");
            _output.WriteLine($"  FeeGrowthInside1LastX128: {position.FeeGrowthInside1LastX128}");
            _output.WriteLine($"  Pool.FeeGrowthGlobal0X128: {position.Pool.FeeGrowthGlobal0X128}");
            _output.WriteLine($"  Pool.FeeGrowthGlobal1X128: {position.Pool.FeeGrowthGlobal1X128}");

            // Parse the values
            var tokensOwed0 = decimal.TryParse(position.RawTokensOwed0, out var to0) ? to0 : 0;
            var tokensOwed1 = decimal.TryParse(position.RawTokensOwed1, out var to1) ? to1 : 0;
            var uncollected0 = decimal.TryParse(position.EstimatedUncollectedToken0, out var uc0) ? uc0 : 0;
            var uncollected1 = decimal.TryParse(position.EstimatedUncollectedToken1, out var uc1) ? uc1 : 0;

            // Verify fees are not zero when TokensOwed is non-zero
            if (tokensOwed0 > 0 || tokensOwed1 > 0)
            {
                _output.WriteLine($"\n  ⚠️ Position has TokensOwed > 0, so uncollected fees should not be zero!");
                _output.WriteLine($"  TokensOwed0: {tokensOwed0}");
                _output.WriteLine($"  TokensOwed1: {tokensOwed1}");
                _output.WriteLine($"  Expected: EstimatedUncollectedToken0 > 0 OR EstimatedUncollectedToken1 > 0");
                _output.WriteLine($"  Actual: EstimatedUncollectedToken0={uncollected0}, EstimatedUncollectedToken1={uncollected1}");
                
                // At least one should be non-zero if TokensOwed is non-zero
                if (uncollected0 == 0 && uncollected1 == 0)
                {
                    Assert.Fail($"Position {position.Id} has TokensOwed0={tokensOwed0} TokensOwed1={tokensOwed1} but calculated fees are ZERO! EstimatedUncollectedToken0={uncollected0} EstimatedUncollectedToken1={uncollected1}");
                }
            }
        }
    }

    private class TestLogger<T> : ILogger<T>
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
