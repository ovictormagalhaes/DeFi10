using DeFi10.API.Aggregation;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Infrastructure.CoinMarketCap;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Tests.Aggregation;

public class PriceServiceTests
{
    private readonly Mock<ICacheService> _mockCache;
    private readonly Mock<ICoinMarketCapService> _mockCmc;
    private readonly Mock<ILogger<PriceService>> _mockLogger;
    private readonly PriceService _sut;

    public PriceServiceTests()
    {
        _mockCache = new Mock<ICacheService>();
        _mockCmc = new Mock<ICoinMarketCapService>();
        _mockLogger = new Mock<ILogger<PriceService>>();
        _sut = new PriceService(_mockCache.Object, _mockCmc.Object, _mockLogger.Object);
    }

    [Fact]
    public async Task HydratePricesAsync_WithNullInput_ReturnsEmptyDictionary()
    {
        // Act
        var result = await _sut.HydratePricesAsync(null!, ChainEnum.Ethereum);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task HydratePricesAsync_WithEmptyInput_ReturnsEmptyDictionary()
    {
        // Act
        var result = await _sut.HydratePricesAsync(new List<DeFi10.API.Models.WalletItem>(), ChainEnum.Ethereum);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task HydratePricesAsync_WithTokensAlreadyPriced_ReturnsExistingPrices()
    {
        // Arrange
        var walletItems = new List<DeFi10.API.Models.WalletItem>
        {
            new()
            {
                Position = new DeFi10.API.Models.Position
                {
                    Tokens = new List<DeFi10.API.Models.Token>
                    {
                        new()
                        {
                            Symbol = "ETH",
                            ContractAddress = "0x123",
                            Financials = new DeFi10.API.Models.TokenFinancials
                            {
                                Price = 2000m,
                                Amount = 1_000_000_000_000_000_000m // 1 ETH in wei
                            },
                            PossibleSpam = false
                        }
                    }
                }
            }
        };

        // Act
        var result = await _sut.HydratePricesAsync(walletItems, ChainEnum.Ethereum);

        // Assert
        Assert.Single(result);
        var key = result.Keys.First();
        Assert.StartsWith("eth|", key); // Key format is "symbol|chain"
        Assert.Equal(2000m, result[key]);
    }

    [Fact]
    public async Task HydratePricesAsync_SkipsSpamTokens()
    {
        // Arrange
        var walletItems = new List<DeFi10.API.Models.WalletItem>
        {
            new()
            {
                Position = new DeFi10.API.Models.Position
                {
                    Tokens = new List<DeFi10.API.Models.Token>
                    {
                        new()
                        {
                            Symbol = "SCAM",
                            ContractAddress = "0xscam",
                            Financials = new DeFi10.API.Models.TokenFinancials
                            {
                                Amount = 1000000m
                            },
                            PossibleSpam = true
                        }
                    }
                }
            }
        };

        // Act
        var result = await _sut.HydratePricesAsync(walletItems, ChainEnum.Ethereum);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task HydratePricesAsync_SkipsTokensWithZeroAmount()
    {
        // Arrange
        var walletItems = new List<DeFi10.API.Models.WalletItem>
        {
            new()
            {
                Position = new DeFi10.API.Models.Position
                {
                    Tokens = new List<DeFi10.API.Models.Token>
                    {
                        new()
                        {
                            Symbol = "ZERO",
                            ContractAddress = "0xzero",
                            Financials = new DeFi10.API.Models.TokenFinancials
                            {
                                Amount = 0m
                            },
                            PossibleSpam = false
                        }
                    }
                }
            }
        };

        // Act
        var result = await _sut.HydratePricesAsync(walletItems, ChainEnum.Ethereum);

        // Assert
        Assert.Empty(result);
    }
}
