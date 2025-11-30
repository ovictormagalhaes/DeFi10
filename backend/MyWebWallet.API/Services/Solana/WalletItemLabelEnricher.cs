using MyWebWallet.API.Models;

namespace MyWebWallet.API.Services.Solana;

/// <summary>
/// Enriches WalletItem labels with proper token symbols after metadata has been loaded
/// </summary>
public sealed class WalletItemLabelEnricher
{
    private readonly ILogger<WalletItemLabelEnricher> _logger;

    public WalletItemLabelEnricher(ILogger<WalletItemLabelEnricher> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Enriches labels for all wallet items in the list
    /// </summary>
    public void EnrichLabels(IEnumerable<WalletItem> walletItems)
    {
        if (walletItems == null)
            return;

        foreach (var item in walletItems)
        {
            EnrichLabel(item);
        }
    }

    /// <summary>
    /// Enriches the label for a single wallet item based on its position tokens
    /// </summary>
    private void EnrichLabel(WalletItem item)
    {
        try
        {
            // Only process LiquidityPool items with empty labels
            if (item.Type != WalletItemType.LiquidityPool)
                return;

            if (item.Position?.Tokens == null || item.Position.Tokens.Count == 0)
                return;

            // Only enrich if label is empty or whitespace
            if (!string.IsNullOrWhiteSpace(item.Position.Label))
                return;

            // Get symbols from tokens
            var symbols = item.Position.Tokens
                .Select(t => GetTokenSymbol(t))
                .Where(s => !string.IsNullOrEmpty(s))
                .ToList();

            if (symbols.Count == 0)
            {
                _logger.LogDebug("[LabelEnricher] No valid symbols found for position");
                return;
            }

            // Build label: "SOL/USDC" or "SOL/USDC/RAY"
            string newLabel = string.Join("/", symbols);

            item.Position.Label = newLabel;
            _logger.LogDebug("[LabelEnricher] Enriched label: {NewLabel} (from {TokenCount} tokens)", 
                newLabel, symbols.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[LabelEnricher] Failed to enrich label");
        }
    }

    /// <summary>
    /// Extracts the best available symbol from a token
    /// </summary>
    private string? GetTokenSymbol(Token token)
    {
        // Prefer symbol, fallback to name, fallback to truncated contract address
        if (!string.IsNullOrWhiteSpace(token.Symbol))
            return token.Symbol;

        if (!string.IsNullOrWhiteSpace(token.Name))
            return token.Name;

        // Fallback: truncate contract address (first 6 + last 4)
        if (!string.IsNullOrWhiteSpace(token.ContractAddress) && token.ContractAddress.Length > 10)
        {
            return $"{token.ContractAddress[..6]}…{token.ContractAddress[^4..]}";
        }

        return null;
    }
}
