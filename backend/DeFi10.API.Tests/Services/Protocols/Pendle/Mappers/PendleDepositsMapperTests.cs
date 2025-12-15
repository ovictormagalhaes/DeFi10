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
using DeFi10.API.Services.Protocols.Pendle;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using DeFi10.API.Services.Protocols.Pendle.Models;

namespace DeFi10.API.Tests.Services.Protocols.Pendle.Mappers;

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
        var protocolDef = CreateMockProtocolDefinition();
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.PendleV2)).Returns(protocolDef);
        _protocolConfig.Setup(x => x.GetAllConfiguredChains(ProtocolNames.PendleV2))
            .Returns(new[] { Chain.Ethereum });
        
        _chainConfig.Setup(x => x.GetChainConfig(It.IsAny<Chain>()))
            .Returns((Chain chain) => CreateMockChainConfig(chain));
        
        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol });
    }

    private ChainConfig CreateMockChainConfig(Chain chain)
    {
        return new ChainConfig
        {
            DisplayName = chain.ToString(),
            ChainId = chain == Chain.Ethereum ? 1 : 0,
            NativeCurrency = "ETH",
            Slug = chain.ToString().ToLowerInvariant(),
            IsEnabled = true
        };
    }

    private ProtocolDefinition CreateMockProtocolDefinition()
    {
        return new ProtocolDefinition
        {
            Key = ProtocolNames.PendleV2,
            DisplayName = "Pendle V2",
            Website = "https://pendle.finance",
            Icon = "pendle.svg",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = new Dictionary<string, string>
                    {
                        { "Enabled", "true" }
                    }
                }
            }
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
