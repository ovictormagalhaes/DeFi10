using DeFi10.API.Configuration;
using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Configuration;
using Moq;
using Xunit;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Tests.Configuration;

public class ProtocolDefinitionExtensionsTests
{
    private readonly Mock<IChainConfigurationService> _chainConfigMock;

    public ProtocolDefinitionExtensionsTests()
    {
        _chainConfigMock = new Mock<IChainConfigurationService>();
    }

    #region ToProtocol Valid Tests

    [Fact]
    public void ToProtocol_WithValidData_ReturnsProtocol()
    {
        var definition = new ProtocolDefinition
        {
            Key = "aave",
            DisplayName = "Aave",
            Website = "https://aave.com",
            Icon = "aave-icon.png"
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Ethereum))
            .Returns(new ChainConfig { Slug = "ethereum" });

        var result = definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object);

        Assert.NotNull(result);
        Assert.Equal("Aave", result.Name);
        Assert.Equal("ethereum", result.Chain);
        Assert.Equal("aave", result.Id);
        Assert.Equal("https://aave.com", result.Url);
        Assert.Equal("aave-icon.png", result.Logo);
    }

    [Fact]
    public void ToProtocol_WithChainSlug_UsesSlug()
    {
        var definition = new ProtocolDefinition
        {
            Key = "uniswap",
            DisplayName = "Uniswap",
            Website = "https://uniswap.org",
            Icon = "uniswap.png"
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Base))
            .Returns(new ChainConfig { Slug = "base-chain" });

        var result = definition.ToProtocol(ChainEnum.Base, _chainConfigMock.Object);

        Assert.Equal("base-chain", result.Chain);
    }

    [Fact]
    public void ToProtocol_WithoutChainSlug_UsesChainNameLowercase()
    {
        var definition = new ProtocolDefinition
        {
            Key = "compound",
            DisplayName = "Compound",
            Website = "https://compound.finance",
            Icon = "compound.png"
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Polygon))
            .Returns(new ChainConfig { Slug = "" });

        var result = definition.ToProtocol(ChainEnum.Polygon, _chainConfigMock.Object);

        Assert.Equal("polygon", result.Chain);
    }

    [Fact]
    public void ToProtocol_WithNullChainSlug_UsesChainNameLowercase()
    {
        var definition = new ProtocolDefinition
        {
            Key = "curve",
            DisplayName = "Curve",
            Website = "https://curve.fi",
            Icon = "curve.png"
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Arbitrum))
            .Returns(new ChainConfig { Slug = null });

        var result = definition.ToProtocol(ChainEnum.Arbitrum, _chainConfigMock.Object);

        Assert.Equal("arbitrum", result.Chain);
    }

    [Fact]
    public void ToProtocol_WithEnabledChainSupport_ReturnsProtocol()
    {
        var definition = new ProtocolDefinition
        {
            Key = "balancer",
            DisplayName = "Balancer",
            Website = "https://balancer.fi",
            Icon = "balancer.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                }
            }
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Ethereum))
            .Returns(new ChainConfig { Slug = "ethereum" });

        var result = definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object);

        Assert.NotNull(result);
        Assert.Equal("Balancer", result.Name);
    }

    #endregion

    #region ToProtocol Validation Tests - Null Definition

    [Fact]
    public void ToProtocol_WithNullDefinition_ThrowsInvalidOperationException()
    {
        ProtocolDefinition? definition = null;

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition!.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("Protocol definition is null", exception.Message);
    }

    #endregion

    #region ToProtocol Validation Tests - Missing Fields

    [Fact]
    public void ToProtocol_WithNullKey_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = null,
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png"
        };

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("missing Key", exception.Message);
    }

    [Fact]
    public void ToProtocol_WithEmptyKey_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = "",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png"
        };

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("missing Key", exception.Message);
    }

    [Fact]
    public void ToProtocol_WithWhitespaceKey_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = "   ",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png"
        };

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("missing Key", exception.Message);
    }

    [Fact]
    public void ToProtocol_WithNullDisplayName_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = null,
            Website = "https://test.com",
            Icon = "test.png"
        };

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("test", exception.Message);
        Assert.Contains("missing DisplayName", exception.Message);
    }

    [Fact]
    public void ToProtocol_WithEmptyDisplayName_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "",
            Website = "https://test.com",
            Icon = "test.png"
        };

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("missing DisplayName", exception.Message);
    }

    [Fact]
    public void ToProtocol_WithNullWebsite_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test Protocol",
            Website = null,
            Icon = "test.png"
        };

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("test", exception.Message);
        Assert.Contains("missing Website", exception.Message);
    }

    [Fact]
    public void ToProtocol_WithEmptyWebsite_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test Protocol",
            Website = "",
            Icon = "test.png"
        };

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("missing Website", exception.Message);
    }

    [Fact]
    public void ToProtocol_WithNullIcon_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test Protocol",
            Website = "https://test.com",
            Icon = null
        };

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("test", exception.Message);
        Assert.Contains("missing Icon", exception.Message);
    }

    [Fact]
    public void ToProtocol_WithEmptyIcon_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test Protocol",
            Website = "https://test.com",
            Icon = ""
        };

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("missing Icon", exception.Message);
    }

    #endregion

    #region ToProtocol Chain Configuration Tests

    [Fact]
    public void ToProtocol_WithNullChainConfig_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png"
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Ethereum))
            .Returns((ChainConfig?)null);

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("Chain configuration missing", exception.Message);
        Assert.Contains("Ethereum", exception.Message);
    }

    #endregion

    #region ToProtocol ChainSupport Tests

    [Fact]
    public void ToProtocol_WithChainSupportButNoMatchingChain_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport { Chain = "Polygon" }
            }
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Ethereum))
            .Returns(new ChainConfig { Slug = "ethereum" });

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("test", exception.Message);
        Assert.Contains("no chain support entry", exception.Message);
        Assert.Contains("Ethereum", exception.Message);
    }

    [Fact]
    public void ToProtocol_WithDisabledChainSupport_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = new Dictionary<string, string> { { "Enabled", "false" } }
                }
            }
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Ethereum))
            .Returns(new ChainConfig { Slug = "ethereum" });

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("test", exception.Message);
        Assert.Contains("disabled", exception.Message);
        Assert.Contains("Ethereum", exception.Message);
    }

    [Fact]
    public void ToProtocol_WithChainSupportNoEnabledOption_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = new Dictionary<string, string>()
                }
            }
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Ethereum))
            .Returns(new ChainConfig { Slug = "ethereum" });

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("disabled", exception.Message);
    }

    [Fact]
    public void ToProtocol_WithChainSupportNullOptions_ThrowsInvalidOperationException()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = null
                }
            }
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Ethereum))
            .Returns(new ChainConfig { Slug = "ethereum" });

        var exception = Assert.Throws<InvalidOperationException>(() =>
            definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object));

        Assert.Contains("disabled", exception.Message);
    }

    [Fact]
    public void ToProtocol_WithCaseInsensitiveChainMatch_ReturnsProtocol()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "ethereum",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                }
            }
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Ethereum))
            .Returns(new ChainConfig { Slug = "ethereum" });

        var result = definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object);

        Assert.NotNull(result);
    }

    [Fact]
    public void ToProtocol_WithCaseInsensitiveEnabledValue_ReturnsProtocol()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = new Dictionary<string, string> { { "Enabled", "TRUE" } }
                }
            }
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Ethereum))
            .Returns(new ChainConfig { Slug = "ethereum" });

        var result = definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object);

        Assert.NotNull(result);
    }

    [Fact]
    public void ToProtocol_WithEmptyChainSupports_ReturnsProtocol()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png",
            ChainSupports = new List<ProtocolChainSupport>()
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Ethereum))
            .Returns(new ChainConfig { Slug = "ethereum" });

        var result = definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object);

        Assert.NotNull(result);
    }

    [Fact]
    public void ToProtocol_WithNullChainSupports_ReturnsProtocol()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png",
            ChainSupports = null
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(ChainEnum.Ethereum))
            .Returns(new ChainConfig { Slug = "ethereum" });

        var result = definition.ToProtocol(ChainEnum.Ethereum, _chainConfigMock.Object);

        Assert.NotNull(result);
    }

    #endregion

    #region ToProtocol Integration Tests

    [Theory]
    [InlineData(ChainEnum.Ethereum, "ethereum")]
    [InlineData(ChainEnum.Polygon, "polygon")]
    [InlineData(ChainEnum.Arbitrum, "arbitrum")]
    [InlineData(ChainEnum.Optimism, "optimism")]
    [InlineData(ChainEnum.Base, "base")]
    [InlineData(ChainEnum.BNB, "bnb")]
    [InlineData(ChainEnum.Solana, "solana")]
    public void ToProtocol_WithDifferentChains_UsesCorrectChainName(ChainEnum chain, string expectedChain)
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png"
        };

        _chainConfigMock.Setup(x => x.GetChainConfig(chain))
            .Returns(new ChainConfig { Slug = "" });

        var result = definition.ToProtocol(chain, _chainConfigMock.Object);

        Assert.Equal(expectedChain, result.Chain);
    }

    #endregion
}
