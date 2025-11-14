using MyWebWallet.API.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Interfaces;

public interface IChainSupportService
{
    bool SupportsChain(ChainEnum chain);
    IEnumerable<ChainEnum> GetSupportedChains();
}