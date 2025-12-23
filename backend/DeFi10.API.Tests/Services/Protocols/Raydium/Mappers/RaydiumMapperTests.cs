using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Protocols.Aave.Mappers;
using DeFi10.API.Services.Protocols.Pendle.Mappers;
using DeFi10.API.Services.Protocols.Uniswap.Mappers;
using DeFi10.API.Services.Infrastructure.Moralis.Mappers;
using DeFi10.API.Services.Protocols.Kamino.Models;
using DeFi10.API.Services.Protocols.Raydium.Models;
using DeFi10.API.Models;
using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using DeFi10.API.Services.Helpers;
using DeFi10.API.Services.Domain;
using DeFi10.API.Services.Core.Solana;
using DeFi10.API.Services.Protocols.Raydium.Mappers;

namespace DeFi10.API.Tests.Services.Protocols.Raydium.Mappers;

public class RaydiumMapperTests
{
    private readonly Mock<ITokenFactory> _tokenFactory;
    private readonly Mock<ILogger<RaydiumMapper>> _logger;
    private readonly Mock<ITokenMetadataService> _metadataService;
    private readonly Mock<ILogger<WalletItemLabelEnricher>> _enricherLogger;
    private readonly WalletItemLabelEnricher _labelEnricher;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly Mock<IProjectionCalculator> _projectionCalculator;
    private readonly RaydiumMapper _mapper;

    public RaydiumMapperTests()
    {
        _tokenFactory = new Mock<ITokenFactory>();
        _logger = new Mock<ILogger<RaydiumMapper>>();
        _metadataService = new Mock<ITokenMetadataService>();
        _enricherLogger = new Mock<ILogger<WalletItemLabelEnricher>>();
        _labelEnricher = new WalletItemLabelEnricher(_enricherLogger.Object);
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _chainConfig = new Mock<IChainConfigurationService>();
        _projectionCalculator = new Mock<IProjectionCalculator>();

        SetupDefaultMocks();
        _mapper = new RaydiumMapper(_tokenFactory.Object, _logger.Object, _metadataService.Object, 
            _labelEnricher, _protocolConfig.Object, _chainConfig.Object, _projectionCalculator.Object);
    }

    private void SetupDefaultMocks()
    {
        var protocolDef = CreateMockProtocolDefinition();
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.Raydium)).Returns(protocolDef);
        _protocolConfig.Setup(x => x.GetAllConfiguredChains(ProtocolNames.Raydium))
            .Returns(new[] { Chain.Solana });
        
        _chainConfig.Setup(x => x.GetChainConfig(It.IsAny<Chain>()))
            .Returns((Chain chain) => CreateMockChainConfig(chain));
        
        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol, Type = TokenType.Supplied });
    }

    private ChainConfig CreateMockChainConfig(Chain chain)
    {
        return new ChainConfig
        {
            DisplayName = chain.ToString(),
            ChainId = 0,
            NativeCurrency = "SOL",
            Slug = chain.ToString().ToLowerInvariant(),
            IsEnabled = true
        };
    }

    private ProtocolDefinition CreateMockProtocolDefinition()
    {
        return new ProtocolDefinition
        {
            Key = ProtocolNames.Raydium,
            DisplayName = "Raydium",
            Website = "https://raydium.io",
            Icon = "raydium.svg",
            ChainSupports = new List<ProtocolChainSupport>
            {
                new ProtocolChainSupport
                {
                    Chain = "Solana",
                    Options = new Dictionary<string, string> { { "Enabled", "true" } }
                }
            }
        };
    }

    [Fact]
    public async Task MapAsync_WithValidPosition_CreatesWalletItem()
    {
        var positions = new List<RaydiumPosition>
        {
            new RaydiumPosition
            {
                Pool = "SOL-USDC",
                Tokens = new List<SplToken>
                {
                    new SplToken
                    {
                        Symbol = "SOL",
                        Type = TokenType.Supplied,
                        Amount = 10m,
                        Decimals = 9,
                        PriceUsd = 100m
                    }
                }
            }
        };

        var result = await _mapper.MapAsync(positions, Chain.Solana);

        Assert.Single(result);
        Assert.Equal(WalletItemType.LiquidityPool, result[0].Type);
    }

    [Fact]
    public async Task MapAsync_WithNullInput_ReturnsEmptyList()
    {
        var result = await _mapper.MapAsync(null, Chain.Solana);

        Assert.Empty(result);
    }

    [Fact]
    public async Task MapAsync_WithEmptyPositions_ReturnsEmptyList()
    {
        var result = await _mapper.MapAsync(new List<RaydiumPosition>(), Chain.Solana);

        Assert.Empty(result);
    }
}

