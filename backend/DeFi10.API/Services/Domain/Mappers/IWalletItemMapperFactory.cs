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

public interface IWalletItemMapperFactory
{
    IWalletItemMapper<IEnumerable<TokenDetail>> CreateMoralisTokenMapper();
    IWalletItemMapper<AaveGetUserSuppliesResponse> CreateAaveSuppliesMapper();
    IWalletItemMapper<AaveGetUserBorrowsResponse> CreateAaveBorrowsMapper();
    IWalletItemMapper<UniswapV3GetActivePoolsResponse> CreateUniswapV3Mapper();
    IWalletItemMapper<PendleVePositionsResponse> CreatePendleVeMapper();
    IWalletItemMapper<PendleDepositsResponse> CreatePendleDepositsMapper();

    IWalletItemMapper<SolanaTokenResponse> CreateSolanaTokenMapper();
    IWalletItemMapper<IEnumerable<KaminoPosition>> CreateSolanaKaminoMapper();
    IWalletItemMapper<IEnumerable<RaydiumPosition>> CreateSolanaRaydiumMapper();

    bool ValidateChainSupport<T>(ChainEnum chain) where T : class;
    IEnumerable<IChainSupportService> GetAllMappers();
}
