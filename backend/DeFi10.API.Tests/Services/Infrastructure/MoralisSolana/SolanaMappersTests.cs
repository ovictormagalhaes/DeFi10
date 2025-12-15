using DeFi10.API.Models;
using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Configuration;
using Moq;
using DeFi10.API.Services.Infrastructure.MoralisSolana.Mappers;
using DeFi10.API.Services.Infrastructure.MoralisSolana.Models;
using DeFi10.API.Services.Core.Solana;

namespace DeFi10.API.Tests.Services.Infrastructure.MoralisSolana;

public class MoralisSolanaMapperTests
{
    private readonly Mock<ITokenFactory> _tokenFactory;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly MoralisSolanaMapper _mapper;

    public MoralisSolanaMapperTests()
    {
        _tokenFactory = new Mock<ITokenFactory>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _chainConfig = new Mock<IChainConfigurationService>();

        SetupDefaultMocks();
        _mapper = new MoralisSolanaMapper(_tokenFactory.Object, _protocolConfig.Object, _chainConfig.Object);
    }

    private void SetupDefaultMocks()
    {
        var protocolDef = CreateMockProtocolDefinition();
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.SolanaWallet)).Returns(protocolDef);
        _protocolConfig.Setup(x => x.GetAllConfiguredChains(ProtocolNames.SolanaWallet))
            .Returns(new[] { Chain.Solana });
        
        _chainConfig.Setup(x => x.GetChainConfig(It.IsAny<Chain>()))
            .Returns((Chain chain) => CreateMockChainConfig(chain));
        
        _tokenFactory.Setup(x => x.CreateSupplied(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), 
            It.IsAny<Chain>(), It.IsAny<int>(), It.IsAny<decimal>(), It.IsAny<decimal>()))
            .Returns((string name, string symbol, string addr, Chain chain, int dec, decimal amt, decimal price) =>
                new Token { Symbol = symbol, Logo = "" });
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
            Key = ProtocolNames.SolanaWallet,
            DisplayName = "Solana Wallet",
            Website = "https://solana.com",
            Icon = "solana.svg",
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