using DeFi10.API.Services.Mappers;
using DeFi10.API.Services.Models.Solana.Common;
using DeFi10.API.Services.Models.Solana.Kamino;
using DeFi10.API.Services.Models.Solana.Raydium;
using DeFi10.API.Models;
using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Solana;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace DeFi10.API.Tests.Services.Mappers;

public class SolanaTokenMapperTests
{
    private readonly Mock<ITokenFactory> _tokenFactory;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly SolanaTokenMapper _mapper;

    public SolanaTokenMapperTests()
    {
        _tokenFactory = new Mock<ITokenFactory>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _chainConfig = new Mock<IChainConfigurationService>();

        SetupDefaultMocks();
        _mapper = new SolanaTokenMapper(_tokenFactory.Object, _protocolConfig.Object, _chainConfig.Object);
    }

    private void SetupDefaultMocks()
    {
        _protocolConfig.Setup(x => x.GetEnabledChainEnums(ProtocolNames.SolanaWallet)).Returns(new[] { Chain.Solana });
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.SolanaWallet)).Returns(CreateMockProtocolDefinition());
        
        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol, Logo = "" });
    }

    private ProtocolDefinition CreateMockProtocolDefinition()
    {
        return new ProtocolDefinition
        {
            Key = ProtocolNames.SolanaWallet,
            DisplayName = "Solana Wallet",
            Website = "https://solana.com",
            Icon = "solana.svg"
        };
    }

    [Fact]
    public async Task MapAsync_WithValidTokens_CreatesWalletItem()
    {
        var response = new SolanaTokenResponse
        {
            Tokens = new List<SplToken>
            {
                new SplToken
                {
                    Name = "USD Coin",
                    Symbol = "USDC",
                    Mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                    Decimals = 6,
                    Amount = 1000.50m,
                    PriceUsd = 1.0m,
                    Logo = "usdc.png"
                }
            }
        };

        var result = await _mapper.MapAsync(response, Chain.Solana);

        Assert.Single(result);
        Assert.Equal(WalletItemType.Wallet, result[0].Type);
        Assert.Single(result[0].Position.Tokens);
        Assert.Equal("USDC", result[0].Position.Tokens[0].Symbol);
    }

    [Fact]
    public async Task MapAsync_WithNullResponse_ReturnsEmptyList()
    {
        var result = await _mapper.MapAsync(null, Chain.Solana);

        Assert.Empty(result);
    }

    [Fact]
    public async Task MapAsync_WithEmptyTokens_ReturnsEmptyList()
    {
        var response = new SolanaTokenResponse { Tokens = new List<SplToken>() };

        var result = await _mapper.MapAsync(response, Chain.Solana);

        Assert.Empty(result);
    }
}

public class SolanaKaminoMapperTests
{
    private readonly Mock<ITokenFactory> _tokenFactory;
    private readonly Mock<ILogger<SolanaKaminoMapper>> _logger;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly SolanaKaminoMapper _mapper;

    public SolanaKaminoMapperTests()
    {
        _tokenFactory = new Mock<ITokenFactory>();
        _logger = new Mock<ILogger<SolanaKaminoMapper>>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _chainConfig = new Mock<IChainConfigurationService>();

        SetupDefaultMocks();
        _mapper = new SolanaKaminoMapper(_tokenFactory.Object, _logger.Object, _protocolConfig.Object, _chainConfig.Object);
    }

    private void SetupDefaultMocks()
    {
        _protocolConfig.Setup(x => x.GetEnabledChainEnums(ProtocolNames.Kamino)).Returns(new[] { Chain.Solana });
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.Kamino)).Returns(CreateMockProtocolDefinition());
        
        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol, Type = TokenType.Supplied });
        
        _tokenFactory.Setup(x => x.CreateBorrowed(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol, Type = TokenType.Borrowed });
    }

    private ProtocolDefinition CreateMockProtocolDefinition()
    {
        return new ProtocolDefinition
        {
            Key = ProtocolNames.Kamino,
            DisplayName = "Kamino",
            Website = "https://kamino.finance",
            Icon = "kamino.svg"
        };
    }

    [Fact]
    public async Task MapAsync_WithSuppliedAndBorrowed_CreatesWalletItem()
    {
        var positions = new List<KaminoPosition>
        {
            new KaminoPosition
            {
                Id = "pos1",
                Market = "Main Market",
                HealthFactor = 1.5m,
                Tokens = new List<SplToken>
                {
                    new SplToken
                    {
                        Symbol = "USDC",
                        Type = TokenType.Supplied,
                        Amount = 1000m,
                        Decimals = 6,
                        PriceUsd = 1.0m
                    },
                    new SplToken
                    {
                        Symbol = "SOL",
                        Type = TokenType.Borrowed,
                        Amount = 10m,
                        Decimals = 9,
                        PriceUsd = 100m
                    }
                }
            }
        };

        var result = await _mapper.MapAsync(positions, Chain.Solana);

        Assert.Single(result);
        Assert.Equal(WalletItemType.LendingAndBorrowing, result[0].Type);
        Assert.Equal(2, result[0].Position.Tokens.Count);
        Assert.Equal(1.5m, result[0].AdditionalData.HealthFactor);
    }

    [Fact]
    public async Task MapAsync_WithNullInput_ReturnsEmptyList()
    {
        var result = await _mapper.MapAsync(null, Chain.Solana);

        Assert.Empty(result);
    }
}

public class SolanaRaydiumMapperTests
{
    private readonly Mock<ITokenFactory> _tokenFactory;
    private readonly Mock<ILogger<SolanaRaydiumMapper>> _logger;
    private readonly Mock<ITokenMetadataService> _metadataService;
    private readonly Mock<WalletItemLabelEnricher> _labelEnricher;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly SolanaRaydiumMapper _mapper;

    public SolanaRaydiumMapperTests()
    {
        _tokenFactory = new Mock<ITokenFactory>();
        _logger = new Mock<ILogger<SolanaRaydiumMapper>>();
        _metadataService = new Mock<ITokenMetadataService>();
        _labelEnricher = new Mock<WalletItemLabelEnricher>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _chainConfig = new Mock<IChainConfigurationService>();

        SetupDefaultMocks();
        _mapper = new SolanaRaydiumMapper(_tokenFactory.Object, _logger.Object, _metadataService.Object, 
            _labelEnricher.Object, _protocolConfig.Object, _chainConfig.Object);
    }

    private void SetupDefaultMocks()
    {
        _protocolConfig.Setup(x => x.GetEnabledChainEnums(ProtocolNames.Raydium)).Returns(new[] { Chain.Solana });
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.Raydium)).Returns(CreateMockProtocolDefinition());
        
        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol, Type = TokenType.Supplied });
        
        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol, Type = TokenType.Supplied });
    }

    private ProtocolDefinition CreateMockProtocolDefinition()
    {
        return new ProtocolDefinition
        {
            Key = ProtocolNames.Raydium,
            DisplayName = "Raydium",
            Website = "https://raydium.io",
            Icon = "raydium.svg"
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
