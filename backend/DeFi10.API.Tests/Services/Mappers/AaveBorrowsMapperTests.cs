using DeFi10.API.Services.Mappers;
using DeFi10.API.Services.Models;
using DeFi10.API.Models;
using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using Moq;
using Xunit;

namespace DeFi10.API.Tests.Services.Mappers;

public class AaveBorrowsMapperTests
{
    private readonly Mock<ITokenFactory> _tokenFactory;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly AaveBorrowsMapper _mapper;

    public AaveBorrowsMapperTests()
    {
        _tokenFactory = new Mock<ITokenFactory>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _chainConfig = new Mock<IChainConfigurationService>();
        _mapper = new AaveBorrowsMapper(_tokenFactory.Object, _protocolConfig.Object, _chainConfig.Object);

        SetupDefaultMocks();
    }

    private void SetupDefaultMocks()
    {
        _protocolConfig.Setup(x => x.IsChainEnabledForProtocol(ProtocolNames.AaveV3, It.IsAny<Chain>())).Returns(true);
        _protocolConfig.Setup(x => x.GetEnabledChainEnums(ProtocolNames.AaveV3)).Returns(new[] { Chain.Ethereum, Chain.Base });
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.AaveV3)).Returns(CreateMockProtocolDefinition());
        
        _tokenFactory.Setup(x => x.CreateBorrowed(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol, Financials = new TokenFinancials { BalanceFormatted = amt } });
    }

    private ProtocolDefinition CreateMockProtocolDefinition()
    {
        return new ProtocolDefinition
        {
            Key = ProtocolNames.AaveV3,
            DisplayName = "Aave V3",
            Website = "https://aave.com",
            Icon = "aave.svg"
        };
    }

    [Fact]
    public void SupportsChain_WithEnabledChain_ReturnsTrue()
    {
        var result = _mapper.SupportsChain(Chain.Ethereum);

        Assert.True(result);
    }

    [Fact]
    public async Task MapAsync_WithNullResponse_ReturnsEmptyList()
    {
        var result = await _mapper.MapAsync(null, Chain.Ethereum);

        Assert.Empty(result);
    }

    [Fact]
    public async Task MapAsync_WithValidBorrow_CreatesWalletItem()
    {
        var response = new AaveGetUserBorrowsResponse
        {
            Data = new AaveUserBorrowsData
            {
                UserBorrows = new List<AaveUserBorrow>
                {
                    new AaveUserBorrow
                    {
                        Currency = new AaveCurrency
                        {
                            Name = "USD Coin",
                            Symbol = "USDC",
                            Address = "0xusdc"
                        },
                        Debt = new AaveDebt
                        {
                            Amount = new AaveAmount { Value = "1000.50" },
                            Usd = "1000.50"
                        }
                    }
                }
            }
        };

        var result = await _mapper.MapAsync(response, Chain.Ethereum);

        Assert.Single(result);
        Assert.Equal(WalletItemType.LendingAndBorrowing, result[0].Type);
        Assert.Equal("Borrowed", result[0].Position.Label);
        Assert.Single(result[0].Position.Tokens);
    }

    [Fact]
    public async Task MapAsync_WithInvalidAmount_SkipsEntry()
    {
        var response = new AaveGetUserBorrowsResponse
        {
            Data = new AaveUserBorrowsData
            {
                UserBorrows = new List<AaveUserBorrow>
                {
                    new AaveUserBorrow
                    {
                        Currency = new AaveCurrency { Symbol = "USDC" },
                        Debt = new AaveDebt
                        {
                            Amount = new AaveAmount { Value = "invalid" },
                            Usd = "1000"
                        }
                    }
                }
            }
        };

        var result = await _mapper.MapAsync(response, Chain.Ethereum);

        Assert.Empty(result);
    }

    [Fact]
    public async Task MapAsync_WithZeroAmount_SkipsEntry()
    {
        var response = new AaveGetUserBorrowsResponse
        {
            Data = new AaveUserBorrowsData
            {
                UserBorrows = new List<AaveUserBorrow>
                {
                    new AaveUserBorrow
                    {
                        Currency = new AaveCurrency { Symbol = "USDC" },
                        Debt = new AaveDebt
                        {
                            Amount = new AaveAmount { Value = "0" },
                            Usd = "0"
                        }
                    }
                }
            }
        };

        var result = await _mapper.MapAsync(response, Chain.Ethereum);

        Assert.Empty(result);
    }
}
