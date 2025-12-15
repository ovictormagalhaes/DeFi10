using DeFi10.API.Services.Domain;
using DeFi10.API.Models;

namespace DeFi10.API.Services.Domain;


public sealed class WalletItemLabelEnricher
{
    private readonly ILogger<WalletItemLabelEnricher> _logger;

    public WalletItemLabelEnricher(ILogger<WalletItemLabelEnricher> logger)
    {
        _logger = logger;
    }


    public void EnrichLabels(IEnumerable<WalletItem> walletItems)
    {
        if (walletItems == null)
            return;

        foreach (var item in walletItems)
        {
            EnrichLabel(item);
        }
    }


    private void EnrichLabel(WalletItem item)
    {
        try
        {

            if (item.Type != WalletItemType.LiquidityPool)
                return;

            if (item.Position?.Tokens == null || item.Position.Tokens.Count == 0)
                return;

            if (!string.IsNullOrWhiteSpace(item.Position.Label))
                return;

            var symbols = item.Position.Tokens
                .Select(t => GetTokenSymbol(t))
                .Where(s => !string.IsNullOrEmpty(s))
                .ToList();

            if (symbols.Count == 0)
            {
                _logger.LogDebug("[LabelEnricher] No valid symbols found for position");
                return;
            }

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


    private string? GetTokenSymbol(Token token)
    {

        if (!string.IsNullOrWhiteSpace(token.Symbol))
            return token.Symbol;

        if (!string.IsNullOrWhiteSpace(token.Name))
            return token.Name;

        if (!string.IsNullOrWhiteSpace(token.ContractAddress) && token.ContractAddress.Length > 10)
        {
            return $"{token.ContractAddress[..6]}…{token.ContractAddress[^4..]}";
        }

        return null;
    }
}
