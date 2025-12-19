using DeFi10.API.Models;

namespace DeFi10.API.Aggregation;

public static class PriceKeyBuilder
{
    public static string BuildKey(Token token)
    {
        if (token == null) return string.Empty;
        
        var symbol = token.Symbol?.ToUpperInvariant() ?? "";
        if (string.IsNullOrWhiteSpace(symbol)) return string.Empty;
        
        var chain = token.Chain?.ToUpperInvariant() ?? "";
        var contract = token.ContractAddress?.ToLowerInvariant() ?? "";
        
        // Include contract address for more specific matching when available
        return string.IsNullOrEmpty(contract) 
            ? $"{symbol}|{chain}".ToLowerInvariant()
            : $"{symbol}|{chain}|{contract}".ToLowerInvariant();
    }
}
