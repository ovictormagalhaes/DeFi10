using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Protocols.Aave.Mappers;
using DeFi10.API.Services.Protocols.Pendle.Mappers;
using DeFi10.API.Services.Protocols.Uniswap.Mappers;
using DeFi10.API.Services.Infrastructure.Moralis.Mappers;
using DeFi10.API.Services.Helpers.Mappers;
using DeFi10.API.Services.Protocols.Aave.Models.Supplies;
using DeFi10.API.Models;
using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Protocols.Aave;
using DeFi10.API.Services.Helpers;
using Moq;
using Xunit;

namespace DeFi10.API.Tests.Services.Protocols.Aave.Mappers;

public class AaveSuppliesMapperTests
{
    private readonly Mock<ITokenFactory> _tokenFactory;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly Mock<IProjectionCalculator> _projectionCalculator;
    private readonly AaveSuppliesMapper _mapper;

    public AaveSuppliesMapperTests()
    {
        _tokenFactory = new Mock<ITokenFactory>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _chainConfig = new Mock<IChainConfigurationService>();
        _projectionCalculator = new Mock<IProjectionCalculator>();
        _mapper = new AaveSuppliesMapper(_tokenFactory.Object, _protocolConfig.Object, _chainConfig.Object, _projectionCalculator.Object);

        SetupDefaultMocks();
    }

    private void SetupDefaultMocks()
    {
        var protocolDef = CreateMockProtocolDefinition();
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.AaveV3)).Returns(protocolDef);
        _protocolConfig.Setup(x => x.GetAllConfiguredChains(ProtocolNames.AaveV3))
            .Returns(new[] { Chain.Ethereum });
        
        _chainConfig.Setup(x => x.GetChainConfig(It.IsAny<Chain>()))
            .Returns((Chain chain) => CreateMockChainConfig(chain));
        
        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol, Financials = new TokenFinancials { BalanceFormatted = amt } });
    }

    private ChainConfig CreateMockChainConfig(Chain chain)
    {
        return new ChainConfig
        {
            DisplayName = chain.ToString(),
            ChainId = chain == Chain.Ethereum ? 1 : (chain == Chain.Solana ? 0 : 0),
            NativeCurrency = chain == Chain.Solana ? "SOL" : "ETH",
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
                }
            }
        };
    }

    [Fact]
    public async Task MapAsync_WithValidSupply_CreatesWalletItem()
    {
        var response = new AaveGetUserSuppliesResponse
        {
            Data = new UserSuppliesData
            {
                UserSupplies = new List<UserSupply>
                {
                    new UserSupply
                    {
                        Currency = new AaveSupplyCurrency
                        {
                            Name = "USD Coin",
                            Symbol = "USDC",
                            Address = "0xusdc"
                        },
                        Balance = new AaveSupplyBalance
                        {
                            Amount = new AaveSupplyAmount { Value = "5000.25" },
                            Usd = "5000.25"
                        },
                        IsCollateral = true,
                        CanBeCollateral = true
                    }
                }
            }
        };

        var result = await _mapper.MapAsync(response, Chain.Ethereum);

        Assert.Single(result);
        Assert.Equal(WalletItemType.LendingAndBorrowing, result[0].Type);
        Assert.Equal("Supplied", result[0].Position.Label);
        Assert.True(result[0].AdditionalData.IsCollateral);
        Assert.True(result[0].AdditionalData.CanBeCollateral);
    }

    [Fact]
    public async Task MapAsync_WithNullData_ReturnsEmptyList()
    {
        var response = new AaveGetUserSuppliesResponse { Data = null };

        var result = await _mapper.MapAsync(response, Chain.Ethereum);

        Assert.Empty(result);
    }

    [Fact]
    public async Task MapAsync_WithUnsupportedChain_ReturnsEmptyList()
    {
        var protocolDefSolana = new ProtocolDefinition
        {
            Key = ProtocolNames.AaveV3,
            DisplayName = "Aave V3",
            Website = "https://aave.com",
            Icon = "aave.svg",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Solana",
                    Options = new Dictionary<string, string> { { "Enabled", "false" } }
                }
            }
        };
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.AaveV3)).Returns(protocolDefSolana);
        
        _chainConfig.Setup(x => x.GetChainConfig(Chain.Solana))
            .Returns(CreateMockChainConfig(Chain.Solana));

        var response = new AaveGetUserSuppliesResponse
        {
            Data = new UserSuppliesData { UserSupplies = new List<UserSupply>() }
        };

        var result = await _mapper.MapAsync(response, Chain.Solana);

        Assert.Empty(result);
    }
}
