using Microsoft.Extensions.Logging;
using Moq;
using DeFi10.API.Services.Infrastructure.MoralisSolana;
using Solnet.Rpc;
using Xunit;
using Xunit.Abstractions;
using System.Net.Http;
using DeFi10.API.Services.Protocols.Raydium;
using Microsoft.Extensions.Configuration;
using DeFi10.API.Services.Infrastructure;
using DeFi10.API.Configuration;
using Microsoft.Extensions.Options;
using DeFi10.API.Models;

namespace DeFi10.API.IntegrationTests
{
    public class RaydiumOnChainServiceTests
    {
        private readonly ITestOutputHelper _output;
        private readonly IRpcClientFactory _rpcFactory;
        private readonly ILogger<RaydiumOnChainService> _logger;
        private readonly HttpClient _httpClient;
        private readonly RaydiumOnChainService _service;
        private readonly string _testWalletAddress;

        public RaydiumOnChainServiceTests(ITestOutputHelper output)
        {
            _output = output;
            
            // Create RpcClientFactory for tests
            var solanaOptions = Options.Create(new SolanaOptions { RpcUrl = "https://api.mainnet-beta.solana.com" });
            var alchemyOptions = Options.Create(new AlchemyOptions());
            var chainConfig = Options.Create(new ChainConfiguration());
            var factoryLogger = new Mock<ILogger<RpcClientFactory>>().Object;
            _rpcFactory = new RpcClientFactory(solanaOptions, alchemyOptions, chainConfig, factoryLogger);
            
            _httpClient = new HttpClient();

            // Load configuration from appsettings for integration tests
            var config = new ConfigurationBuilder()
                .AddJsonFile("appsettings.json", optional: true)
                .AddEnvironmentVariables()
                .Build();

            _testWalletAddress = config["IntegrationTests:Raydium:TestWalletAddress"]
                                 ?? throw new InvalidOperationException("IntegrationTests:Raydium:TestWalletAddress is not configured in appsettings.json or environment variables.");
            
            // Create mock logger
            var mockLogger = new Mock<ILogger<RaydiumOnChainService>>();
            mockLogger.Setup(x => x.Log(
                It.IsAny<LogLevel>(),
                It.IsAny<EventId>(),
                It.IsAny<It.IsAnyType>(),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()))
                .Callback(new InvocationAction(invocation =>
                {
                    var logLevel = (LogLevel)invocation.Arguments[0];
                    var eventId = (EventId)invocation.Arguments[1];
                    var state = invocation.Arguments[2];
                    var exception = (Exception?)invocation.Arguments[3];
                    var formatter = invocation.Arguments[4];

                    var invokeMethod = formatter.GetType().GetMethod("Invoke");
                    var logMessage = invokeMethod?.Invoke(formatter, new[] { state, exception })?.ToString();
                    
                    _output.WriteLine($"[{logLevel}] {logMessage}");
                }));

            _logger = mockLogger.Object;
            var apiLogger = new Mock<ILogger<RaydiumApiService>>();
            var apiHttpClient = new HttpClient { BaseAddress = new Uri("https://api-v3.raydium.io") };
            var apiService = new RaydiumApiService(apiHttpClient, apiLogger.Object);
            _service = new RaydiumOnChainService(_rpcFactory, _logger, _httpClient, apiService);
        }

        [Fact]
        public async Task Should_Handle_Invalid_Wallet_Address()
        {
            // Arrange
            const string INVALID_WALLET = "invalid_address";

            // Act
            var positions = await _service.GetPositionsAsync(INVALID_WALLET);

            // Assert
            Assert.NotNull(positions);
            Assert.Empty(positions);
            _output.WriteLine("✓ Service correctly handled invalid wallet address");
        }

        [Fact]

        public async Task Should_Handle_Wallet_Without_Positions()
        {
            // Arrange
            // Use a valid wallet address that likely has no Raydium positions
            const string EMPTY_WALLET = "11111111111111111111111111111111";

            // Act
            var positions = await _service.GetPositionsAsync(EMPTY_WALLET);

            // Assert
            Assert.NotNull(positions);
            // May be empty or not depending on the wallet, but should not throw
            _output.WriteLine($"✓ Service handled wallet without positions: {positions.Count} positions found");
        }

    }
}
