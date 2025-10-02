using MyWebWallet.API.Services.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Interfaces;

/// <summary>
/// Service responsible for calculating (or approximating until full on-chain implementation) the 24h generated fees for a Uniswap V3 position.
/// </summary>
public interface IUniswapV3FeesService
{
    /// <summary>
    /// Returns the USD value of fees generated in the last 24h for the given position, or null if unavailable.
    /// Implementation keeps short term cache to avoid recomputation inside aggregation job bursts.
    /// </summary>
    Task<decimal?> GetFees24hUsdAsync(UniswapV3Position position, ChainEnum chain, decimal token0PriceUsd, decimal token1PriceUsd, CancellationToken ct = default);
}
