using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Protocols.Kamino.Models;
using Chain = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Protocols.Kamino
{
    public interface IKaminioService : IChainSupportService
    {
        Task<IEnumerable<KaminoPosition>> GetPositionsAsync(string address, Chain chain);
    }
}
