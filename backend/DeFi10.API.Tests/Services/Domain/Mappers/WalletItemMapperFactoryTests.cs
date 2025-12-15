using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Protocols.Aave.Models.Supplies;
using DeFi10.API.Services.Protocols.Kamino.Models;
using DeFi10.API.Services.Protocols.Raydium.Models;
using DeFi10.API.Models;
using Moq;
using DeFi10.API.Services.Infrastructure.MoralisSolana.Models;
using DeFi10.API.Services.Infrastructure.Moralis.Models;
using DeFi10.API.Services.Protocols.Aave.Models;
using DeFi10.API.Services.Protocols.Uniswap.Models;
using DeFi10.API.Services.Protocols.Pendle.Models;

namespace DeFi10.API.Tests.Services.Domain.Mappers;

public class WalletItemMapperFactoryTests
{
    private readonly Mock<IServiceProvider> _serviceProvider;
    private readonly WalletItemMapperFactory _factory;

    public WalletItemMapperFactoryTests()
    {
        _serviceProvider = new Mock<IServiceProvider>();
        _factory = new WalletItemMapperFactory(_serviceProvider.Object);
    }

    [Fact]
    public void CreateMoralisTokenMapper_ReturnsCorrectMapper()
    {
        var expectedMapper = new Mock<IWalletItemMapper<IEnumerable<TokenDetail>>>().Object;
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<IEnumerable<TokenDetail>>)))
            .Returns(expectedMapper);

        var result = _factory.CreateMoralisTokenMapper();

        Assert.NotNull(result);
        Assert.Same(expectedMapper, result);
    }

    [Fact]
    public void CreateAaveSuppliesMapper_ReturnsCorrectMapper()
    {
        var expectedMapper = new Mock<IWalletItemMapper<AaveGetUserSuppliesResponse>>().Object;
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<AaveGetUserSuppliesResponse>)))
            .Returns(expectedMapper);

        var result = _factory.CreateAaveSuppliesMapper();

        Assert.NotNull(result);
        Assert.Same(expectedMapper, result);
    }

    [Fact]
    public void CreateAaveBorrowsMapper_ReturnsCorrectMapper()
    {
        var expectedMapper = new Mock<IWalletItemMapper<AaveGetUserBorrowsResponse>>().Object;
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<AaveGetUserBorrowsResponse>)))
            .Returns(expectedMapper);

        var result = _factory.CreateAaveBorrowsMapper();

        Assert.NotNull(result);
        Assert.Same(expectedMapper, result);
    }

    [Fact]
    public void CreateUniswapV3Mapper_ReturnsCorrectMapper()
    {
        var expectedMapper = new Mock<IWalletItemMapper<UniswapV3GetActivePoolsResponse>>().Object;
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<UniswapV3GetActivePoolsResponse>)))
            .Returns(expectedMapper);

        var result = _factory.CreateUniswapV3Mapper();

        Assert.NotNull(result);
        Assert.Same(expectedMapper, result);
    }

    [Fact]
    public void CreatePendleVeMapper_ReturnsCorrectMapper()
    {
        var expectedMapper = new Mock<IWalletItemMapper<PendleVePositionsResponse>>().Object;
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<PendleVePositionsResponse>)))
            .Returns(expectedMapper);

        var result = _factory.CreatePendleVeMapper();

        Assert.NotNull(result);
        Assert.Same(expectedMapper, result);
    }

    [Fact]
    public void CreatePendleDepositsMapper_ReturnsCorrectMapper()
    {
        var expectedMapper = new Mock<IWalletItemMapper<PendleDepositsResponse>>().Object;
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<PendleDepositsResponse>)))
            .Returns(expectedMapper);

        var result = _factory.CreatePendleDepositsMapper();

        Assert.NotNull(result);
        Assert.Same(expectedMapper, result);
    }

    [Fact]
    public void CreateSolanaTokenMapper_ReturnsCorrectMapper()
    {
        var expectedMapper = new Mock<IWalletItemMapper<SolanaTokenResponse>>().Object;
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<SolanaTokenResponse>)))
            .Returns(expectedMapper);

        var result = _factory.CreateSolanaTokenMapper();

        Assert.NotNull(result);
        Assert.Same(expectedMapper, result);
    }

    [Fact]
    public void CreateSolanaKaminoMapper_ReturnsCorrectMapper()
    {
        var expectedMapper = new Mock<IWalletItemMapper<IEnumerable<KaminoPosition>>>().Object;
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<IEnumerable<KaminoPosition>>)))
            .Returns(expectedMapper);

        var result = _factory.CreateSolanaKaminoMapper();

        Assert.NotNull(result);
        Assert.Same(expectedMapper, result);
    }

    [Fact]
    public void CreateSolanaRaydiumMapper_ReturnsCorrectMapper()
    {
        var expectedMapper = new Mock<IWalletItemMapper<IEnumerable<RaydiumPosition>>>().Object;
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<IEnumerable<RaydiumPosition>>)))
            .Returns(expectedMapper);

        var result = _factory.CreateSolanaRaydiumMapper();

        Assert.NotNull(result);
        Assert.Same(expectedMapper, result);
    }

    [Fact]
    public void ValidateChainSupport_WithSupportedChain_ReturnsTrue()
    {
        var mockMapper = new Mock<IWalletItemMapper<IEnumerable<TokenDetail>>>();
        mockMapper.Setup(x => x.SupportsChain(Chain.Ethereum)).Returns(true);
        
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<IEnumerable<TokenDetail>>)))
            .Returns(mockMapper.Object);

        var result = _factory.ValidateChainSupport<IEnumerable<TokenDetail>>(Chain.Ethereum);

        Assert.True(result);
    }

    [Fact]
    public void ValidateChainSupport_WithUnsupportedChain_ReturnsFalse()
    {
        var mockMapper = new Mock<IWalletItemMapper<IEnumerable<TokenDetail>>>();
        mockMapper.Setup(x => x.SupportsChain(Chain.Solana)).Returns(false);
        
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<IEnumerable<TokenDetail>>)))
            .Returns(mockMapper.Object);

        var result = _factory.ValidateChainSupport<IEnumerable<TokenDetail>>(Chain.Solana);

        Assert.False(result);
    }

    [Fact]
    public void ValidateChainSupport_WithNullMapper_ReturnsFalse()
    {
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<IEnumerable<TokenDetail>>)))
            .Returns(null);

        var result = _factory.ValidateChainSupport<IEnumerable<TokenDetail>>(Chain.Ethereum);

        Assert.False(result);
    }

    [Fact]
    public void GetAllMappers_ReturnsAllNineMappers()
    {
        SetupAllMappers();

        var result = _factory.GetAllMappers();

        Assert.Equal(9, result.Count());
    }

    private void SetupAllMappers()
    {
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<IEnumerable<TokenDetail>>)))
            .Returns(new Mock<IWalletItemMapper<IEnumerable<TokenDetail>>>().Object);
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<AaveGetUserSuppliesResponse>)))
            .Returns(new Mock<IWalletItemMapper<AaveGetUserSuppliesResponse>>().Object);
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<AaveGetUserBorrowsResponse>)))
            .Returns(new Mock<IWalletItemMapper<AaveGetUserBorrowsResponse>>().Object);
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<UniswapV3GetActivePoolsResponse>)))
            .Returns(new Mock<IWalletItemMapper<UniswapV3GetActivePoolsResponse>>().Object);
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<PendleVePositionsResponse>)))
            .Returns(new Mock<IWalletItemMapper<PendleVePositionsResponse>>().Object);
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<PendleDepositsResponse>)))
            .Returns(new Mock<IWalletItemMapper<PendleDepositsResponse>>().Object);
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<SolanaTokenResponse>)))
            .Returns(new Mock<IWalletItemMapper<SolanaTokenResponse>>().Object);
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<IEnumerable<KaminoPosition>>)))
            .Returns(new Mock<IWalletItemMapper<IEnumerable<KaminoPosition>>>().Object);
        _serviceProvider.Setup(x => x.GetService(typeof(IWalletItemMapper<IEnumerable<RaydiumPosition>>)))
            .Returns(new Mock<IWalletItemMapper<IEnumerable<RaydiumPosition>>>().Object);
    }
}
