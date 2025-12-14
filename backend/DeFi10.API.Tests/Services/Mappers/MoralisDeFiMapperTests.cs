using DeFi10.API.Services.Mappers;
using DeFi10.API.Services.Models;
using DeFi10.API.Models;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using Moq;
using Xunit;

namespace DeFi10.API.Tests.Services.Mappers;

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
        _protocolConfig.Setup(x => x.GetEnabledChainEnums(ProtocolNames.Moralis, "Solana"))
            .Returns(new[] { Chain.Ethereum, Chain.Base });
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.Moralis))
            .Returns(CreateMockProtocolDefinition());
    }

    private ProtocolDefinition CreateMockProtocolDefinition()
    {
        return new ProtocolDefinition
        {
            Key = ProtocolNames.Moralis,
            DisplayName = "Moralis",
            Website = "https://moralis.io",
            Icon = "moralis.svg"
        };
    }

    [Fact]
    public async Task MapAsync_WithLiquidityPosition_CreatesLiquidityPoolType()
    {
        var positions = new List<GetDeFiPositionsMoralisInfo>
        {
            new GetDeFiPositionsMoralisInfo
            {
                Position = new MoralisPosition
                {
                    Label = "Liquidity",
                    Tokens = new List<MoralisToken>
                    {
                        new MoralisToken
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
                Position = new MoralisPosition
                {
                    Label = "Supplied",
                    Tokens = new List<MoralisToken>
                    {
                        new MoralisToken
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
                Position = new MoralisPosition
                {
                    Label = "Staking",
                    Tokens = new List<MoralisToken> { new MoralisToken { Symbol = "ETH" } }
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
