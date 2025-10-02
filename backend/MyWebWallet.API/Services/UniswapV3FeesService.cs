using System.Collections.Concurrent;
using ChainEnum = MyWebWallet.API.Models.Chain;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;

namespace MyWebWallet.API.Services;

/// <summary>
/// Temporary heuristic implementation: approximates 24h fees using current uncollected fees * ratio fallback.
/// Will be replaced with precise on-chain delta feeGrowthInside segmented by liquidity changes.
/// </summary>
public sealed class UniswapV3FeesService : IUniswapV3FeesService
{
    private readonly ConcurrentDictionary<string, (DateTime ts, decimal value)> _cache = new();
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60); // small TTL

    public Task<decimal?> GetFees24hUsdAsync(UniswapV3Position position, ChainEnum chain, decimal token0PriceUsd, decimal token1PriceUsd, CancellationToken ct = default)
    {
        // Key by position id + chain
        var key = $"{chain}:{position.Id}";
        if (_cache.TryGetValue(key, out var entry) && (DateTime.UtcNow - entry.ts) < CacheTtl)
        {
            return Task.FromResult<decimal?>(entry.value);
        }

        // Heuristic placeholder until full precise implementation:
        // Use collectedFeesToken* (which currently holds total uncollected aggregated) as base and cap by value < position value * 0.25
        if (!decimal.TryParse(position.CollectedFeesToken0, out var fees0)) fees0 = 0m;
        if (!decimal.TryParse(position.CollectedFeesToken1, out var fees1)) fees1 = 0m;
        var usd = fees0 * token0PriceUsd + fees1 * token1PriceUsd;
        // Position principal value approximation
        decimal.TryParse(position.DepositedToken0, out var dep0);
        decimal.TryParse(position.DepositedToken1, out var dep1);
        var principal = dep0 * token0PriceUsd + dep1 * token1PriceUsd;
        if (principal > 0 && usd > principal * 0.25m)
        {
            usd = principal * 0.25m; // safety clamp
        }
        if (usd <= 0) return Task.FromResult<decimal?>(null);
        _cache[key] = (DateTime.UtcNow, usd);
        return Task.FromResult<decimal?>(usd);
    }
}
