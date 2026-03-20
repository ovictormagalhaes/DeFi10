using DeFi10.API.Models;
using DeFi10.API.Services.Protocols.Kamino;
using DeFi10.API.Services.Protocols.Kamino.Models;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using Xunit.Abstractions;

namespace DeFi10.API.IntegrationTests;

/// <summary>
/// Integration test to verify Kamino returns correct number of supplies and borrows
/// </summary>
public class KaminoUserPositionsTests
{
    private readonly ITestOutputHelper _output;
    private const string TestWalletAddress = "884XrhgNyJFM88AtRpBe1JwycCiWv6PXXhY2bZHWHXQk";

    public KaminoUserPositionsTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    public async Task GetPositions_ShouldReturn2SuppliesAnd1Borrow()
    {
        // Arrange
        var httpClient = new HttpClient();
        var logger = new Mock<ILogger<KaminoService>>();
        
        var solanaOptions = Options.Create(new SolanaOptions 
        { 
            RateLimitDelayMs = 0 
        });
        
        var kaminoOptions = Options.Create(new KaminoOptions());
        
        var protocolConfigMock = new Mock<IProtocolConfigurationService>();
        protocolConfigMock
            .Setup(x => x.GetProtocolOnChain("kamino", Chain.Solana))
            .Returns(new ProtocolChainResolved(
                "kamino",
                Chain.Solana,
                new Dictionary<string, string>
                {
                    ["Enabled"] = "true",
                    ["ApiUrl"] = "https://api.kamino.finance"
                }));

        var service = new KaminoService(
            httpClient, 
            solanaOptions, 
            kaminoOptions, 
            protocolConfigMock.Object, 
            logger.Object);

        // Act
        _output.WriteLine($"Fetching Kamino positions for wallet: {TestWalletAddress}");
        var positions = await service.GetPositionsAsync(TestWalletAddress, Chain.Solana);

        // Assert
        Assert.NotNull(positions);
        var positionsList = positions.ToList();
        
        _output.WriteLine($"\nTotal positions found: {positionsList.Count}");
        
        Assert.NotEmpty(positionsList);

        foreach (var position in positionsList)
        {
            _output.WriteLine($"\n=== Position: {position.Market} ===");
            _output.WriteLine($"ID: {position.Id}");
            _output.WriteLine($"Health Factor: {position.HealthFactor}");
            _output.WriteLine($"Supplied USD: ${position.SuppliedUsd:F2}");
            _output.WriteLine($"Borrowed USD: ${position.BorrowedUsd:F2}");
            _output.WriteLine($"Total tokens: {position.Tokens.Count}");
            
            var supplies = position.Tokens.Where(t => t.Type == TokenType.Supplied).ToList();
            var borrows = position.Tokens.Where(t => t.Type == TokenType.Borrowed).ToList();
            
            _output.WriteLine($"\n--- Supplies ({supplies.Count}) ---");
            foreach (var token in supplies)
            {
                _output.WriteLine($"  • {token.Symbol}: {token.Amount:F6} (${token.PriceUsd:F2}/unit, Total: ${token.Amount * token.PriceUsd:F2})");
                _output.WriteLine($"    Mint: {token.Mint}");
                _output.WriteLine($"    Decimals: {token.Decimals}");
                if (token.Apy.HasValue)
                    _output.WriteLine($"    APY: {token.Apy:F2}%");
            }
            
            _output.WriteLine($"\n--- Borrows ({borrows.Count}) ---");
            foreach (var token in borrows)
            {
                _output.WriteLine($"  • {token.Symbol}: {token.Amount:F6} (${token.PriceUsd:F2}/unit, Total: ${token.Amount * token.PriceUsd:F2})");
                _output.WriteLine($"    Mint: {token.Mint}");
                _output.WriteLine($"    Decimals: {token.Decimals}");
                if (token.Apy.HasValue)
                    _output.WriteLine($"    APY: {token.Apy:F2}%");
            }

            // Verify counts
            _output.WriteLine($"\n=== VERIFICATION ===");
            _output.WriteLine($"Expected: 2 supplies, 1 borrow");
            _output.WriteLine($"Actual: {supplies.Count} supplies, {borrows.Count} borrows");
            
            Assert.Equal(2, supplies.Count);
            Assert.Equal(1, borrows.Count);

            // Verify cbBTC is present in supplies
            var cbBtcToken = supplies.FirstOrDefault(t => 
                string.Equals(t.Symbol, "cbBTC", StringComparison.OrdinalIgnoreCase));
            
            Assert.NotNull(cbBtcToken);
            _output.WriteLine($"\n✓ cbBTC found in supplies!");
            _output.WriteLine($"  Symbol: {cbBtcToken.Symbol}");
            _output.WriteLine($"  Amount: {cbBtcToken.Amount}");
            _output.WriteLine($"  Decimals: {cbBtcToken.Decimals}");
            
            // Verify cbBTC has correct decimals (8)
            Assert.Equal(8, cbBtcToken.Decimals);
            _output.WriteLine($"  ✓ Decimals correct: {cbBtcToken.Decimals}");

            // Verify USDC is in borrows
            var usdcToken = borrows.FirstOrDefault(t => 
                string.Equals(t.Symbol, "USDC", StringComparison.OrdinalIgnoreCase));
            
            Assert.NotNull(usdcToken);
            _output.WriteLine($"\n✓ USDC found in borrows!");
            _output.WriteLine($"  Symbol: {usdcToken.Symbol}");
            _output.WriteLine($"  Amount: {usdcToken.Amount}");
            _output.WriteLine($"  Decimals: {usdcToken.Decimals}");
            
            // Verify USDC has correct decimals (6)
            Assert.Equal(6, usdcToken.Decimals);
            _output.WriteLine($"  ✓ Decimals correct: {usdcToken.Decimals}");
        }

        _output.WriteLine("\n✅ All assertions passed!");
    }

    [Fact]
    public async Task GetPositions_AllTokensShouldHaveValidSymbols()
    {
        // Arrange
        var httpClient = new HttpClient();
        var logger = new Mock<ILogger<KaminoService>>();
        
        var solanaOptions = Options.Create(new SolanaOptions 
        { 
            RateLimitDelayMs = 0 
        });
        
        var kaminoOptions = Options.Create(new KaminoOptions());
        
        var protocolConfigMock = new Mock<IProtocolConfigurationService>();
        protocolConfigMock
            .Setup(x => x.GetProtocolOnChain("kamino", Chain.Solana))
            .Returns(new ProtocolChainResolved(
                "kamino",
                Chain.Solana,
                new Dictionary<string, string>
                {
                    ["Enabled"] = "true",
                    ["ApiUrl"] = "https://api.kamino.finance"
                }));

        var service = new KaminoService(
            httpClient, 
            solanaOptions, 
            kaminoOptions, 
            protocolConfigMock.Object, 
            logger.Object);

        // Act
        var positions = await service.GetPositionsAsync(TestWalletAddress, Chain.Solana);

        // Assert
        var positionsList = positions.ToList();
        Assert.NotEmpty(positionsList);

        foreach (var position in positionsList)
        {
            foreach (var token in position.Tokens)
            {
                // No token should have "UNKNOWN" or "Token-" prefix
                Assert.NotEqual("UNKNOWN", token.Symbol);
                Assert.DoesNotContain("Token-", token.Symbol);
                
                _output.WriteLine($"✓ Valid symbol: {token.Symbol} ({token.Type})");
            }
        }
    }
}
