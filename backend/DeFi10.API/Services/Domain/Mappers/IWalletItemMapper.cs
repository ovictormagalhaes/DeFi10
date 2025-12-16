using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Domain.Mappers;

public interface IWalletItemMapper<TInput> : IChainSupportService
{
    Task<List<WalletItem>> MapAsync(TInput input, ChainEnum chain);
    Protocol GetProtocolDefinition(ChainEnum chain);
}