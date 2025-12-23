using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Protocols.Aave.Mappers;
using DeFi10.API.Services.Protocols.Pendle.Mappers;
using DeFi10.API.Services.Protocols.Uniswap.Mappers;
using DeFi10.API.Services.Infrastructure.Moralis.Mappers;
using DeFi10.API.Services.Helpers.Mappers;
using DeFi10.API.Models;
using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Protocols.Aave;
using DeFi10.API.Services.Protocols.Aave.Models;
using DeFi10.API.Services.Protocols.Aave.Models.Borrows;
using DeFi10.API.Services.Protocols.Aave.Models.Supplies;
using DeFi10.API.Services.Helpers;
using Moq;
using Xunit;

namespace DeFi10.API.Tests.Services.Protocols.Aave.Mappers;

public class AaveBorrowsMapperTests
{
    private readonly Mock<ITokenFactory> _tokenFactory;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly Mock<IProjectionCalculator> _projectionCalculator;
    private readonly AaveBorrowsMapper _mapper;

    public AaveBorrowsMapperTests()
    {
        _tokenFactory = new Mock<ITokenFactory>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _chainConfig = new Mock<IChainConfigurationService>();
        _projectionCalculator = new Mock<IProjectionCalculator>();
        _mapper = new AaveBorrowsMapper(_tokenFactory.Object, _protocolConfig.Object, _chainConfig.Object, _projectionCalculator.Object);

        SetupDefaultMocks();
    }

    private void SetupDefaultMocks()
    {
        var protocolDef = CreateMockProtocolDefinition();
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.AaveV3)).Returns(protocolDef);
        _protocolConfig.Setup(x => x.GetAllConfiguredChains(ProtocolNames.AaveV3))
            .Returns(new[] { Chain.Ethereum, Chain.Base });
        
        _chainConfig.Setup(x => x.GetChainConfig(It.IsAny<Chain>()))
            .Returns((Chain chain) => CreateMockChainConfig(chain));
        
        _tokenFactory.Setup(x => x.CreateBorrowed(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol, Financials = new TokenFinancials { BalanceFormatted = amt } });
    }

    private ChainConfig CreateMockChainConfig(Chain chain)
    {
        return new ChainConfig
        {
            DisplayName = chain.ToString(),
            ChainId = chain == Chain.Ethereum ? 1 : (chain == Chain.Base ? 8453 : 0),
            NativeCurrency = "ETH",
            Slug = chain.ToString().ToLowerInvariant(),
            IsEnabled = true
        };
    }

    private ProtocolDefinition CreateMockProtocolDefinition()
    {
        return new ProtocolDefinition
        {
            Key = ProtocolNames.AaveV3,
            DisplayName = "Aave V3",
            Website = "https://aave.com",
            Icon = "aave.svg",
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
            Data = new UserBorrowsData
            {
                UserBorrows = new List<UserBorrow>
                {
                    new UserBorrow
                    {
                        Currency = new AaveSupplyCurrency
                        {
                            Name = "USD Coin",
                            Symbol = "USDC",
                            Address = "0xusdc"
                        },
                        Debt = new AaveBorrowDebt
                        {
                            Amount = new AaveSupplyAmount { Value = "1000.50" },
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
            Data = new UserBorrowsData
            {
                UserBorrows = new List<UserBorrow>
                {
                    new UserBorrow
                    {
                        Currency = new AaveSupplyCurrency { Symbol = "USDC" },
                        Debt = new AaveBorrowDebt
                        {
                            Amount = new AaveSupplyAmount { Value = "invalid" },
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
            Data = new UserBorrowsData
            {
                UserBorrows = new List<UserBorrow>
                {
                    new UserBorrow
                    {
                        Currency = new AaveSupplyCurrency { Symbol = "USDC" },
                        Debt = new AaveBorrowDebt
                        {
                            Amount = new AaveSupplyAmount { Value = "0" },
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
