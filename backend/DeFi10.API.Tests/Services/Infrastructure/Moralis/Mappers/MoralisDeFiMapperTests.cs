using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Protocols.Aave.Mappers;
using DeFi10.API.Services.Protocols.Pendle.Mappers;
using DeFi10.API.Services.Protocols.Uniswap.Mappers;
using DeFi10.API.Services.Infrastructure.Moralis.Mappers;
using DeFi10.API.Services.Helpers.Mappers;
using DeFi10.API.Models;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Configuration;
using Moq;
using Xunit;
using DeFi10.API.Services.Infrastructure.Moralis.Models;

namespace DeFi10.API.Tests.Services.Infrastructure.Moralis.Mappers;

public class MoralisDeFiMapperTests
{
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly MoralisDeFiMapper _mapper;

    public MoralisDeFiMapperTests()
    {
        _chainConfig = new Mock<IChainConfigurationService>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();

        SetupDefaultMocks();
        _mapper = new MoralisDeFiMapper(_chainConfig.Object, _protocolConfig.Object);
    }

    private void SetupDefaultMocks()
    {
        var protocolDef = CreateMockProtocolDefinition();
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.Moralis)).Returns(protocolDef);
        _protocolConfig.Setup(x => x.GetAllConfiguredChains(ProtocolNames.Moralis))
            .Returns(new[] { Chain.Ethereum, Chain.Base });
        
        _chainConfig.Setup(x => x.GetChainConfig(It.IsAny<Chain>()))
            .Returns((Chain chain) => CreateMockChainConfig(chain));
    }

    private ChainConfig CreateMockChainConfig(Chain chain)
    {
        return new ChainConfig
        {
            DisplayName = chain.ToString(),
            ChainId = chain == Chain.Ethereum ? 1 : (chain == Chain.Base ? 8453 : 0),
            NativeCurrency = chain == Chain.Solana ? "SOL" : "ETH",
            Slug = chain.ToString().ToLowerInvariant(),
            IsEnabled = true
        };
    }

    private ProtocolDefinition CreateMockProtocolDefinition()
    {
        return new ProtocolDefinition
        {
            Key = ProtocolNames.Moralis,
            DisplayName = "Moralis",
            Website = "https://moralis.io",
            Icon = "moralis.svg",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                },
                new ProtocolChainSupport
                {
                    Chain = "Base",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                }
            }
        };
    }

    [Fact]
    public async Task MapAsync_WithLiquidityPosition_CreatesLiquidityPoolType()
    {
        var positions = new List<GetDeFiPositionsMoralisInfo>
        {
            new GetDeFiPositionsMoralisInfo
            {
                Position = new DeFiPosition
                {
                    Label = "Liquidity",
                    Tokens = new List<DeFiToken>
                    {
                        new DeFiToken
                        {
                            Name = "Ethereum",
                            Symbol = "ETH",
                            Balance = "1000000000000000000",
                            Decimals = "18",
                            UsdPrice = 2000
                        }
                    }
                }
            }
        };

        var result = await _mapper.MapAsync(positions, Chain.Ethereum);

        Assert.Single(result);
        Assert.Equal(WalletItemType.LiquidityPool, result[0].Type);
    }

    [Fact]
    public async Task MapAsync_WithSuppliedPosition_CreatesLendingType()
    {
        var positions = new List<GetDeFiPositionsMoralisInfo>
        {
            new GetDeFiPositionsMoralisInfo
            {
                Position = new DeFiPosition
                {
                    Label = "Supplied",
                    Tokens = new List<DeFiToken>
                    {
                        new DeFiToken
                        {
                            Symbol = "USDC",
                            TokenType = "supplied",
                            Balance = "1000000",
                            Decimals = "6"
                        }
                    }
                }
            }
        };

        var result = await _mapper.MapAsync(positions, Chain.Ethereum);

        Assert.Single(result);
        Assert.Equal(WalletItemType.LendingAndBorrowing, result[0].Type);
        Assert.Equal(TokenType.Supplied, result[0].Position.Tokens[0].Type);
    }

    [Fact]
    public async Task MapAsync_WithStakingPosition_CreatesStakingType()
    {
        var positions = new List<GetDeFiPositionsMoralisInfo>
        {
            new GetDeFiPositionsMoralisInfo
            {
                Position = new DeFiPosition
                {
                    Label = "Staking",
                    Tokens = new List<DeFiToken> { new DeFiToken { Symbol = "ETH" } }
                }
            }
        };

        var result = await _mapper.MapAsync(positions, Chain.Ethereum);

        Assert.Single(result);
        Assert.Equal(WalletItemType.Staking, result[0].Type);
    }

    [Fact]
    public async Task MapAsync_WithNullData_ReturnsEmptyList()
    {
        var result = await _mapper.MapAsync(null, Chain.Ethereum);

        Assert.Empty(result);
    }
}
