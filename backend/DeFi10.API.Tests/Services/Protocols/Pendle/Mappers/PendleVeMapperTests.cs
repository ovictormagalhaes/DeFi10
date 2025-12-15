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
using Moq;
using Xunit;
using DeFi10.API.Services.Protocols.Pendle.Models;

namespace DeFi10.API.Tests.Services.Protocols.Pendle.Mappers;

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
        var protocolDef = CreateMockProtocolDefinition();
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.PendleV2)).Returns(protocolDef);
        _protocolConfig.Setup(x => x.GetAllConfiguredChains(ProtocolNames.PendleV2))
            .Returns(new[] { Chain.Ethereum });
        _protocolConfig.Setup(x => x.GetProtocolOnChain(ProtocolNames.PendleV2, It.IsAny<Chain>()))
            .Returns(new ProtocolChainResolved(
                ProtocolNames.PendleV2, 
                Chain.Ethereum, 
                new Dictionary<string, string> { { "pendleToken", "0xpendle" }, { "Enabled", "true" } }
            ));

        _chainConfig.Setup(x => x.GetChainConfig(It.IsAny<Chain>()))
            .Returns((Chain chain) => CreateMockChainConfig(chain));

        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns(new Token { Symbol = "PENDLE" });
        _tokenFactory.Setup(x => x.CreateGovernancePower(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>()))
            .Returns(new Token { Symbol = "vePENDLE" });
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
    public async Task MapAsync_WithValidLock_CreatesWalletItem()
    {
        var response = new PendleVePositionsResponse
        {
            Data = new PendleVeData
            {
                Locks = new List<PendleVeLock>
                {
                    new PendleVeLock
                    {
                        LockId = "1",
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
            .Returns(new ProtocolChainResolved(
                ProtocolNames.PendleV2, 
                Chain.Ethereum, 
                new Dictionary<string, string>()
            ));

        var response = new PendleVePositionsResponse
        {
            Data = new PendleVeData { Locks = new List<PendleVeLock> { new PendleVeLock() } }
        };

        await Assert.ThrowsAsync<InvalidOperationException>(() => _mapper.MapAsync(response, Chain.Ethereum));
    }
}
