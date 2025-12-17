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
using DeFi10.API.Services.Protocols.Uniswap;
using DeFi10.API.Services.Protocols.Uniswap.Models;
using DeFi10.API.Services.Helpers;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace DeFi10.API.Tests.Services.Protocols.UniswapV3.Mappers;

public class UniswapV3MapperTests
{
    private readonly Mock<IUniswapV3OnChainService> _onChainService;
    private readonly Mock<ILogger<UniswapV3Mapper>> _logger;
    private readonly Mock<ITokenFactory> _tokenFactory;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly Mock<ITokenMetadataService> _metadataService;
    private readonly UniswapV3Mapper _mapper;

    public UniswapV3MapperTests()
    {
        _onChainService = new Mock<IUniswapV3OnChainService>();
        _logger = new Mock<ILogger<UniswapV3Mapper>>();
        _tokenFactory = new Mock<ITokenFactory>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _chainConfig = new Mock<IChainConfigurationService>();
        _metadataService = new Mock<ITokenMetadataService>();

        SetupDefaultMocks();
        _mapper = new UniswapV3Mapper(_onChainService.Object, _logger.Object, _tokenFactory.Object, _protocolConfig.Object, _chainConfig.Object, _metadataService.Object);
    }

    private void SetupDefaultMocks()
    {
        var protocolDef = CreateMockProtocolDefinition();
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.UniswapV3)).Returns(protocolDef);
        _protocolConfig.Setup(x => x.GetAllConfiguredChains(ProtocolNames.UniswapV3))
            .Returns(new[] { Chain.Ethereum, Chain.Base });
        
        _chainConfig.Setup(x => x.GetChainConfig(It.IsAny<Chain>()))
            .Returns((Chain chain) => CreateMockChainConfig(chain));
        
        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol, Type = TokenType.Supplied });
        
        _tokenFactory.Setup(x => x.CreateUncollectedReward(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol, Type = TokenType.LiquidityUncollectedFee });
    }

    private ChainConfig CreateMockChainConfig(Chain chain)
    {
        return new ChainConfig
        {
            DisplayName = chain.ToString(),
            ChainId = chain == Chain.Ethereum ? 1 : (chain == Chain.Base ? 8453 : (chain == Chain.Solana ? 0 : 0)),
            NativeCurrency = chain == Chain.Solana ? "SOL" : "ETH",
            Slug = chain.ToString().ToLowerInvariant(),
            IsEnabled = true
        };
    }

    private ProtocolDefinition CreateMockProtocolDefinition()
    {
        return new ProtocolDefinition
        {
            Key = ProtocolNames.UniswapV3,
            DisplayName = "Uniswap V3",
            Website = "https://uniswap.org",
            Icon = "uniswap.svg",
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
    public async Task MapAsync_WithValidPosition_CreatesWalletItem()
    {
        var response = new UniswapV3GetActivePoolsResponse
        {
            Data = new UniswapV3PositionsData
            {
                Positions = new List<UniswapV3Position>
                {
                    CreateValidPosition()
                },
                Bundles = new List<UniswapV3Bundle>
                {
                    new UniswapV3Bundle { NativePriceUSD = "2000" }
                }
            }
        };

        var result = await _mapper.MapAsync(response, Chain.Ethereum);

        Assert.Single(result);
        Assert.Equal(WalletItemType.LiquidityPool, result[0].Type);
        Assert.Equal("Liquidity Pool", result[0].Position.Label);
        Assert.Equal(4, result[0].Position.Tokens.Count); // 2 supplied + 2 rewards
    }

    [Fact]
    public async Task MapAsync_WithNullResponse_ReturnsEmptyList()
    {
        var result = await _mapper.MapAsync(null, Chain.Ethereum);

        Assert.Empty(result);
    }

    [Fact]
    public async Task MapAsync_WithUnsupportedChain_ThrowsNotSupportedException()
    {
        var protocolDefNoSolana = new ProtocolDefinition
        {
            Key = ProtocolNames.UniswapV3,
            DisplayName = "Uniswap V3",
            Website = "https://uniswap.org",
            Icon = "uniswap.svg",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Ethereum",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                }
            }
        };
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.UniswapV3)).Returns(protocolDefNoSolana);
        
        _chainConfig.Setup(x => x.GetChainConfig(Chain.Solana))
            .Returns(CreateMockChainConfig(Chain.Solana));

        var response = new UniswapV3GetActivePoolsResponse { Data = new UniswapV3PositionsData() };

        await Assert.ThrowsAsync<NotSupportedException>(() => _mapper.MapAsync(response, Chain.Solana));
    }

    [Fact]
    public async Task MapAsync_WithZeroNativePrice_LogsWarning()
    {
        var response = new UniswapV3GetActivePoolsResponse
        {
            Data = new UniswapV3PositionsData
            {
                Positions = new List<UniswapV3Position> { CreateValidPosition() },
                Bundles = new List<UniswapV3Bundle> { new UniswapV3Bundle { NativePriceUSD = "0" } }
            }
        };

        await _mapper.MapAsync(response, Chain.Ethereum);

        _logger.Verify(x => x.Log(
            LogLevel.Warning,
            It.IsAny<EventId>(),
            It.Is<It.IsAnyType>((v, t) => v.ToString().Contains("nativePriceUSD=0")),
            null,
            It.IsAny<Func<It.IsAnyType, Exception, string>>()), Times.Once);
    }

    private UniswapV3Position CreateValidPosition()
    {
        return new UniswapV3Position
        {
            Id = "1",
            Token0 = new UniswapV3Token
            {
                Id = "0xtoken0",
                Name = "Token0",
                Symbol = "TKN0",
                Decimals = "18",
                DerivedNative = "0.0005"
            },
            Token1 = new UniswapV3Token
            {
                Id = "0xtoken1",
                Name = "Token1",
                Symbol = "TKN1",
                Decimals = "18",
                DerivedNative = "0.001"
            },
            DepositedToken0 = "100",
            WithdrawnToken0 = "0",
            DepositedToken1 = "200",
            WithdrawnToken1 = "0",
            EstimatedUncollectedToken0 = "5",
            EstimatedUncollectedToken1 = "10",
            CurrentPriceToken1PerToken0 = "2",
            RangeStatus = "in-range"
        };
    }
}
