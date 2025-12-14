using DeFi10.API.Services.Mappers;
using DeFi10.API.Services.Models;
using DeFi10.API.Models;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Interfaces;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace DeFi10.API.Tests.Services.Mappers;

public class MoralisTokenMapperTests
{
    private readonly Mock<IChainConfigurationService> _chainConfig;
    private readonly Mock<IProtocolConfigurationService> _protocolConfig;
    private readonly Mock<IOptions<MoralisOptions>> _options;
    private readonly Mock<ILogger<MoralisTokenMapper>> _logger;
    private readonly MoralisTokenMapper _mapper;

    public MoralisTokenMapperTests()
    {
        _chainConfig = new Mock<IChainConfigurationService>();
        _protocolConfig = new Mock<IProtocolConfigurationService>();
        _options = new Mock<IOptions<MoralisOptions>>();
        _logger = new Mock<ILogger<MoralisTokenMapper>>();

        _options.Setup(x => x.Value).Returns(new MoralisOptions { FilterZeroPriceTokens = false });
        SetupDefaultMocks();

        _mapper = new MoralisTokenMapper(_chainConfig.Object, _protocolConfig.Object, _options.Object, _logger.Object);
    }

    private void SetupDefaultMocks()
    {
        _protocolConfig.Setup(x => x.GetEnabledChainEnums(ProtocolNames.Moralis, "Solana"))
            .Returns(new[] { Chain.Ethereum, Chain.Base });
        _protocolConfig.Setup(x => x.GetProtocol(ProtocolNames.Moralis))
            .Returns(CreateMockProtocolDefinition());
    }

    private ProtocolDefinition CreateMockProtocolDefinition()
    {
        return new ProtocolDefinition
        {
            Key = ProtocolNames.Moralis,
            DisplayName = "Moralis",
            Website = "https://moralis.io",
            Icon = "moralis.svg"
        };
    }

    [Fact]
    public async Task MapAsync_WithValidTokens_CreatesWalletItems()
    {
        var tokens = new List<TokenDetail>
        {
            new TokenDetail
            {
                Name = "USD Coin",
                Symbol = "USDC",
                TokenAddress = "0xusdc",
                Balance = "1000000",
                Decimals = 6,
                UsdPrice = 1.0,
                Logo = "usdc.png",
                Thumbnail = "usdc_thumb.png"
            }
        };

        var result = await _mapper.MapAsync(tokens, Chain.Ethereum);

        Assert.Single(result);
        Assert.Equal(WalletItemType.Wallet, result[0].Type);
        Assert.Equal("Wallet", result[0].Position.Label);
        Assert.Single(result[0].Position.Tokens);
        Assert.Equal("USDC", result[0].Position.Tokens[0].Symbol);
    }

    [Fact]
    public async Task MapAsync_WithFilterEnabled_FiltersZeroPriceTokens()
    {
        _options.Setup(x => x.Value).Returns(new MoralisOptions { FilterZeroPriceTokens = true });
        var mapper = new MoralisTokenMapper(_chainConfig.Object, _protocolConfig.Object, _options.Object, _logger.Object);

        var tokens = new List<TokenDetail>
        {
            new TokenDetail { Symbol = "TOKEN1", Balance = "1000", Decimals = 18, UsdPrice = 0 },
            new TokenDetail { Symbol = "TOKEN2", Balance = "1000", Decimals = 18, UsdPrice = 1.5 }
        };

        var result = await mapper.MapAsync(tokens, Chain.Ethereum);

        Assert.Single(result);
        Assert.Equal("TOKEN2", result[0].Position.Tokens[0].Symbol);
    }

    [Fact]
    public async Task MapAsync_WithNullTokens_ReturnsEmptyList()
    {
        var result = await _mapper.MapAsync(null, Chain.Ethereum);

        Assert.Empty(result);
    }

    [Fact]
    public async Task MapAsync_WithUnsupportedChain_ThrowsNotSupportedException()
    {
        _protocolConfig.Setup(x => x.GetEnabledChainEnums(ProtocolNames.Moralis, "Solana"))
            .Returns(new[] { Chain.Ethereum });

        var tokens = new List<TokenDetail>();

        await Assert.ThrowsAsync<NotSupportedException>(() => _mapper.MapAsync(tokens, Chain.Solana));
    }
}
