using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Infrastructure.CoinMarketCap;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Aggregation;

public sealed class PriceService : IPriceService
{
    private readonly ICacheService _cache;
    private readonly ICoinMarketCapService _cmc;
    private readonly ILogger<PriceService> _logger;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(1);

    public PriceService(ICacheService cache, ICoinMarketCapService cmc, ILogger<PriceService> logger)
    { _cache = cache; _cmc = cmc; _logger = logger; }

    public async Task<IDictionary<string, decimal>> HydratePricesAsync(IEnumerable<WalletItem> walletItems, ChainEnum chain, CancellationToken ct = default)
    {
        var result = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        if (walletItems == null) return result;

        var fullyPriced = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        var candidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        _logger.LogDebug("[PriceService] Starting price hydration for chain={Chain}", chain);
        int tokenCount = 0;

        foreach (var item in walletItems)
        {
            if (item?.Position?.Tokens == null) continue;
            foreach (var t in item.Position.Tokens)
            {
                if (t?.Financials == null) continue;
                tokenCount++;
                
                var key = BuildKey(t);
                if (string.IsNullOrEmpty(key)) 
                {
                    _logger.LogDebug("[PriceService] Token has no symbol: contract={Contract}", t.ContractAddress);
                    continue;
                }

                if (t.Financials.Price.HasValue && t.Financials.Price.Value > 0)
                { 
                    fullyPriced[key] = t.Financials.Price.Value;
                    _logger.LogDebug("[PriceService] Token already priced: key={Key} price={Price}", key, t.Financials.Price.Value);
                    continue; 
                }

                if (t.Financials.AmountFormatted.GetValueOrDefault() > 0 && !IsMoralisProtocol(item))
                { 
                    candidates.Add(key);
                    _logger.LogDebug("[PriceService] Token needs price: key={Key} symbol={Symbol} amount={Amount}", key, t.Symbol, t.Financials.AmountFormatted);
                }
            }
        }

        _logger.LogDebug("[PriceService] Found {TotalTokens} tokens, {FullyPriced} already priced, {Candidates} need pricing", 
            tokenCount, fullyPriced.Count, candidates.Count);

        foreach (var kv in fullyPriced) result[kv.Key] = kv.Value;
        if (candidates.Count == 0) return result;

        var bySymbol = fullyPriced
            .Select(kv => new { Key = kv.Key, Symbol = ParseSymbol(kv.Key), Chain = ParseChain(kv.Key), Price = kv.Value })
            .GroupBy(x => (x.Symbol, x.Chain))
            .ToDictionary(g => g.Key, g => g.Average(e => e.Price));

        var remaining = new List<(string key, string symbol)>();
        foreach (var cand in candidates)
        {
            if (result.ContainsKey(cand)) continue;
            var (sym, c) = (ParseSymbol(cand), ParseChain(cand));
            if (!string.IsNullOrEmpty(sym) && bySymbol.TryGetValue((sym, c), out var inferred))
            { 
                result[cand] = inferred;
                _logger.LogDebug("[PriceService] Inferred price from peer: key={Key} price={Price}", cand, inferred);
            }
            else remaining.Add((cand, sym));
        }

        if (remaining.Count == 0) 
        {
            _logger.LogDebug("[PriceService] All prices resolved from existing data (no CMC needed)");
            return result;
        }

        _logger.LogDebug("[PriceService] Need to fetch {Count} prices from cache/CMC", remaining.Count);

        var toFetchSymbols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var tup in remaining)
        {
            var cacheKey = CacheKey(tup.symbol);
            var cached = await _cache.GetAsync<PriceCacheEntry>(cacheKey);
            if (cached != null && cached.Price > 0 && cached.ExpiresAtUtc > DateTime.UtcNow)
            { 
                result[tup.key] = cached.Price;
                _logger.LogDebug("[PriceService] Price from cache: symbol={Symbol} price={Price}", tup.symbol, cached.Price);
            }
            else if (!string.IsNullOrEmpty(tup.symbol))
            { 
                toFetchSymbols.Add(tup.symbol);
            }
        }

        if (toFetchSymbols.Count > 0)
        {

            _logger.LogDebug("[PriceService] Fetching {Count} symbols from CoinMarketCap: {Symbols}", 
                toFetchSymbols.Count, string.Join(", ", toFetchSymbols));
            
            try
            {
                var cmcResp = await _cmc.GetQuotesLatestV2Async(toFetchSymbols, ct);

                if (cmcResp?.Data != null)
                {
                    _logger.LogDebug("[PriceService] CoinMarketCap returned {Count} results", cmcResp.Data.Count);

                    var cmcKeys = string.Join(", ", cmcResp.Data.Keys);
                    _logger.LogDebug("[PriceService] CMC keys: {Keys}", cmcKeys);
                    
                    foreach (var sym in toFetchSymbols)
                    {

                        var asset = cmcResp.Data
                            .FirstOrDefault(kvp => kvp.Key.Equals(sym, StringComparison.OrdinalIgnoreCase))
                            .Value;
                        
                        if (asset != null)
                        {
                            var price = asset.Quote.TryGetValue("USD", out var usd) ? (usd.Price ?? 0m) : 0m;

                            _logger.LogDebug("[PriceService] CMC price found: {Symbol} = ${Price}", sym, price);
                            
                            if (price > 0)
                            {
                                await _cache.SetAsync(CacheKey(sym), new PriceCacheEntry { Price = price, ExpiresAtUtc = DateTime.UtcNow + CacheTtl }, CacheTtl);
                                foreach (var r in remaining.Where(r => string.Equals(r.symbol, sym, StringComparison.OrdinalIgnoreCase)))
                                { result[r.key] = price; }
                            }
                            else
                            {
                                _logger.LogWarning("[PriceService] ?? CMC returned zero price for symbol: {Symbol}", sym);
                            }
                        }
                        else
                        {
                            // Symbol not found in CMC - apply fallback logic
                            _logger.LogWarning("[PriceService] ?? Symbol not found in CMC response: {Symbol} (tried case-insensitive search)", sym);
                            
                            // Fallback: Try to derive price from related tokens or use existing total price
                            var fallbackPrice = TryGetFallbackPrice(sym, remaining, walletItems);
                            if (fallbackPrice.HasValue && fallbackPrice.Value > 0)
                            {
                                _logger.LogDebug("[PriceService] Applied fallback price for {Symbol}: ${Price}", sym, fallbackPrice.Value);
                                
                                // Cache the fallback price with shorter TTL
                                await _cache.SetAsync(CacheKey(sym), new PriceCacheEntry { Price = fallbackPrice.Value, ExpiresAtUtc = DateTime.UtcNow + TimeSpan.FromMinutes(30) }, TimeSpan.FromMinutes(30));
                                
                                foreach (var r in remaining.Where(r => string.Equals(r.symbol, sym, StringComparison.OrdinalIgnoreCase)))
                                { result[r.key] = fallbackPrice.Value; }
                            }
                        }
                    }
                }
                else
                {
                    _logger.LogWarning("[PriceService] CoinMarketCap returned null/empty response");
                }
            }
            catch (Exception ex) 
            { 
                _logger.LogWarning(ex, "[PriceService] CMC fetch failed for symbols: {Symbols}", string.Join(", ", toFetchSymbols)); 
            }
        }

        _logger.LogDebug("[PriceService] Price hydration complete: {ResultCount} prices resolved", result.Count);
        return result;
    }

    private decimal? TryGetFallbackPrice(string symbol, List<(string key, string symbol)> remaining, IEnumerable<WalletItem> walletItems)
    {
        try
        {
            // Strategy 1: For governance/wrapped tokens, try to find the base token price
            var baseSymbol = symbol.Replace("ve", "").Replace("locked", "").Replace("staked", "").Trim().ToLowerInvariant();
            if (baseSymbol != symbol.ToLowerInvariant() && !string.IsNullOrEmpty(baseSymbol))
            {
                // Find if we have a price for the base token
                var baseToken = walletItems
                    .SelectMany(item => item?.Position?.Tokens ?? Enumerable.Empty<Token>())
                    .FirstOrDefault(t => t?.Symbol?.Equals(baseSymbol, StringComparison.OrdinalIgnoreCase) == true && t.Financials?.Price > 0);
                
                if (baseToken?.Financials?.Price > 0)
                {
                    _logger.LogDebug("[PriceService] Fallback: Using base token price for {Symbol} from {BaseSymbol}", symbol, baseSymbol);
                    return baseToken.Financials.Price.Value;
                }
            }

            // Strategy 2: For tokens with total price but no unit price, calculate from total/amount
            var tokenWithTotal = walletItems
                .SelectMany(item => item?.Position?.Tokens ?? Enumerable.Empty<Token>())
                .FirstOrDefault(t => t?.Symbol?.Equals(symbol, StringComparison.OrdinalIgnoreCase) == true 
                    && t.Financials?.TotalPrice > 0 
                    && t.Financials?.AmountFormatted > 0);
            
            if (tokenWithTotal != null)
            {
                var calculatedPrice = tokenWithTotal.Financials.TotalPrice / tokenWithTotal.Financials.AmountFormatted!.Value;
                _logger.LogDebug("[PriceService] Fallback: Calculated price for {Symbol} from total/amount: ${Price}", symbol, calculatedPrice);
                return calculatedPrice;
            }

            // Strategy 3: Default to 0 for unknown tokens (don't fail the entire aggregation)
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[PriceService] Error in fallback price calculation for {Symbol}", symbol);
            return null;
        }
    }

    private static bool IsMoralisProtocol(WalletItem item) => string.Equals(item?.Protocol?.Id, "moralis", StringComparison.OrdinalIgnoreCase);
    private static string BuildKey(Token t) => string.IsNullOrEmpty(t.Symbol) ? string.Empty : (t.Symbol + "|" + (t.Chain ?? "")).ToLowerInvariant();
    private static string ParseSymbol(string key) => key.Split('|')[0];
    private static string ParseChain(string key) { var parts = key.Split('|'); return parts.Length > 1 ? parts[1] : string.Empty; }
    private static string CacheKey(string symbol) => $"price:{symbol.ToLowerInvariant()}";

    private sealed class PriceCacheEntry { public decimal Price { get; set; } public DateTime ExpiresAtUtc { get; set; } }
}
