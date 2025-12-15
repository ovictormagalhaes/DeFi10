using DeFi10.API.Services.Protocols.Raydium.Models;

namespace DeFi10.API.Services.Protocols.Raydium
{
    public interface IRaydiumOnChainService
    {
        Task<List<RaydiumPosition>> GetPositionsAsync(string walletAddress);
    }
}
