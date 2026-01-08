using System.Linq;
using Xunit;
using Xunit.Abstractions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net.Http;
using DeFi10.API.Services.Protocols.Uniswap;
using DeFi10.API.Services.Protocols.Uniswap.Models;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Configuration;
using Microsoft.Extensions.Options;
using DeFi10.API.Models;

namespace DeFi10.API.Tests
{
    public class UniswapIntegrationTests
    {
        private readonly ITestOutputHelper _output;
        private readonly IConfiguration _configuration;
        private readonly string _testWalletAddress;

        public UniswapIntegrationTests(ITestOutputHelper output)
        {
            _output = output;
            _configuration = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
                .Build();

            _testWalletAddress = _configuration["IntegrationTests:Uniswap:TestWalletAddress"]
                ?? throw new InvalidOperationException("Uniswap TestWalletAddress not found in appsettings.json");

            _output.WriteLine($"Uniswap integration test wallet: {_testWalletAddress}");
        }

        [Fact]
        public async Task Should_Return_Collected_And_Uncollected_Fees_From_UniswapGraphQL()
        {
            var logger = new TestLogger<UniswapV3Service>(_output);
            var httpClient = new HttpClient();

            // Build chain configuration service from appsettings
            var chainCfg = _configuration.GetSection("ChainConfiguration").Get<ChainConfiguration>() ?? new ChainConfiguration();
            // Ensure Base RPC is populated for on-chain tests
            if (!chainCfg.Chains.ContainsKey("Base")) chainCfg.Chains["Base"] = new ChainConfig();
            if (chainCfg.Chains["Base"].Rpc == null) chainCfg.Chains["Base"].Rpc = new RpcConfiguration();
            var baseRpc = chainCfg.Chains["Base"].Rpc.Primary;
            if (string.IsNullOrEmpty(baseRpc))
            {
                var alchemyKey = _configuration["Alchemy:ApiKey"];
                if (!string.IsNullOrEmpty(alchemyKey))
                {
                    baseRpc = DeFi10.API.Models.Chain.Base.GetAlchemyRpcUrl(alchemyKey);
                    chainCfg.Chains["Base"].Rpc.Primary = baseRpc;
                }
                else if (!string.IsNullOrEmpty(_configuration["Alchemy:BaseRpcUrl"]))
                {
                    baseRpc = _configuration["Alchemy:BaseRpcUrl"];
                    chainCfg.Chains["Base"].Rpc.Primary = baseRpc;
                }
                else if (!string.IsNullOrEmpty(_configuration["UniswapV3:Base:Rpc"]))
                {
                    baseRpc = _configuration["UniswapV3:Base:Rpc"];
                    chainCfg.Chains["Base"].Rpc.Primary = baseRpc;
                }
            }

            var chainCfgLogger = new TestLogger<ChainConfigurationService>(_output);
            var chainConfigService = new ChainConfigurationService(Options.Create(chainCfg), chainCfgLogger);

            var onChainLogger = new TestLogger<UniswapV3OnChainService>(_output);
            var onChainService = new UniswapV3OnChainService(_configuration, chainConfigService, onChainLogger);

            var service = new UniswapV3Service(httpClient, _configuration, logger, onChainService);

            _output.WriteLine("\n=== FASE 1: Testing HYBRID mode (GraphQL + On-chain) ===\n");

            UniswapV3GetActivePoolsResponse? response = null;
            int attempts = 0;
            while (attempts < 3)
            {
                attempts++;
                try
                {
                    response = await service.GetActivePoolsHybridAsync(_testWalletAddress, DeFi10.API.Models.Chain.Base);
                    break;
                }
                catch (HttpRequestException hre) when (hre.StatusCode == System.Net.HttpStatusCode.TooManyRequests || hre.Message.Contains("429"))
                {
                    _output.WriteLine($"GraphQL 429 received, attempt {attempts} - retrying after delay");
                    await System.Threading.Tasks.Task.Delay(1000 * attempts);
                    continue;
                }
                catch (Exception ex)
                {
                    _output.WriteLine($"GraphQL request failed: {ex.Message}");
                    throw;
                }
            }

            if (response == null)
            {
                _output.WriteLine("GraphQL request failed after retries.");
                Assert.True(false, "GraphQL request failed after retries");
            }

            Assert.NotNull(response);
                if (response.Data == null)
                {
                    // Fetch and log raw GraphQL response for debugging
                    try
                    {
                        var endpoint = _configuration["ProtocolConfiguration:UniswapV3:GraphQLEndpoint"]
                            ?? _configuration["UniswapV3:GraphQLEndpoint"]
                            ?? _configuration["Uniswap:GraphQLEndpoint"];

                        var query = @"{
                    bundles(first: 1) {
                        nativePriceUSD
                    }
                    positions(
                        where: { owner: $owner, liquidity_gt: 0 }
                    ) {
                        id
                        liquidity
                        depositedToken0
                        depositedToken1
                        withdrawnToken0
                        withdrawnToken1
                        collectedFeesToken0
                        collectedFeesToken1
                        liquidity
                        feeGrowthInside0LastX128
                        feeGrowthInside1LastX128
                        tickLower
                        tickUpper
                        transaction { timestamp }
                        token0 { id symbol name decimals feesUSD tokenAddress derivedNative }
                        token1 { id symbol name decimals feesUSD tokenAddress derivedNative }
                        pool { id feeTier liquidity feeGrowthGlobal0X128 feeGrowthGlobal1X128 tick tickSpacing sqrtPriceX96 createdAtUnix }
                    }
                }".Replace("$owner", $"\"{_testWalletAddress}\"");

                        var payload = System.Text.Json.JsonSerializer.Serialize(new { query = query }, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
                        var content = new System.Net.Http.StringContent(payload, System.Text.Encoding.UTF8, "application/json");
                        var rawResp = await httpClient.PostAsync(endpoint, content);
                        var rawText = await rawResp.Content.ReadAsStringAsync();
                        var preview = rawText?.Length > 2000 ? rawText.Substring(0, 2000) + "..." : rawText;
                        _output.WriteLine("RAW GraphQL response preview:\n" + preview);
                    }
                    catch (Exception ex)
                    {
                        _output.WriteLine("Failed to fetch raw GraphQL response: " + ex.Message);
                    }

                    Assert.NotNull(response.Data);
                }

            var positions = response.Data.Positions ?? new System.Collections.Generic.List<UniswapV3Position>();
            _output.WriteLine($"Found {positions.Count} positions from GraphQL");

            if (!positions.Any())
            {
                _output.WriteLine("No positions returned by GraphQL for this wallet.");
            }

            bool anyCollectedOrUncollected = false;
            foreach (var p in positions)
            {
                decimal collected0 = decimal.TryParse(p.CollectedFeesToken0, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var c0) ? c0 : 0m;
                decimal collected1 = decimal.TryParse(p.CollectedFeesToken1, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var c1) ? c1 : 0m;
                decimal uncol0 = decimal.TryParse(p.EstimatedUncollectedToken0, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var u0) ? u0 : 0m;
                decimal uncol1 = decimal.TryParse(p.EstimatedUncollectedToken1, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var u1) ? u1 : 0m;

                _output.WriteLine($"Pos {p.Id} -> collected0={collected0} collected1={collected1} uncol0={uncol0} uncol1={uncol1} feeTier={p.Pool?.FeeTier ?? "N/A"}");
                
                // Verify that FeeTier is populated
                Assert.NotNull(p.Pool);
                Assert.NotNull(p.Pool.FeeTier);
                Assert.NotEmpty(p.Pool.FeeTier);

                if (collected0 > 0 || collected1 > 0 || uncol0 > 0 || uncol1 > 0) anyCollectedOrUncollected = true;
            }

            Assert.True(anyCollectedOrUncollected, "Expected at least one position to show collected or uncollected fees > 0.");

            // Additionally, fetch on-chain computed values to verify uncollected fees
            var baseCfg = chainConfigService.GetChainConfig(DeFi10.API.Models.Chain.Base);
            var baseRpcConfigured = baseCfg?.Rpc?.Primary;
            if (string.IsNullOrEmpty(baseRpcConfigured))
            {
                _output.WriteLine("On-chain RPC for Base is not configured. Set 'Alchemy:ApiKey' or 'Alchemy:BaseRpcUrl' in test appsettings to enable on-chain uncollected checks.");
                throw new InvalidOperationException("On-chain RPC for Base not configured in test environment");
            }

            var onChainResponse = await onChainService.GetActivePoolsOnChainAsync(_testWalletAddress, false, DeFi10.API.Models.Chain.Base);
            var onChainPositions = onChainResponse?.Data?.Positions ?? new System.Collections.Generic.List<UniswapV3Position>();
            _output.WriteLine($"\n=== FASE 2: Pure On-Chain mode ===");
            _output.WriteLine($"Found {onChainPositions.Count} positions from On-Chain fetch\n");

            bool anyOnChainUncollected = false;
            foreach (var p in onChainPositions)
            {
                decimal rawOwed0 = decimal.TryParse(p.RawTokensOwed0, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var ro0) ? ro0 : 0m;
                decimal rawOwed1 = decimal.TryParse(p.RawTokensOwed1, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var ro1) ? ro1 : 0m;
                decimal estUncol0 = decimal.TryParse(p.EstimatedUncollectedToken0, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var eu0) ? eu0 : 0m;
                decimal estUncol1 = decimal.TryParse(p.EstimatedUncollectedToken1, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var eu1) ? eu1 : 0m;

                _output.WriteLine($"OnChain Pos {p.Id} -> rawOwed0={rawOwed0} rawOwed1={rawOwed1} estUncol0={estUncol0} estUncol1={estUncol1}");

                if (rawOwed0 > 0 || rawOwed1 > 0 || estUncol0 > 0 || estUncol1 > 0) anyOnChainUncollected = true;
            }

            _output.WriteLine($"\n=== COMPARISON: Hybrid vs Pure On-Chain ===\n");
            
            // Compare positions from hybrid vs on-chain
            foreach (var hybridPos in positions)
            {
                var onChainPos = onChainPositions.FirstOrDefault(p => p.Id == hybridPos.Id);
                if (onChainPos != null)
                {
                    decimal hybridUncol0 = decimal.TryParse(hybridPos.EstimatedUncollectedToken0, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var h0) ? h0 : 0m;
                    decimal hybridUncol1 = decimal.TryParse(hybridPos.EstimatedUncollectedToken1, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var h1) ? h1 : 0m;
                    decimal onChainUncol0 = decimal.TryParse(onChainPos.EstimatedUncollectedToken0, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var o0) ? o0 : 0m;
                    decimal onChainUncol1 = decimal.TryParse(onChainPos.EstimatedUncollectedToken1, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var o1) ? o1 : 0m;
                    
                    _output.WriteLine($"Position {hybridPos.Id}:");
                    _output.WriteLine($"  Hybrid    Token0: {hybridUncol0,20:N8}  Token1: {hybridUncol1,20:N8}");
                    _output.WriteLine($"  On-Chain  Token0: {onChainUncol0,20:N8}  Token1: {onChainUncol1,20:N8}");
                    
                    if (Math.Abs(hybridUncol0 - onChainUncol0) > 0.00000001m || Math.Abs(hybridUncol1 - onChainUncol1) > 0.00000001m)
                    {
                        _output.WriteLine($"  ⚠️ MISMATCH DETECTED!");
                        _output.WriteLine($"     Difference Token0: {Math.Abs(hybridUncol0 - onChainUncol0):N8}");
                        _output.WriteLine($"     Difference Token1: {Math.Abs(hybridUncol1 - onChainUncol1):N8}");
                    }
                    _output.WriteLine("");
                }
            }

            Assert.True(anyOnChainUncollected, "Expected at least one on-chain position to have uncollected (raw tokens owed or estimated uncollected) > 0.");
        }

        // Simple TestLogger used by other integration tests
        private class TestLogger<T> : Microsoft.Extensions.Logging.ILogger<T>
        {
            private readonly ITestOutputHelper _output;
            public TestLogger(ITestOutputHelper output) => _output = output;
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(Microsoft.Extensions.Logging.LogLevel logLevel) => true;
            public void Log<TState>(Microsoft.Extensions.Logging.LogLevel logLevel, Microsoft.Extensions.Logging.EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            {
                var message = formatter(state, exception);
                _output.WriteLine($"[{logLevel}] {message}");
                if (exception != null) _output.WriteLine($"Exception: {exception}");
            }
        }
    }
}
