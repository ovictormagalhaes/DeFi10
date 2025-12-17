using System.Text.Json;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Infrastructure.CoinMarketCap;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using DeFi10.API.Services.Helpers;
using Xunit;
using DeFi10.API.Models;
using StackExchange.Redis;

namespace DeFi10.API.Tests.Services.Solana;

/// <summary>
/// Tests for TokenMetadataService covering cache operations, CMC integration, and cross-chain metadata sharing
/// </summary>
public class TokenMetadataServiceTests
{
    private readonly Mock<ICacheService> _mockCache;
    private readonly Mock<ICoinMarketCapService> _mockCmc;
    private readonly Mock<IConnectionMultiplexer> _mockRedis;
    private readonly Mock<ILogger<TokenMetadataService>> _mockLogger;
    private readonly IOptions<AggregationOptions> _options;
    private readonly TokenMetadataService _sut;

    public TokenMetadataServiceTests()
    {
        _mockCache = new Mock<ICacheService>();
        _mockCmc = new Mock<ICoinMarketCapService>();
        _mockRedis = new Mock<IConnectionMultiplexer>();
        _mockLogger = new Mock<ILogger<TokenMetadataService>>();
        _options = Options.Create(new AggregationOptions { EnableCoinMarketCapLookup = true });
        
        _sut = new TokenMetadataService(_mockCache.Object, _mockCmc.Object, _mockRedis.Object, _mockLogger.Object, _options);
    }

    #region GetTokenMetadataAsync Tests

    [Fact]
    public async Task GetTokenMetadataAsync_WithNullMintAddress_ReturnsNull()
    {
        var result = await _sut.GetTokenMetadataAsync(null!);
        
        Assert.Null(result);
    }

    [Fact]
    public async Task GetTokenMetadataAsync_WithEmptyMintAddress_ReturnsNull()
    {
        var result = await _sut.GetTokenMetadataAsync("");
        
        Assert.Null(result);
    }

    [Fact]
    public async Task GetTokenMetadataAsync_WithWhitespaceMintAddress_ReturnsNull()
    {
        var result = await _sut.GetTokenMetadataAsync("   ");
        
        Assert.Null(result);
    }

    [Fact]
    public async Task GetTokenMetadataAsync_CacheHit_ReturnsDeserialized()
    {
        var mintAddress = "SOL123456789";
        var expected = new TokenMetadata { Symbol = "SOL", Name = "Solana", LogoUrl = "https://logo.com/sol.png" };
        var cachedJson = JsonSerializer.Serialize(expected);
        
        _mockCache.Setup(c => c.GetAsync<string>(It.IsAny<string>())).ReturnsAsync(cachedJson);
        
        var result = await _sut.GetTokenMetadataAsync(mintAddress);
        
        Assert.NotNull(result);
        Assert.Equal("SOL", result.Symbol);
        Assert.Equal("Solana", result.Name);
        Assert.Equal("https://logo.com/sol.png", result.LogoUrl);
    }

    [Fact]
    public async Task GetTokenMetadataAsync_CacheMiss_CMCDisabled_ReturnsNull()
    {
        var optionsDisabled = Options.Create(new AggregationOptions { EnableCoinMarketCapLookup = false });
        var sut = new TokenMetadataService(_mockCache.Object, _mockCmc.Object, _mockRedis.Object, _mockLogger.Object, optionsDisabled);
        
        _mockCache.Setup(c => c.GetAsync<string>(It.IsAny<string>())).ReturnsAsync((string?)null);
        
        var result = await sut.GetTokenMetadataAsync("MINT123");
        
        Assert.Null(result);
    }

    [Fact]
    public async Task GetTokenMetadataAsync_NormalizesToLowercase()
    {
        var mintAddress = "UPPERCASE123";
        
        _mockCache.Setup(c => c.GetAsync<string>(It.IsAny<string>())).ReturnsAsync((string?)null);
        
        await _sut.GetTokenMetadataAsync(mintAddress);
        
        _mockCache.Verify(c => c.GetAsync<string>(It.Is<string>(k => k.Contains("uppercase123"))), Times.Once);
    }

    #endregion

    #region GetTokenMetadataBySymbolAndNameAsync Tests

    [Fact]
    public async Task GetTokenMetadataBySymbolAndNameAsync_WithNullSymbol_ReturnsNull()
    {
        var result = await _sut.GetTokenMetadataBySymbolAndNameAsync(null!, "TokenName");
        
        Assert.Null(result);
    }

    [Fact]
    public async Task GetTokenMetadataBySymbolAndNameAsync_WithNullName_ReturnsNull()
    {
        var result = await _sut.GetTokenMetadataBySymbolAndNameAsync("TKN", null!);
        
        Assert.Null(result);
    }

    [Theory]
    [InlineData("", "Name")]
    [InlineData("SYM", "")]
    [InlineData("   ", "Name")]
    [InlineData("SYM", "   ")]
    public async Task GetTokenMetadataBySymbolAndNameAsync_WithInvalidInputs_ReturnsNull(string symbol, string name)
    {
        var result = await _sut.GetTokenMetadataBySymbolAndNameAsync(symbol, name);
        
        Assert.Null(result);
    }

    [Fact]
    public async Task GetTokenMetadataBySymbolAndNameAsync_CacheHit_ReturnsDeserialized()
    {
        var expected = new TokenMetadata { Symbol = "USDC", Name = "USD Coin", LogoUrl = "https://logo.com/usdc.png" };
        var cachedJson = JsonSerializer.Serialize(expected);
        
        _mockCache.Setup(c => c.GetAsync<string>(It.IsAny<string>())).ReturnsAsync(cachedJson);
        
        var result = await _sut.GetTokenMetadataBySymbolAndNameAsync("USDC", "USD Coin");
        
        Assert.NotNull(result);
        Assert.Equal("USDC", result.Symbol);
        Assert.Equal("USD Coin", result.Name);
    }

    [Fact]
    public async Task GetTokenMetadataBySymbolAndNameAsync_CompositeKeyUppercasesSymbol()
    {
        _mockCache.Setup(c => c.GetAsync<string>(It.IsAny<string>())).ReturnsAsync((string?)null);
        
        await _sut.GetTokenMetadataBySymbolAndNameAsync("usdc", "USD Coin");
        
        _mockCache.Verify(c => c.GetAsync<string>(It.Is<string>(k => k.Contains("USDC:USD COIN"))), Times.Once);
    }

    #endregion

    #region GetTokenPriceAsync Tests

    [Fact]
    public async Task GetTokenPriceAsync_WithNullIdentifier_ReturnsNull()
    {
        var result = await _sut.GetTokenPriceAsync(null!);
        
        Assert.Null(result);
    }

    [Fact]
    public async Task GetTokenPriceAsync_WithEmptyIdentifier_ReturnsNull()
    {
        var result = await _sut.GetTokenPriceAsync("");
        
        Assert.Null(result);
    }

    [Fact]
    public async Task GetTokenPriceAsync_CacheHit_ReturnsPrice()
    {
        var identifier = "SOL";
        _mockCache.Setup(c => c.GetAsync<string>(It.IsAny<string>())).ReturnsAsync("150.50");
        
        var result = await _sut.GetTokenPriceAsync(identifier);
        
        Assert.NotNull(result);
        Assert.Equal(150.50m, result.Value);
    }

    [Fact]
    public async Task GetTokenPriceAsync_CacheMiss_ReturnsNull()
    {
        _mockCache.Setup(c => c.GetAsync<string>(It.IsAny<string>())).ReturnsAsync((string?)null);
        
        var result = await _sut.GetTokenPriceAsync("UNKNOWN");
        
        Assert.Null(result);
    }

    [Fact]
    public async Task GetTokenPriceAsync_InvalidDecimalInCache_ReturnsNull()
    {
        _mockCache.Setup(c => c.GetAsync<string>(It.IsAny<string>())).ReturnsAsync("invalid_number");
        
        var result = await _sut.GetTokenPriceAsync("TKN");
        
        Assert.Null(result);
    }

    [Fact]
    public async Task GetTokenPriceAsync_NormalizesToLowercase()
    {
        _mockCache.Setup(c => c.GetAsync<string>(It.IsAny<string>())).ReturnsAsync("100");
        
        await _sut.GetTokenPriceAsync("UPPERCASE");
        
        _mockCache.Verify(c => c.GetAsync<string>(It.Is<string>(k => k.Contains("uppercase"))), Times.Once);
    }

    #endregion

    #region SetTokenMetadataAsync Tests

    [Fact]
    public async Task SetTokenMetadataAsync_WithNullMintAddress_DoesNotCache()
    {
        var metadata = new TokenMetadata { Symbol = "TKN", Name = "Token" };
        
        await _sut.SetTokenMetadataAsync(null!, metadata);
        
        _mockCache.Verify(c => c.SetAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<TimeSpan>()), Times.Never);
    }

    [Fact]
    public async Task SetTokenMetadataAsync_WithNullMetadata_DoesNotCache()
    {
        await _sut.SetTokenMetadataAsync("MINT123", null!);
        
        _mockCache.Verify(c => c.SetAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<TimeSpan>()), Times.Never);
    }

    [Fact]
    public async Task SetTokenMetadataAsync_ValidInputs_CachesByMintAddress()
    {
        var mintAddress = "MINT123";
        var metadata = new TokenMetadata { Symbol = "TKN", Name = "Token", LogoUrl = "https://logo.com" };
        
        await _sut.SetTokenMetadataAsync(mintAddress, metadata);
        
        _mockCache.Verify(c => c.SetAsync(
            It.Is<string>(k => k.Contains("mint123")),
            It.Is<string>(json => json.Contains("TKN")),
            It.IsAny<TimeSpan>()), Times.Once);
    }

    [Fact]
    public async Task SetTokenMetadataAsync_WithSymbolAndName_CachesCompositeKey()
    {
        var metadata = new TokenMetadata { Symbol = "USDC", Name = "USD Coin" };
        
        await _sut.SetTokenMetadataAsync("MINT123", metadata);
        
        _mockCache.Verify(c => c.SetAsync(
            It.Is<string>(k => k.Contains("USDC:USD COIN")),
            It.IsAny<string>(),
            It.IsAny<TimeSpan>()), Times.Once);
    }

    [Fact]
    public async Task SetTokenMetadataAsync_WithoutSymbol_DoesNotCacheComposite()
    {
        var metadata = new TokenMetadata { Symbol = "", Name = "Token" };
        
        await _sut.SetTokenMetadataAsync("MINT123", metadata);
        
        _mockCache.Verify(c => c.SetAsync(
            It.Is<string>(k => k.Contains("token:metadata:symbol:")),
            It.IsAny<string>(),
            It.IsAny<TimeSpan>()), Times.Never);
    }

    #endregion

    #region SetTokenPriceAsync Tests

    [Fact]
    public async Task SetTokenPriceAsync_WithNullIdentifier_DoesNotCache()
    {
        await _sut.SetTokenPriceAsync(null!, 100m);
        
        _mockCache.Verify(c => c.SetAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<TimeSpan>()), Times.Never);
    }

    [Fact]
    public async Task SetTokenPriceAsync_WithEmptyIdentifier_DoesNotCache()
    {
        await _sut.SetTokenPriceAsync("", 100m);
        
        _mockCache.Verify(c => c.SetAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<TimeSpan>()), Times.Never);
    }

    [Fact]
    public async Task SetTokenPriceAsync_ValidInputs_CachesPrice()
    {
        var identifier = "SOL";
        var priceUsd = 150.75m;
        
        await _sut.SetTokenPriceAsync(identifier, priceUsd);
        
        _mockCache.Verify(c => c.SetAsync(
            It.Is<string>(k => k.Contains("sol")),
            "150.75",
            It.IsAny<TimeSpan>()), Times.Once);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(999999999.99)]
    public async Task SetTokenPriceAsync_VariousPrices_CachesCorrectly(decimal price)
    {
        await _sut.SetTokenPriceAsync("TKN", price);
        
        _mockCache.Verify(c => c.SetAsync(
            It.IsAny<string>(),
            price.ToString(System.Globalization.CultureInfo.InvariantCulture),
            It.IsAny<TimeSpan>()), Times.Once);
    }

    #endregion

    #region Exception Handling Tests

    [Fact]
    public async Task GetTokenMetadataAsync_CacheThrowsException_ReturnsNull()
    {
        _mockCache.Setup(c => c.GetAsync<string>(It.IsAny<string>())).ThrowsAsync(new Exception("Cache error"));
        
        var result = await _sut.GetTokenMetadataAsync("MINT123");
        
        Assert.Null(result);
    }

    [Fact]
    public async Task GetTokenPriceAsync_CacheThrowsException_ReturnsNull()
    {
        _mockCache.Setup(c => c.GetAsync<string>(It.IsAny<string>())).ThrowsAsync(new Exception("Cache error"));
        
        var result = await _sut.GetTokenPriceAsync("TKN");
        
        Assert.Null(result);
    }

    [Fact]
    public async Task SetTokenMetadataAsync_CacheThrowsException_DoesNotThrow()
    {
        _mockCache.Setup(c => c.SetAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<TimeSpan>()))
            .ThrowsAsync(new Exception("Cache write error"));
        
        var metadata = new TokenMetadata { Symbol = "TKN", Name = "Token" };
        
        await _sut.SetTokenMetadataAsync("MINT123", metadata);
        
        // Should not throw
    }

    [Fact]
    public async Task SetTokenPriceAsync_CacheThrowsException_DoesNotThrow()
    {
        _mockCache.Setup(c => c.SetAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<TimeSpan>()))
            .ThrowsAsync(new Exception("Cache write error"));
        
        await _sut.SetTokenPriceAsync("TKN", 100m);
        
        // Should not throw
    }

    #endregion
}
