using DeFi10.API.Services.Mappers;
using DeFi10.API.Services.Models;
using DeFi10.API.Models;
using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using Moq;
using Xunit;

namespace DeFi10.API.Tests.Services.Mappers;

public class PendleVeMapperTests
{
    private readonly Mock<ITokenFactory> _tokenFactory;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly PendleVeMapper _mapper;

    public PendleVeMapperTests()
    {
        _tokenFactory = new Mock<ITokenFactory>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _chainConfig = new Mock<IChainConfigurationService>();

        SetupDefaultMocks();
        _mapper = new PendleVeMapper(_tokenFactory.Object, _protocolConfig.Object, _chainConfig.Object);
    }

    private void SetupDefaultMocks()
    {
        _protocolConfig.Setup(x => x.IsChainEnabledForProtocol(ProtocolNames.PendleV2, It.IsAny<Chain>())).Returns(true);
        _protocolConfig.Setup(x => x.GetEnabledChainEnums(ProtocolNames.PendleV2)).Returns(new[] { Chain.Ethereum });
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.PendleV2)).Returns(CreateMockProtocolDefinition());
        _protocolConfig.Setup(x => x.GetProtocolOnChain(ProtocolNames.PendleV2, It.IsAny<Chain>()))
            .Returns(new ProtocolChainResolved
            {
                Options = new Dictionary<string, string> { { "pendleToken", "0xpendle" } }
            });

        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns(new Token { Symbol = "PENDLE" });
        _tokenFactory.Setup(x => x.CreateGovernancePower(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>()))
            .Returns(new Token { Symbol = "vePENDLE" });
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
    public async Task MapAsync_WithValidLock_CreatesWalletItem()
    {
        var response = new PendleVePositionsResponse
        {
            Data = new PendleVeData
            {
                Locks = new List<PendleLock>
                {
                    new PendleLock
                    {
                        LockId = 1,
                        AmountFormatted = "100.5",
                        VeBalance = "200.5",
                        UnlockTime = 1735689600
                    }
                }
            }
        };

        var result = await _mapper.MapAsync(response, Chain.Ethereum);

        Assert.Single(result);
        Assert.Equal(WalletItemType.Locking, result[0].Type);
        Assert.Equal("vePENDLE Lock", result[0].Position.Label);
        Assert.Equal(2, result[0].Position.Tokens.Count);
        Assert.Equal(1735689600L, result[0].AdditionalData.UnlockAt);
    }

    [Fact]
    public async Task MapAsync_WithNullData_ReturnsEmptyList()
    {
        var response = new PendleVePositionsResponse { Data = null };

        var result = await _mapper.MapAsync(response, Chain.Ethereum);

        Assert.Empty(result);
    }

    [Fact]
    public async Task MapAsync_WithMissingPendleTokenConfig_ThrowsInvalidOperationException()
    {
        _protocolConfig.Setup(x => x.GetProtocolOnChain(ProtocolNames.PendleV2, It.IsAny<Chain>()))
            .Returns(new ProtocolChainResolved { Options = new Dictionary<string, string>() });

        var response = new PendleVePositionsResponse
        {
            Data = new PendleVeData { Locks = new List<PendleLock> { new PendleLock() } }
        };

        await Assert.ThrowsAsync<InvalidOperationException>(() => _mapper.MapAsync(response, Chain.Ethereum));
    }
}
