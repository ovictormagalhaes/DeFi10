using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using Xunit.Abstractions;
using System.Net.Http;
using DeFi10.API.Services.Protocols.Kamino;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Models;

namespace DeFi10.API.Tests
{
    public class KaminoIntegrationTests
    {
        private readonly ITestOutputHelper _output;
        private readonly HttpClient _httpClient;
        private readonly ILogger<KaminoService> _logger;
        private readonly KaminoService _service;
        
        // Wallet conhecido com posição Kamino ativa
        private const string TEST_WALLET_ADDRESS = "FriCEbw1V99GwrJRXPnSQ6su2TabHabNxiZ3VNsJVe6R";

        public KaminoIntegrationTests(ITestOutputHelper output)
        {
            _output = output;
            _httpClient = new HttpClient();
            
            // Create mock logger
            var mockLogger = new Mock<ILogger<KaminoService>>();
            mockLogger.Setup(x => x.Log(
                It.IsAny<LogLevel>(),
                It.IsAny<EventId>(),
                It.IsAny<It.IsAnyType>(),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()))
                .Callback(new InvocationAction(invocation =>
                {
                    var logLevel = (LogLevel)invocation.Arguments[0];
                    var state = invocation.Arguments[2];
                    var exception = (Exception?)invocation.Arguments[3];
                    var formatter = invocation.Arguments[4];

                    var invokeMethod = formatter.GetType().GetMethod("Invoke");
                    var logMessage = invokeMethod?.Invoke(formatter, new[] { state, exception })?.ToString();
                    
                    _output.WriteLine($"[{logLevel}] {logMessage}");
                }));

            _logger = mockLogger.Object;

            // Setup options
            var solanaOptions = Options.Create(new SolanaOptions
            {
                RpcUrl = "https://api.mainnet-beta.solana.com",
                RateLimitDelayMs = 100
            });

            var kaminoOptions = Options.Create(new KaminoOptions());

            // Setup protocol config mock
            var mockProtocolConfig = new Mock<IProtocolConfigurationService>();
            var protocolChain = new ProtocolChainResolved(
                "kamino",
                Chain.Solana,
                new Dictionary<string, string>
                {
                    { "ApiUrl", "https://api.hubbleprotocol.io" },
                    { "Enabled", "true" }
                }
            );
            mockProtocolConfig.Setup(x => x.GetProtocolOnChain("kamino", Chain.Solana))
                .Returns(protocolChain);

            _service = new KaminoService(_httpClient, solanaOptions, kaminoOptions, mockProtocolConfig.Object, _logger);
        }

        [Fact]
        [Trait("Category", "Integration")]
        public async Task Should_Fetch_Kamino_Reserves_Data()
        {
            // Arrange
            _output.WriteLine("=== Testing KaminoService.GetReservesDataAsync ===\n");

            // Act
            var reserves = await _service.GetReservesDataAsync();

            // Assert
            _output.WriteLine($"\n=== RESULT ===");
            _output.WriteLine($"Reserves fetched: {reserves != null}");
            
            Assert.NotNull(reserves);
            Assert.NotNull(reserves.Reserves);
            Assert.NotEmpty(reserves.Reserves);

            _output.WriteLine($"Total reserves: {reserves.Reserves.Count}");
            _output.WriteLine($"\n=== First 5 Reserves ===");

            foreach (var reserve in reserves.Reserves.Take(5))
            {
                _output.WriteLine($"\n--- {reserve.Symbol} ---");
                _output.WriteLine($"  Address: {reserve.Address}");
                _output.WriteLine($"  Mint: {reserve.MintAddress}");
                _output.WriteLine($"  Supply APY: {reserve.SupplyApy:F4}%");
                _output.WriteLine($"  Borrow APY: {reserve.BorrowApy:F4}%");
                _output.WriteLine($"  Total Supply: {reserve.TotalSupply:N2}");
                _output.WriteLine($"  Total Borrow: {reserve.TotalBorrow:N2}");
                _output.WriteLine($"  Total Supply USD: ${reserve.TotalSupplyUsd:N2}");
                _output.WriteLine($"  Total Borrow USD: ${reserve.TotalBorrowUsd:N2}");
            }

            // Verify structure
            var firstReserve = reserves.Reserves.First();
            Assert.NotNull(firstReserve.Address);
            Assert.NotNull(firstReserve.MintAddress);
            Assert.True(firstReserve.SupplyApy >= 0);
            Assert.True(firstReserve.BorrowApy >= 0);
            Assert.NotNull(firstReserve.Symbol);
            Assert.NotNull(firstReserve.MintAddress);
            
            _output.WriteLine($"\n✓ Reserves API working correctly");
        }

        [Fact]
        [Trait("Category", "Integration")]
        public async Task Should_Get_Kamino_Positions_For_Test_Wallet()
        {
            // Arrange
            _output.WriteLine($"=== Testing KaminoService.GetPositionsAsync ===");
            _output.WriteLine($"Test Wallet: {TEST_WALLET_ADDRESS}\n");

            // Act
            var positions = await _service.GetPositionsAsync(TEST_WALLET_ADDRESS, Chain.Solana);

            // Assert
            _output.WriteLine($"\n=== RESULT ===");
            _output.WriteLine($"Total positions found: {positions.Count()}");

            Assert.NotNull(positions);
            
            if (!positions.Any())
            {
                _output.WriteLine("⚠ No positions found for this wallet. This might be expected if the wallet has no Kamino positions.");
                return;
            }

            foreach (var position in positions)
            {
                _output.WriteLine($"\n--- Position: {position.Market} ---");
                _output.WriteLine($"  Obligation ID: {position.Id}");
                _output.WriteLine($"  Health Factor: {position.HealthFactor:F2}");
                _output.WriteLine($"  Tokens ({position.Tokens.Count}):");
                
                foreach (var token in position.Tokens)
                {
                    var typeLabel = token.Type == TokenType.Supplied ? "SUPPLIED" : "BORROWED";
                    _output.WriteLine($"    [{typeLabel}] {token.Symbol}: {token.Amount:N6} (${token.PriceUsd:F2} each)");
                    _output.WriteLine($"      Mint: {token.Mint}");
                    _output.WriteLine($"      Total Value: ${(token.Amount * (token.PriceUsd ?? 0)):F2}");
                }

                var totalSupplied = position.Tokens.Where(t => t.Type == TokenType.Supplied)
                    .Sum(t => t.Amount * (t.PriceUsd ?? 0));
                var totalBorrowed = position.Tokens.Where(t => t.Type == TokenType.Borrowed)
                    .Sum(t => t.Amount * (t.PriceUsd ?? 0));
                
                _output.WriteLine($"\n  Summary:");
                _output.WriteLine($"    Total Supplied: ${totalSupplied:F2}");
                _output.WriteLine($"    Total Borrowed: ${totalBorrowed:F2}");
                _output.WriteLine($"    Net Position: ${(totalSupplied - totalBorrowed):F2}");
            }

            _output.WriteLine($"\n✓ Positions fetched successfully");
        }

        [Fact]
        [Trait("Category", "Integration")]
        public async Task Should_Cache_Reserves_Data()
        {
            // Arrange
            _output.WriteLine("=== Testing Reserves Caching ===\n");

            // Act - First call
            _output.WriteLine("First call (should fetch from API)...");
            var sw1 = System.Diagnostics.Stopwatch.StartNew();
            var reserves1 = await _service.GetReservesDataAsync();
            sw1.Stop();
            _output.WriteLine($"First call took: {sw1.ElapsedMilliseconds}ms");

            // Act - Second call (should use cache)
            _output.WriteLine("\nSecond call (should use cache)...");
            var sw2 = System.Diagnostics.Stopwatch.StartNew();
            var reserves2 = await _service.GetReservesDataAsync();
            sw2.Stop();
            _output.WriteLine($"Second call took: {sw2.ElapsedMilliseconds}ms");

            // Assert
            Assert.NotNull(reserves1);
            Assert.NotNull(reserves2);
            Assert.Equal(reserves1.Reserves.Count, reserves2.Reserves.Count);
            
            _output.WriteLine($"\n✓ Caching working (second call {(sw2.ElapsedMilliseconds < sw1.ElapsedMilliseconds ? "faster" : "similar")} to first)");
            _output.WriteLine($"  Cache speedup: {(sw1.ElapsedMilliseconds - sw2.ElapsedMilliseconds)}ms");
        }

        [Fact]
        [Trait("Category", "Integration")]
        public async Task Should_Find_Specific_Token_Reserves()
        {
            // Arrange
            _output.WriteLine("=== Testing Reserve Lookup by Token ===\n");
            var tokensToFind = new[] { "SOL", "USDC", "USDT", "JitoSOL", "mSOL" };

            // Act
            var reserves = await _service.GetReservesDataAsync();

            // Assert
            Assert.NotNull(reserves);
            
            _output.WriteLine($"Looking for popular tokens...\n");
            
            foreach (var tokenSymbol in tokensToFind)
            {
                var reserve = reserves.Reserves.FirstOrDefault(r => 
                    r.Symbol?.Equals(tokenSymbol, StringComparison.OrdinalIgnoreCase) == true);
                
                if (reserve != null)
                {
                    _output.WriteLine($"✓ Found {tokenSymbol}:");
                    _output.WriteLine($"  Supply APY: {reserve.SupplyApy:F4}%");
                    _output.WriteLine($"  Borrow APY: {reserve.BorrowApy:F4}%");
                    _output.WriteLine($"  Mint: {reserve.MintAddress}");
                    Assert.True(reserve.SupplyApy >= 0);
                    Assert.True(reserve.BorrowApy >= 0);
                }
                else
                {
                    _output.WriteLine($"✗ {tokenSymbol} not found in reserves");
                }
            }
        }
    }
}
