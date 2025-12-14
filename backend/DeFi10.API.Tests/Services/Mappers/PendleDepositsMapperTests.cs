using DeFi10.API.Services.Mappers;
using DeFi10.API.Services.Models;
using DeFi10.API.Models;
using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace DeFi10.API.Tests.Services.Mappers;

public class PendleDepositsMapperTests
{
    private readonly Mock<ILogger<PendleDepositsMapper>> _logger;
    private readonly Mock<ITokenFactory> _tokenFactory;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly PendleDepositsMapper _mapper;

    public PendleDepositsMapperTests()
    {
        _logger = new Mock<ILogger<PendleDepositsMapper>>();
        _tokenFactory = new Mock<ITokenFactory>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _chainConfig = new Mock<IChainConfigurationService>();

        SetupDefaultMocks();
        _mapper = new PendleDepositsMapper(_logger.Object, _tokenFactory.Object, _protocolConfig.Object, _chainConfig.Object);
    }

    private void SetupDefaultMocks()
    {
        _protocolConfig.Setup(x => x.GetEnabledChainEnums(ProtocolNames.PendleV2)).Returns(new[] { Chain.Ethereum });
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.PendleV2)).Returns(CreateMockProtocolDefinition());
        
        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol });
    }

    private ProtocolDefinition CreateMockProtocolDefinition()
    {
        return new ProtocolDefinition
        {
            Key = ProtocolNames.PendleV2,
            DisplayName = "Pendle V2",
            Website = "https://pendle.finance",
            Icon = "pendle.svg"
        };
    }

    [Fact]
    public async Task MapAsync_WithValidDeposit_CreatesWalletItem()
    {
        var response = new PendleDepositsResponse
        {
            Data = new PendleDepositsData
            {
                Deposits = new List<PendleDepositItem>
                {
                    new PendleDepositItem
                    {
                        MarketSymbol = "PT-stETH",
                        UnderlyingSymbol = "stETH",
                        PtAddress = "0xpt",
                        PtDecimals = 18,
                        AmountFormatted = 10.5m,
                        MaturityUnix = 1735689600
                    }
                }
            }
        };

        var result = await _mapper.MapAsync(response, Chain.Ethereum);

        Assert.Single(result);
        Assert.Equal(WalletItemType.Depositing, result[0].Type);
        Assert.Equal("Deposit", result[0].Position.Label);
        Assert.Single(result[0].Position.Tokens);
        Assert.Equal(1735689600L, result[0].AdditionalData.UnlockAt);
    }

    [Fact]
    public async Task MapAsync_WithNullResponse_ReturnsEmptyList()
    {
        var result = await _mapper.MapAsync(null, Chain.Ethereum);

        Assert.Empty(result);
    }

    [Fact]
    public async Task MapAsync_WithNullData_ReturnsEmptyList()
    {
        var response = new PendleDepositsResponse { Data = null };

        var result = await _mapper.MapAsync(response, Chain.Ethereum);

        Assert.Empty(result);
    }

    [Fact]
    public async Task MapAsync_WithNullDeposits_ReturnsEmptyList()
    {
        var response = new PendleDepositsResponse
        {
            Data = new PendleDepositsData { Deposits = null }
        };

        var result = await _mapper.MapAsync(response, Chain.Ethereum);

        Assert.Empty(result);
    }
}
