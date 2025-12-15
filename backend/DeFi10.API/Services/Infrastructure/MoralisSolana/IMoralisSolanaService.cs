using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Infrastructure.MoralisSolana.Models;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Infrastructure.MoralisSolana
{
    public interface IMoralisSolanaService : IChainSupportService
    {
        Task<SolanaTokenResponse> GetTokensAsync(string address, ChainEnum chain);
        Task<SolanaNFTResponse> GetNFTsAsync(string address, ChainEnum chain);
    }
}
