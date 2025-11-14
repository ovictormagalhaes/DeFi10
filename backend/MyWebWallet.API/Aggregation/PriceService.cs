using Microsoft.Extensions.Logging;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using ChainEnum = MyWebWallet.API.Models.Chain;
using System.Linq;

namespace MyWebWallet.API.Aggregation;

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

        // ? LOG: Tokens encontrados
        _logger.LogInformation("[PriceService] Starting price hydration for chain={Chain}", chain);
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
                
                // ? LOG: Token com preço existente
                if (t.Financials.Price.HasValue && t.Financials.Price.Value > 0)
                { 
                    fullyPriced[key] = t.Financials.Price.Value;
                    _logger.LogDebug("[PriceService] Token already priced: key={Key} price={Price}", key, t.Financials.Price.Value);
                    continue; 
                }
                
                // ? LOG: Token candidato a busca de preço
                if (t.Financials.AmountFormatted.GetValueOrDefault() > 0 && !IsMoralisProtocol(item))
                { 
                    candidates.Add(key);
                    _logger.LogDebug("[PriceService] Token needs price: key={Key} symbol={Symbol} amount={Amount}", key, t.Symbol, t.Financials.AmountFormatted);
                }
            }
        }

        _logger.LogInformation("[PriceService] Found {TotalTokens} tokens, {FullyPriced} already priced, {Candidates} need pricing", 
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
            _logger.LogInformation("[PriceService] All prices resolved from existing data (no CMC needed)");
            return result;
        }

        _logger.LogInformation("[PriceService] Need to fetch {Count} prices from cache/CMC", remaining.Count);

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
            // ? LOG: Símbolos que vamos buscar no CMC
            _logger.LogInformation("[PriceService] Fetching {Count} symbols from CoinMarketCap: {Symbols}", 
                toFetchSymbols.Count, string.Join(", ", toFetchSymbols));
            
            try
            {
                var cmcResp = await _cmc.GetQuotesLatestV2Async(toFetchSymbols, ct);
                
                // ? LOG: Resposta do CMC
                if (cmcResp?.Data != null)
                {
                    _logger.LogInformation("[PriceService] CoinMarketCap returned {Count} results", cmcResp.Data.Count);
                    
                    // ? LOG: Chaves retornadas pelo CMC
                    var cmcKeys = string.Join(", ", cmcResp.Data.Keys);
                    _logger.LogDebug("[PriceService] CMC keys: {Keys}", cmcKeys);
                    
                    foreach (var sym in toFetchSymbols)
                    {
                        // ? FIX: Buscar case-insensitive usando FirstOrDefault
                        var asset = cmcResp.Data
                            .FirstOrDefault(kvp => kvp.Key.Equals(sym, StringComparison.OrdinalIgnoreCase))
                            .Value;
                        
                        if (asset != null)
                        {
                            var price = asset.Quote.TryGetValue("USD", out var usd) ? (usd.Price ?? 0m) : 0m;
                            
                            // ? LOG: Preço encontrado no CMC
                            _logger.LogInformation("[PriceService] ? CMC price found: {Symbol} = ${Price}", sym, price);
                            
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
                            // ? LOG: Símbolo não encontrado no CMC
                            _logger.LogWarning("[PriceService] ?? Symbol not found in CMC response: {Symbol} (tried case-insensitive search)", sym);
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

        _logger.LogInformation("[PriceService] Price hydration complete: {ResultCount} prices resolved", result.Count);
        return result;
    }

    private static bool IsMoralisProtocol(WalletItem item) => string.Equals(item?.Protocol?.Id, "moralis", StringComparison.OrdinalIgnoreCase);
    private static string BuildKey(Token t) => string.IsNullOrEmpty(t.Symbol) ? string.Empty : (t.Symbol + "|" + (t.Chain ?? "")).ToLowerInvariant();
    private static string ParseSymbol(string key) => key.Split('|')[0];
    private static string ParseChain(string key) { var parts = key.Split('|'); return parts.Length > 1 ? parts[1] : string.Empty; }
    private static string CacheKey(string symbol) => $"price:{symbol.ToLowerInvariant()}";

    private sealed class PriceCacheEntry { public decimal Price { get; set; } public DateTime ExpiresAtUtc { get; set; } }
}
