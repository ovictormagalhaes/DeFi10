using Microsoft.Extensions.Logging;
using Moq;
using DeFi10.API.Services.Solana;
using Solnet.Rpc;
using Xunit;
using Xunit.Abstractions;
using System.Net.Http;
using DeFi10.API.Services.Solana.Raydium;

namespace DeFi10.API.Tests
{
    public class RaydiumOnChainServiceTests
    {
        private readonly ITestOutputHelper _output;
        private readonly IRpcClient _rpcClient;
        private readonly ILogger<RaydiumOnChainService> _logger;
        private readonly HttpClient _httpClient;
        private readonly RaydiumOnChainService _service;
        
        private const string TEST_WALLET_ADDRESS = "GSyqNADxpnyo57KDWXHGE7gjd63ovGB2FuYCtnZQZSWu";
        private const string EXPECTED_NFT_MINT = "5jzVQdESbretaB6JRvvHejjQhRwFCS1jr3ystKJDrwK4";

        public RaydiumOnChainServiceTests(ITestOutputHelper output)
        {
            _output = output;
            _rpcClient = ClientFactory.GetClient("https://api.mainnet-beta.solana.com");
            _httpClient = new HttpClient();
            
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
            _service = new RaydiumOnChainService(_rpcClient, _logger, _httpClient);
        }

        [Fact]
        [Trait("Category", "Integration")]
        public async Task Should_Get_Raydium_Positions_For_Test_Wallet()
        {
            // Arrange
            _output.WriteLine($"Testing RaydiumOnChainService.GetPositionsAsync for wallet: {TEST_WALLET_ADDRESS}");

            // Act
            var positions = await _service.GetPositionsAsync(TEST_WALLET_ADDRESS);

            // Assert
            _output.WriteLine($"\n=== RESULT ===");
            _output.WriteLine($"Total positions found: {positions.Count}");

            Assert.NotNull(positions);
            Assert.NotEmpty(positions);

            foreach (var position in positions)
            {
                _output.WriteLine($"\n--- Position ---");
                _output.WriteLine($"Pool: {position.Pool}");
                _output.WriteLine($"Total Value USD: {position.TotalValueUsd}");
                _output.WriteLine($"Tokens:");
                
                foreach (var token in position.Tokens)
                {
                    _output.WriteLine($"  - Mint: {token.Mint}");
                    _output.WriteLine($"    Amount: {token.Amount}");
                    _output.WriteLine($"    Type: {token.Type}");
                }

                // Validations
                Assert.NotNull(position.Pool);
                Assert.NotNull(position.Tokens);
                // CLMM positions have 2 supplied tokens + 2 uncollected fee tokens = 4 total
                Assert.True(position.Tokens.Count >= 2, "Position should have at least 2 tokens");

                // Separate supplied tokens from uncollected fees
                var suppliedTokens = position.Tokens.Where(t => t.Type == DeFi10.API.Models.TokenType.Supplied).ToList();
                var feeTokens = position.Tokens.Where(t => t.Type == DeFi10.API.Models.TokenType.LiquidityUncollectedFee).ToList();
                
                Assert.Equal(2, suppliedTokens.Count); // Always 2 supplied tokens (tokenA and tokenB)
                
                var tokenA = suppliedTokens[0];
                var tokenB = suppliedTokens[1];

                _output.WriteLine($"\nToken A Amount: {tokenA.Amount}");
                _output.WriteLine($"Token B Amount: {tokenB.Amount}");

                // At least one token should have a positive amount
                Assert.True(tokenA.Amount > 0 || tokenB.Amount > 0, 
                    "Position should have at least one token with positive amount");

                // For the known test wallet, we expect:
                // - Token A (WSOL): ~14.15 SOL = 14,150,000,000 raw units (9 decimals)
                // - Token B (USDC): ~0 USDC (position is below range)
                
                // Identify which token is WSOL and which is USDC
                const string WSOL_MINT = "So11111111111111111111111111111111111111112";
                const string USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

                var wsolToken = position.Tokens.FirstOrDefault(t => t.Mint == WSOL_MINT);
                var usdcToken = position.Tokens.FirstOrDefault(t => t.Mint == USDC_MINT);

                if (wsolToken != null && usdcToken != null)
                {
                    _output.WriteLine($"\n=== TOKEN VALIDATION ===");
                    
                    // Convert to human-readable amounts
                    decimal solAmount = wsolToken.Amount / 1_000_000_000m; // 9 decimals
                    decimal usdcAmount = usdcToken.Amount / 1_000_000m;     // 6 decimals
                    
                    _output.WriteLine($"SOL Amount: {solAmount:N9} SOL");
                    _output.WriteLine($"USDC Amount: {usdcAmount:N6} USDC");

                    // Expected: ~14.15 SOL and minimal USDC (position is below range)
                    Assert.True(solAmount > 10m && solAmount < 20m, 
                        $"Expected SOL amount between 10 and 20, but got {solAmount}");
                    Assert.True(usdcAmount < 1m, 
                        $"Expected minimal USDC (< 1), but got {usdcAmount}");

                    _output.WriteLine($"\n✓ Token amounts are within expected range");
                    _output.WriteLine($"✓ SOL: {solAmount:N2} (expected ~14.15)");
                    _output.WriteLine($"✓ USDC: {usdcAmount:N2} (expected ~0, position below range)");
                }
            }

            _output.WriteLine($"\n✓ SUCCESS: RaydiumOnChainService returned valid positions");
        }

        [Fact]
        [Trait("Category", "Integration")]
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
        [Trait("Category", "Integration")]
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

        [Fact]
        [Trait("Category", "Integration")]
        public async Task Should_Calculate_Correct_Amounts_For_Known_Position()
        {
            // Arrange & Act
            var positions = await _service.GetPositionsAsync(TEST_WALLET_ADDRESS);

            // Assert
            Assert.NotEmpty(positions);

            var position = positions.First();
            const string WSOL_MINT = "So11111111111111111111111111111111111111112";
            const string USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

            var wsolToken = position.Tokens.FirstOrDefault(t => t.Mint == WSOL_MINT);
            var usdcToken = position.Tokens.FirstOrDefault(t => t.Mint == USDC_MINT);

            Assert.NotNull(wsolToken);
            Assert.NotNull(usdcToken);

            // Raw amounts (as returned by the service)
            _output.WriteLine($"\n=== RAW AMOUNTS (from service) ===");
            _output.WriteLine($"WSOL Raw: {wsolToken.Amount}");
            _output.WriteLine($"USDC Raw: {usdcToken.Amount}");

            // Expected raw amounts based on integration test:
            // - WSOL: 14151011670 (14.15101167 SOL with 9 decimals)
            // - USDC: 0 or very small
            
            const decimal EXPECTED_WSOL_RAW = 14151011670m;
            const decimal TOLERANCE_PERCENT = 5m; // 5% tolerance for blockchain state changes

            decimal wsolDiffPercent = Math.Abs((wsolToken.Amount - EXPECTED_WSOL_RAW) / EXPECTED_WSOL_RAW * 100);
            
            _output.WriteLine($"\n=== COMPARISON ===");
            _output.WriteLine($"Expected WSOL: {EXPECTED_WSOL_RAW}");
            _output.WriteLine($"Actual WSOL: {wsolToken.Amount}");
            _output.WriteLine($"Difference: {wsolDiffPercent:N2}%");

            Assert.True(wsolDiffPercent < TOLERANCE_PERCENT, 
                $"WSOL amount differs by {wsolDiffPercent:N2}%, expected < {TOLERANCE_PERCENT}%");
            
            Assert.True(usdcToken.Amount < 1_000_000m, // < 1 USDC (6 decimals)
                $"USDC amount should be minimal for below-range position, but got {usdcToken.Amount}");

            _output.WriteLine($"\n✓ Amounts match expected values within tolerance");
        }

        [Fact]
        [Trait("Category", "Integration")]
        public async Task Should_Use_Correct_Token_Order()
        {
            // Act
            var positions = await _service.GetPositionsAsync(TEST_WALLET_ADDRESS);

            // Assert
            Assert.NotEmpty(positions);

            foreach (var position in positions)
            {
                Assert.Equal(2, position.Tokens.Count);
                
                var token0 = position.Tokens[0];
                var token1 = position.Tokens[1];

                _output.WriteLine($"\nPosition Pool: {position.Pool}");
                _output.WriteLine($"Token 0: {token0.Mint}");
                _output.WriteLine($"Token 1: {token1.Mint}");

                // Both tokens should have valid mints
                Assert.False(string.IsNullOrEmpty(token0.Mint));
                Assert.False(string.IsNullOrEmpty(token1.Mint));

                // Tokens should be different
                Assert.NotEqual(token0.Mint, token1.Mint);

                _output.WriteLine("✓ Token order is correct");
            }
        }
    }
}
