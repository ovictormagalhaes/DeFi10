using DeFi10.API.Services.Infrastructure.CoinMarketCap.Models;

namespace DeFi10.API.Services.Infrastructure.CoinMarketCap;

public interface ICoinMarketCapService
{
    Task<CmcQuotesLatestV2Response?> GetQuotesLatestV2Async(IEnumerable<string> symbols, CancellationToken ct = default);
}
