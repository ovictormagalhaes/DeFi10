using DeFi10.API.Services.Mappers;
using DeFi10.API.Services.Models.Aave.Supplies;
using DeFi10.API.Models;
using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using Moq;
using Xunit;

namespace DeFi10.API.Tests.Services.Mappers;

public class AaveSuppliesMapperTests
{
    private readonly Mock<ITokenFactory> _tokenFactory;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly AaveSuppliesMapper _mapper;

    public AaveSuppliesMapperTests()
    {
        _tokenFactory = new Mock<ITokenFactory>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _chainConfig = new Mock<IChainConfigurationService>();
        _mapper = new AaveSuppliesMapper(_tokenFactory.Object, _protocolConfig.Object, _chainConfig.Object);

        SetupDefaultMocks();
    }

    private void SetupDefaultMocks()
    {
        _protocolConfig.Setup(x => x.IsChainEnabledForProtocol(ProtocolNames.AaveV3, It.IsAny<Chain>())).Returns(true);
        _protocolConfig.Setup(x => x.GetEnabledChainEnums(ProtocolNames.AaveV3)).Returns(new[] { Chain.Ethereum });
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.AaveV3)).Returns(CreateMockProtocolDefinition());
        
        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
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
    public async Task MapAsync_WithValidSupply_CreatesWalletItem()
    {
        var response = new AaveGetUserSuppliesResponse
        {
            Data = new AaveUserSuppliesData
            {
                UserSupplies = new List<AaveUserSupply>
                {
                    new AaveUserSupply
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
        _protocolConfig.Setup(x => x.IsChainEnabledForProtocol(ProtocolNames.AaveV3, Chain.Solana)).Returns(false);

        var response = new AaveGetUserSuppliesResponse
        {
            Data = new AaveUserSuppliesData { UserSupplies = new List<AaveUserSupply>() }
        };

        var result = await _mapper.MapAsync(response, Chain.Solana);

        Assert.Empty(result);
    }
}
