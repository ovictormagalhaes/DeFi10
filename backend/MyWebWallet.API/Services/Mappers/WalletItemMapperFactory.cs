using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Interfaces;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Mappers;

public interface IWalletItemMapperFactory
{
    IWalletItemMapper<IEnumerable<TokenDetail>> CreateMoralisTokenMapper();
    IWalletItemMapper<AaveGetUserSuppliesResponse> CreateAaveSuppliesMapper();
    IWalletItemMapper<AaveGetUserBorrowsResponse> CreateAaveBorrowsMapper();
    IWalletItemMapper<UniswapV3GetActivePoolsResponse> CreateUniswapV3Mapper();
    IWalletItemMapper<PendleVePositionsResponse> CreatePendleVeMapper();
    IWalletItemMapper<PendleDepositsResponse> CreatePendleDepositsMapper();
    // Solana mappers
    IWalletItemMapper<SolanaTokenResponse> CreateSolanaTokenMapper();
    IWalletItemMapper<IEnumerable<KaminoPosition>> CreateSolanaKaminoMapper();
    IWalletItemMapper<IEnumerable<RaydiumPosition>> CreateSolanaRaydiumMapper();
    
    // Chain validation methods
    bool ValidateChainSupport<T>(ChainEnum chain) where T : class;
    IEnumerable<IChainSupportService> GetAllMappers();
}

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
            // Solana
            CreateSolanaTokenMapper(),
            CreateSolanaKaminoMapper(),
            CreateSolanaRaydiumMapper()
        };
        return mappers;
    }
}