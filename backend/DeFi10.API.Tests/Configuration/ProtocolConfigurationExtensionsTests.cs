using DeFi10.API.Configuration;
using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Configuration;
using Moq;
using Xunit;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Tests.Configuration;

public class ProtocolConfigurationExtensionsTests
{
    private readonly Mock<IProtocolConfigurationService> _protocolConfigMock;

    public ProtocolConfigurationExtensionsTests()
    {
        _protocolConfigMock = new Mock<IProtocolConfigurationService>();
    }

    #region GetEnabledChainEnums Tests

    [Fact]
    public void GetEnabledChainEnums_WithNullProtocol_ReturnsEmptyArray()
    {
        _protocolConfigMock.Setup(x => x.GetProtocol("unknown"))
            .Returns((ProtocolDefinition?)null);

        var result = _protocolConfigMock.Object.GetEnabledChainEnums("unknown");

        Assert.Empty(result);
    }

    [Fact]
    public void GetEnabledChainEnums_WithNullChainSupports_ReturnsEmptyArray()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png",
            ChainSupports = null
        };

        _protocolConfigMock.Setup(x => x.GetProtocol("test"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.GetEnabledChainEnums("test");

        Assert.Empty(result);
    }

    [Fact]
    public void GetEnabledChainEnums_WithEmptyChainSupports_ReturnsEmptyArray()
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png",
            ChainSupports = new List<ProtocolChainSupport>()
        };

        _protocolConfigMock.Setup(x => x.GetProtocol("test"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.GetEnabledChainEnums("test");

        Assert.Empty(result);
    }

    [Fact]
    public void GetEnabledChainEnums_WithEnabledChains_ReturnsChainEnums()
    {
        var definition = new ProtocolDefinition
        {
            Key = "aave",
            DisplayName = "Aave",
            Website = "https://aave.com",
            Icon = "aave.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                },
                new ProtocolChainSupport
                {
                    Chain = "Polygon",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                }
            }
        };

        _protocolConfigMock.Setup(x => x.GetProtocol("aave"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.GetEnabledChainEnums("aave");

        Assert.Equal(2, result.Length);
        Assert.Contains(ChainEnum.Ethereum, result);
        Assert.Contains(ChainEnum.Polygon, result);
    }

    [Fact]
    public void GetEnabledChainEnums_WithDisabledChains_FiltersThemOut()
    {
        var definition = new ProtocolDefinition
        {
            Key = "uniswap",
            DisplayName = "Uniswap",
            Website = "https://uniswap.org",
            Icon = "uniswap.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                },
                new ProtocolChainSupport
                {
                    Chain = "Polygon",
                    Options = new Dictionary<string, string> { { "Enabled", "false" } }
                },
                new ProtocolChainSupport
                {
                    Chain = "Arbitrum",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                }
            }
        };

        _protocolConfigMock.Setup(x => x.GetProtocol("uniswap"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.GetEnabledChainEnums("uniswap");

        Assert.Equal(2, result.Length);
        Assert.Contains(ChainEnum.Ethereum, result);
        Assert.Contains(ChainEnum.Arbitrum, result);
        Assert.DoesNotContain(ChainEnum.Polygon, result);
    }

    [Fact]
    public void GetEnabledChainEnums_WithExcludedChains_FiltersThemOut()
    {
        var definition = new ProtocolDefinition
        {
            Key = "curve",
            DisplayName = "Curve",
            Website = "https://curve.fi",
            Icon = "curve.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                },
                new ProtocolChainSupport
                {
                    Chain = "Polygon",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                },
                new ProtocolChainSupport
                {
                    Chain = "Arbitrum",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                }
            }
        };

        _protocolConfigMock.Setup(x => x.GetProtocol("curve"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.GetEnabledChainEnums("curve", "Polygon");

        Assert.Equal(2, result.Length);
        Assert.Contains(ChainEnum.Ethereum, result);
        Assert.Contains(ChainEnum.Arbitrum, result);
        Assert.DoesNotContain(ChainEnum.Polygon, result);
    }

    [Fact]
    public void GetEnabledChainEnums_WithMultipleExcludedChains_FiltersAllOut()
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
                },
                new ProtocolChainSupport
                {
                    Chain = "Polygon",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                },
                new ProtocolChainSupport
                {
                    Chain = "Arbitrum",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                }
            }
        };

        _protocolConfigMock.Setup(x => x.GetProtocol("balancer"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.GetEnabledChainEnums("balancer", "Polygon", "Arbitrum");

        Assert.Single(result);
        Assert.Contains(ChainEnum.Ethereum, result);
    }

    [Fact]
    public void GetEnabledChainEnums_CaseInsensitiveChainName_Works()
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
                },
                new ProtocolChainSupport
                {
                    Chain = "POLYGON",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                }
            }
        };

        _protocolConfigMock.Setup(x => x.GetProtocol("test"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.GetEnabledChainEnums("test");

        Assert.Equal(2, result.Length);
        Assert.Contains(ChainEnum.Ethereum, result);
        Assert.Contains(ChainEnum.Polygon, result);
    }

    [Fact]
    public void GetEnabledChainEnums_CaseInsensitiveEnabledValue_Works()
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
                },
                new ProtocolChainSupport
                {
                    Chain = "Polygon",
                    Options = new Dictionary<string, string> { { "Enabled", "True" } }
                }
            }
        };

        _protocolConfigMock.Setup(x => x.GetProtocol("test"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.GetEnabledChainEnums("test");

        Assert.Equal(2, result.Length);
    }

    [Fact]
    public void GetEnabledChainEnums_WithNullOptions_FiltersOut()
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

        _protocolConfigMock.Setup(x => x.GetProtocol("test"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.GetEnabledChainEnums("test");

        Assert.Empty(result);
    }

    [Fact]
    public void GetEnabledChainEnums_WithMissingEnabledKey_FiltersOut()
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
                    Options = new Dictionary<string, string> { { "OtherKey", "value" } }
                }
            }
        };

        _protocolConfigMock.Setup(x => x.GetProtocol("test"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.GetEnabledChainEnums("test");

        Assert.Empty(result);
    }

    #endregion

    #region IsChainEnabledForProtocol Tests

    [Fact]
    public void IsChainEnabledForProtocol_WithEnabledChain_ReturnsTrue()
    {
        var definition = new ProtocolDefinition
        {
            Key = "aave",
            DisplayName = "Aave",
            Website = "https://aave.com",
            Icon = "aave.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                }
            }
        };

        _protocolConfigMock.Setup(x => x.GetProtocol("aave"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.IsChainEnabledForProtocol("aave", ChainEnum.Ethereum);

        Assert.True(result);
    }

    [Fact]
    public void IsChainEnabledForProtocol_WithDisabledChain_ReturnsFalse()
    {
        var definition = new ProtocolDefinition
        {
            Key = "aave",
            DisplayName = "Aave",
            Website = "https://aave.com",
            Icon = "aave.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = new Dictionary<string, string> { { "Enabled", "false" } }
                }
            }
        };

        _protocolConfigMock.Setup(x => x.GetProtocol("aave"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.IsChainEnabledForProtocol("aave", ChainEnum.Ethereum);

        Assert.False(result);
    }

    [Fact]
    public void IsChainEnabledForProtocol_WithNonExistentChain_ReturnsFalse()
    {
        var definition = new ProtocolDefinition
        {
            Key = "aave",
            DisplayName = "Aave",
            Website = "https://aave.com",
            Icon = "aave.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                }
            }
        };

        _protocolConfigMock.Setup(x => x.GetProtocol("aave"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.IsChainEnabledForProtocol("aave", ChainEnum.Solana);

        Assert.False(result);
    }

    [Fact]
    public void IsChainEnabledForProtocol_WithNullProtocol_ReturnsFalse()
    {
        _protocolConfigMock.Setup(x => x.GetProtocol("unknown"))
            .Returns((ProtocolDefinition?)null);

        var result = _protocolConfigMock.Object.IsChainEnabledForProtocol("unknown", ChainEnum.Ethereum);

        Assert.False(result);
    }

    [Theory]
    [InlineData(ChainEnum.Ethereum)]
    [InlineData(ChainEnum.Polygon)]
    [InlineData(ChainEnum.Arbitrum)]
    [InlineData(ChainEnum.Optimism)]
    [InlineData(ChainEnum.Base)]
    public void IsChainEnabledForProtocol_WithMultipleEnabledChains_ReturnsCorrectly(ChainEnum chain)
    {
        var definition = new ProtocolDefinition
        {
            Key = "test",
            DisplayName = "Test",
            Website = "https://test.com",
            Icon = "test.png",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport { Chain = "Ethereum", Options = new Dictionary<string, string> { { "Enabled", "true" } } },
                new ProtocolChainSupport { Chain = "Polygon", Options = new Dictionary<string, string> { { "Enabled", "true" } } },
                new ProtocolChainSupport { Chain = "Arbitrum", Options = new Dictionary<string, string> { { "Enabled", "true" } } },
                new ProtocolChainSupport { Chain = "Optimism", Options = new Dictionary<string, string> { { "Enabled", "true" } } },
                new ProtocolChainSupport { Chain = "Base", Options = new Dictionary<string, string> { { "Enabled", "true" } } }
            }
        };

        _protocolConfigMock.Setup(x => x.GetProtocol("test"))
            .Returns(definition);

        var result = _protocolConfigMock.Object.IsChainEnabledForProtocol("test", chain);

        Assert.True(result);
    }

    #endregion
}
