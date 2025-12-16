using DeFi10.API.Models;
using DeFi10.API.Services.Protocols.Aave.Models;
using DeFi10.API.Services.Protocols.Aave.Models.Supplies;
using DeFi10.API.Services.Protocols.Pendle.Models;
using DeFi10.API.Services.Protocols.Uniswap.Models;
using DeFi10.API.Services.Protocols.Kamino.Models;
using DeFi10.API.Services.Protocols.Raydium.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Infrastructure.Moralis.Models;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Services.Infrastructure.MoralisSolana.Models;

namespace DeFi10.API.Services.Domain.Mappers;

public class WalletItemMapperFactory : IWalletItemMapperFactory
{
    private readonly IServiceProvider _serviceProvider;

    public WalletItemMapperFactory(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public IWalletItemMapper<IEnumerable<TokenDetail>> CreateMoralisTokenMapper()
        => _serviceProvider.GetRequiredService<IWalletItemMapper<IEnumerable<TokenDetail>>>();

    public IWalletItemMapper<AaveGetUserSuppliesResponse> CreateAaveSuppliesMapper()
        => _serviceProvider.GetRequiredService<IWalletItemMapper<AaveGetUserSuppliesResponse>>();

    public IWalletItemMapper<AaveGetUserBorrowsResponse> CreateAaveBorrowsMapper()
        => _serviceProvider.GetRequiredService<IWalletItemMapper<AaveGetUserBorrowsResponse>>();

    public IWalletItemMapper<UniswapV3GetActivePoolsResponse> CreateUniswapV3Mapper()
        => _serviceProvider.GetRequiredService<IWalletItemMapper<UniswapV3GetActivePoolsResponse>>();

    public IWalletItemMapper<PendleVePositionsResponse> CreatePendleVeMapper()
        => _serviceProvider.GetRequiredService<IWalletItemMapper<PendleVePositionsResponse>>();

    public IWalletItemMapper<PendleDepositsResponse> CreatePendleDepositsMapper()
        => _serviceProvider.GetRequiredService<IWalletItemMapper<PendleDepositsResponse>>();

    public IWalletItemMapper<SolanaTokenResponse> CreateSolanaTokenMapper()
        => _serviceProvider.GetRequiredService<IWalletItemMapper<SolanaTokenResponse>>();

    public IWalletItemMapper<IEnumerable<KaminoPosition>> CreateSolanaKaminoMapper()
        => _serviceProvider.GetRequiredService<IWalletItemMapper<IEnumerable<KaminoPosition>>>();

    public IWalletItemMapper<IEnumerable<RaydiumPosition>> CreateSolanaRaydiumMapper()
        => _serviceProvider.GetRequiredService<IWalletItemMapper<IEnumerable<RaydiumPosition>>>();

    public bool ValidateChainSupport<T>(ChainEnum chain) where T : class
    {
        var mapper = _serviceProvider.GetService<IWalletItemMapper<T>>();
        return mapper?.SupportsChain(chain) ?? false;
    }

    public IEnumerable<IChainSupportService> GetAllMappers()
    {
        var mappers = new List<IChainSupportService>
        {
            CreateMoralisTokenMapper(),
            CreateAaveSuppliesMapper(),
            CreateAaveBorrowsMapper(),
            CreateUniswapV3Mapper(),
            CreatePendleVeMapper(),
            CreatePendleDepositsMapper(),

            CreateSolanaTokenMapper(),
            CreateSolanaKaminoMapper(),
            CreateSolanaRaydiumMapper()
        };
        return mappers;
    }
}