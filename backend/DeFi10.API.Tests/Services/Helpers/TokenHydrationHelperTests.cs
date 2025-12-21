using DeFi10.API.Models;
using DeFi10.API.Services.Helpers;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace DeFi10.API.Tests.Services.Helpers;

public class TokenHydrationHelperTests
{
    private readonly Mock<ITokenMetadataService> _metadataServiceMock;
    private readonly Mock<ILogger<TokenHydrationHelper>> _loggerMock;
    private readonly TokenHydrationHelper _sut;

    public TokenHydrationHelperTests()
    {
        _metadataServiceMock = new Mock<ITokenMetadataService>();
        _loggerMock = new Mock<ILogger<TokenHydrationHelper>>();
        _sut = new TokenHydrationHelper(_metadataServiceMock.Object, _loggerMock.Object);
    }

    #region BuildMetadataDictionaries Tests

    [Fact]
    public void BuildMetadataDictionaries_WithTokensHavingBothPriceAndLogo_StoresBoth()
    {
        // Arrange
        var walletItems = new[]
        {
            CreateWalletItem("USDC", "USD Coin", "0x123", 
                price: 0.99994m, logo: "https://example.com/usdc.png")
        };

        // Act
        var (addressToMetadata, symbolNameToMetadata, symbolToLogo) = _sut.BuildMetadataDictionaries(walletItems);

        // Assert
        Assert.Single(symbolNameToMetadata);
        var metadata = symbolNameToMetadata["USDC:USD COIN"];
        Assert.Equal(0.99994m, metadata.PriceUsd);
        Assert.Equal("https://example.com/usdc.png", metadata.LogoUrl);
    }

    [Fact]
    public void BuildMetadataDictionaries_WithSecondTokenHavingPrice_UpdatesExistingMetadata()
    {
        // Arrange
        var walletItems = new[]
        {
            CreateWalletItem("USDC", "USD Coin", "0x111", price: null, logo: null),
            CreateWalletItem("USDC", "USD Coin", "0x222", price: 0.99994m, logo: "https://example.com/usdc.png")
        };

        // Act
        var (addressToMetadata, symbolNameToMetadata, symbolToLogo) = _sut.BuildMetadataDictionaries(walletItems);

        // Assert
        var metadata = symbolNameToMetadata["USDC:USD COIN"];
        Assert.Equal(0.99994m, metadata.PriceUsd);
        Assert.Equal("https://example.com/usdc.png", metadata.LogoUrl);
    }

    [Fact]
    public void BuildMetadataDictionaries_WithSecondTokenHavingLogo_UpdatesExistingMetadata()
    {
        // Arrange
        var walletItems = new[]
        {
            CreateWalletItem("USDC", "USD Coin", "0x111", price: 0.99994m, logo: null),
            CreateWalletItem("USDC", "USD Coin", "0x222", price: null, logo: "https://example.com/usdc.png")
        };

        // Act
        var (addressToMetadata, symbolNameToMetadata, symbolToLogo) = _sut.BuildMetadataDictionaries(walletItems);

        // Assert
        var metadata = symbolNameToMetadata["USDC:USD COIN"];
        Assert.Equal(0.99994m, metadata.PriceUsd);
        Assert.Equal("https://example.com/usdc.png", metadata.LogoUrl);
    }

    [Fact]
    public void BuildMetadataDictionaries_WithTokensProcessedInDifferentOrder_MergesCorrectly()
    {
        // Arrange - Simulating Kamino USDC (no price, no logo) and Base USDC (with price and logo)
        var walletItems = new[]
        {
            CreateWalletItem("USDC", "USD Coin", "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59", 
                price: null, logo: null), // Kamino vault token
            CreateWalletItem("USDC", "USD Coin", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 
                price: 0.99994m, logo: "https://example.com/usdc.png") // Base USDC
        };

        // Act
        var (addressToMetadata, symbolNameToMetadata, symbolToLogo) = _sut.BuildMetadataDictionaries(walletItems);

        // Assert
        var metadata = symbolNameToMetadata["USDC:USD COIN"];
        Assert.Equal(0.99994m, metadata.PriceUsd);
        Assert.Equal("https://example.com/usdc.png", metadata.LogoUrl);
        Assert.Equal("USDC", metadata.Symbol);
        Assert.Equal("USD Coin", metadata.Name);
    }

    [Fact]
    public void BuildMetadataDictionaries_WithMultipleTokens_BuildsSeparateDictionaries()
    {
        // Arrange
        var walletItems = new[]
        {
            CreateWalletItem("USDC", "USD Coin", "0x111", price: 1m, logo: "https://example.com/usdc.png"),
            CreateWalletItem("WETH", "Wrapped ETH", "0x222", price: 2000m, logo: "https://example.com/weth.png"),
            CreateWalletItem("DAI", "Dai Stablecoin", "0x333", price: 1m, logo: "https://example.com/dai.png")
        };

        // Act
        var (addressToMetadata, symbolNameToMetadata, symbolToLogo) = _sut.BuildMetadataDictionaries(walletItems);

        // Assert
        Assert.Equal(3, addressToMetadata.Count);
        Assert.Equal(3, symbolNameToMetadata.Count);
        Assert.Equal(3, symbolToLogo.Count);
        
        Assert.Contains("USDC:USD COIN", symbolNameToMetadata.Keys);
        Assert.Contains("WETH:WRAPPED ETH", symbolNameToMetadata.Keys);
        Assert.Contains("DAI:DAI STABLECOIN", symbolNameToMetadata.Keys);
    }

    [Fact]
    public void BuildMetadataDictionaries_WithNoPriceOrLogo_StoresNullValues()
    {
        // Arrange
        var walletItems = new[]
        {
            CreateWalletItem("UNKNOWN", "Unknown Token", "0x999", price: null, logo: null)
        };

        // Act
        var (addressToMetadata, symbolNameToMetadata, symbolToLogo) = _sut.BuildMetadataDictionaries(walletItems);

        // Assert
        var metadata = symbolNameToMetadata["UNKNOWN:UNKNOWN TOKEN"];
        Assert.Null(metadata.PriceUsd);
        Assert.Null(metadata.LogoUrl);
    }

    [Fact]
    public void BuildMetadataDictionaries_WithZeroPrice_TreatsAsNoPrice()
    {
        // Arrange
        var walletItems = new[]
        {
            CreateWalletItem("TOKEN", "Test Token", "0x111", price: 0m, logo: null),
            CreateWalletItem("TOKEN", "Test Token", "0x222", price: 10m, logo: "https://example.com/token.png")
        };

        // Act
        var (addressToMetadata, symbolNameToMetadata, symbolToLogo) = _sut.BuildMetadataDictionaries(walletItems);

        // Assert
        var metadata = symbolNameToMetadata["TOKEN:TEST TOKEN"];
        Assert.Equal(10m, metadata.PriceUsd); // Should use non-zero price
    }

    [Fact]
    public void BuildMetadataDictionaries_PreservesExistingPriceWhenUpdatingLogo()
    {
        // Arrange
        var walletItems = new[]
        {
            CreateWalletItem("ETH", "Ethereum", "0x111", price: 2000m, logo: null),
            CreateWalletItem("ETH", "Ethereum", "0x222", price: null, logo: "https://example.com/eth.png")
        };

        // Act
        var (addressToMetadata, symbolNameToMetadata, symbolToLogo) = _sut.BuildMetadataDictionaries(walletItems);

        // Assert
        var metadata = symbolNameToMetadata["ETH:ETHEREUM"];
        Assert.Equal(2000m, metadata.PriceUsd);
        Assert.Equal("https://example.com/eth.png", metadata.LogoUrl);
    }

    [Fact]
    public void BuildMetadataDictionaries_PreservesExistingLogoWhenUpdatingPrice()
    {
        // Arrange
        var walletItems = new[]
        {
            CreateWalletItem("BTC", "Bitcoin", "0x111", price: null, logo: "https://example.com/btc.png"),
            CreateWalletItem("BTC", "Bitcoin", "0x222", price: 50000m, logo: null)
        };

        // Act
        var (addressToMetadata, symbolNameToMetadata, symbolToLogo) = _sut.BuildMetadataDictionaries(walletItems);

        // Assert
        var metadata = symbolNameToMetadata["BTC:BITCOIN"];
        Assert.Equal(50000m, metadata.PriceUsd);
        Assert.Equal("https://example.com/btc.png", metadata.LogoUrl);
    }

    [Fact]
    public void BuildMetadataDictionaries_WithThreeTokensSameSymbol_ConsolidatesAll()
    {
        // Arrange
        var walletItems = new[]
        {
            CreateWalletItem("USDC", "USD Coin", "0x111", price: null, logo: null), // Kamino - no data
            CreateWalletItem("USDC", "USD Coin", "0x222", price: 0.99994m, logo: null), // Intermediate - has price
            CreateWalletItem("USDC", "USD Coin", "0x333", price: null, logo: "https://example.com/usdc.png") // Final - has logo
        };

        // Act
        var (addressToMetadata, symbolNameToMetadata, symbolToLogo) = _sut.BuildMetadataDictionaries(walletItems);

        // Assert
        var metadata = symbolNameToMetadata["USDC:USD COIN"];
        Assert.Equal(0.99994m, metadata.PriceUsd);
        Assert.Equal("https://example.com/usdc.png", metadata.LogoUrl);
    }

    [Fact]
    public void BuildMetadataDictionaries_IsCaseInsensitive()
    {
        // Arrange
        var walletItems = new[]
        {
            CreateWalletItem("usdc", "usd coin", "0x111", price: 1m, logo: null),
            CreateWalletItem("USDC", "USD COIN", "0x222", price: null, logo: "https://example.com/usdc.png")
        };

        // Act
        var (addressToMetadata, symbolNameToMetadata, symbolToLogo) = _sut.BuildMetadataDictionaries(walletItems);

        // Assert
        Assert.Single(symbolNameToMetadata);
        var metadata = symbolNameToMetadata["USDC:USD COIN"];
        Assert.Equal(1m, metadata.PriceUsd);
        Assert.Equal("https://example.com/usdc.png", metadata.LogoUrl);
    }

    #endregion

    #region Helper Methods

    private WalletItem CreateWalletItem(string symbol, string name, string address, decimal? price, string? logo)
    {
        return new WalletItem
        {
            Position = new Position
            {
                Tokens = new List<Token>
                {
                    new Token
                    {
                        Symbol = symbol,
                        Name = name,
                        ContractAddress = address,
                        Logo = logo,
                        Financials = price.HasValue ? new TokenFinancials
                        {
                            Price = price.Value,
                            BalanceFormatted = 1m
                        } : null
                    }
                }
            }
        };
    }

    #endregion
}
