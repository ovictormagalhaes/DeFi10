using DeFi10.API.Models;
using DeFi10.API.Services.Protocols.Pendle.Models;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Protocols.Pendle;

public interface IPendleService
{

    Task<PendleVePositionsResponse?> GetVePositionsAsync(string account, ChainEnum chain);

    Task<PendleDepositsResponse?> GetDepositsAsync(string account, ChainEnum chain);
}
