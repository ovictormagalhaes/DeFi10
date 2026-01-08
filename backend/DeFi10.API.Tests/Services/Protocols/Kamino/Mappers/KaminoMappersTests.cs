using DeFi10.API.Services.Protocols.Kamino.Models;
using DeFi10.API.Models;
using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Helpers;
using DeFi10.API.Services.Protocols.Kamino;
using Microsoft.Extensions.Logging;
using Moq;
using DeFi10.API.Services.Core.Solana;
using DeFi10.API.Services.Protocols.Kamino.Mappers;

namespace DeFi10.API.Tests.Services.Protocols.Kamino.Mappers;

public class SolanaKaminoMapperTests
{
    private readonly Mock<ITokenFactory> _tokenFactory;
    private readonly Mock<ILogger<KaminoMapper>> _logger;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly Mock<IProjectionCalculator> _projectionCalculator;
    private readonly KaminoMapper _mapper;

    public SolanaKaminoMapperTests()
    {
        _tokenFactory = new Mock<ITokenFactory>();
        _logger = new Mock<ILogger<KaminoMapper>>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _chainConfig = new Mock<IChainConfigurationService>();
        _projectionCalculator = new Mock<IProjectionCalculator>();

        SetupDefaultMocks();
        _mapper = new KaminoMapper(_tokenFactory.Object, _logger.Object, _protocolConfig.Object, _chainConfig.Object, _projectionCalculator.Object);
    }

    private void SetupDefaultMocks()
    {
        var protocolDef = CreateMockProtocolDefinition();
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.Kamino)).Returns(protocolDef);
        _protocolConfig.Setup(x => x.GetAllConfiguredChains(ProtocolNames.Kamino))
            .Returns(new[] { Chain.Solana });
        
        _chainConfig.Setup(x => x.GetChainConfig(It.IsAny<Chain>()))
            .Returns((Chain chain) => CreateMockChainConfig(chain));
        
        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token 
                { 
                    Symbol = symbol, 
                    Type = TokenType.Supplied,
                    Financials = new TokenFinancials 
                    { 
                        TotalPrice = amt * price,
                        BalanceFormatted = amt
                    }
                });
        
        _tokenFactory.Setup(x => x.CreateBorrowed(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token 
                { 
                    Symbol = symbol, 
                    Type = TokenType.Borrowed,
                    Financials = new TokenFinancials 
                    { 
                        TotalPrice = amt * price,
                        BalanceFormatted = amt
                    }
                });

        // Mock reserves data
        var mockReserves = new KaminoReservesResponseDto
        {
            Reserves = new List<KaminoReserveDto>
            {
                new KaminoReserveDto
                {
                    MintAddress = "usdc-mint",
                    Symbol = "USDC",
                    SupplyApyString = "0.055",
                    BorrowApyString = "0.08"
                },
                new KaminoReserveDto
                {
                    MintAddress = "sol-mint",
                    Symbol = "SOL",
                    SupplyApyString = "0.042",
                    BorrowApyString = "0.075"
                }
            }
        };

        // Mock projection calculator
        _projectionCalculator.Setup(x => x.CalculateApyProjection(It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((decimal balance, decimal apy) => new Projection
            {
                OneDay = balance * 0.01m,
                OneWeek = balance * 0.07m,
                OneMonth = balance * 0.30m,
                OneYear = balance * 3.65m
            });
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
            Key = ProtocolNames.Kamino,
            DisplayName = "Kamino",
            Website = "https://kamino.finance",
            Icon = "kamino.svg",
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
                        Mint = "",  // Empty mint - no reserves lookup
                        Type = TokenType.Supplied,
                        Amount = 1000m,
                        Decimals = 6,
                        PriceUsd = 1.0m
                    },
                    new SplToken
                    {
                        Symbol = "SOL",
                        Mint = "",  // Empty mint - no reserves lookup
                        Type = TokenType.Borrowed,
                        Amount = 10m,
                        Decimals = 9,
                        PriceUsd = 100m
                    }
                }
            }
        };

        var result = await _mapper.MapAsync(positions, Chain.Solana);

        Assert.Equal(WalletItemType.LendingAndBorrowing, result[0].Type);
        Assert.Equal(1.5m, result[0].AdditionalData.HealthFactor);
        Assert.Null(result[0].AdditionalData.Apy);
        Assert.Null(result[0].AdditionalData.Projections);
    }

    [Fact]
    public async Task MapAsync_WithNullInput_ReturnsEmptyList()
    {
        var result = await _mapper.MapAsync(null, Chain.Solana);

        Assert.Empty(result);
    }

    [Fact]
    public async Task MapAsync_WithValidReserves_CalculatesNetApyAndProjection()
    {
        var positions = new List<KaminoPosition>
        {
            new KaminoPosition
            {
                Id = "pos1",
                Market = "Main Market",
                HealthFactor = 2.0m,
                Tokens = new List<SplToken>
                {
                    new SplToken
                    {
                        Symbol = "USDC",
                        Mint = "usdc-mint",  // Matches mock reserve
                        Type = TokenType.Supplied,
                        Amount = 1000m,
                        Decimals = 6,
                        PriceUsd = 1.0m,
                        Apy = 0.05m,
                    },
                    new SplToken
                    {
                        Symbol = "SOL",
                        Mint = "sol-mint",  // Matches mock reserve
                        Type = TokenType.Borrowed,
                        Amount = 5m,
                        Decimals = 9,
                        PriceUsd = 100m,
                        Apy = 0.05m,
                    }
                }
            }
        };

        var result = await _mapper.MapAsync(positions, Chain.Solana);

        Assert.NotNull(result[0].AdditionalData.Apy);
        Assert.NotNull(result[0].AdditionalData.Projections);
        Assert.Single(result[0].AdditionalData.Projections);
        Assert.Equal(ProjectionType.Apy, result[0].AdditionalData.Projections[0].Type);
        
        Assert.True(result[0].AdditionalData.Apy > 0);
    }
}
