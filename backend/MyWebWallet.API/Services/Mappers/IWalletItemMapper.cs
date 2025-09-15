using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Mappers;

public interface IWalletItemMapper<TInput> : IChainSupportService
{
    Task<List<WalletItem>> MapAsync(TInput input, ChainEnum chain);
    string ProtocolName { get; }
}