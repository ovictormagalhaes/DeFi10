using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Models.Solana.Common;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Interfaces
{
    public interface IMoralisSolanaService : IChainSupportService
    {
        Task<SolanaTokenResponse> GetTokensAsync(string address, ChainEnum chain);
        Task<SolanaNFTResponse> GetNFTsAsync(string address, ChainEnum chain);
    }
}
