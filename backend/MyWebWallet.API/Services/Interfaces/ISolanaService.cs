using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Solana;
using Chain = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Interfaces
{
    public interface ISolanaService : IChainSupportService
    {
        Task<SolanaTokenResponse> GetTokensAsync(string address, Chain chain);
        Task<IEnumerable<KaminoPosition>> GetKaminoPositionsAsync(string address, Chain chain);
        Task<IEnumerable<RaydiumPosition>> GetRaydiumPositionsAsync(string address, Chain chain);
    }
}
