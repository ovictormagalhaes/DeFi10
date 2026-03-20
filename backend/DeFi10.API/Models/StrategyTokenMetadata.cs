namespace DeFi10.API.Models;

/// <summary>
/// Metadados persistentes de um token individual em uma estratégia.
/// Usado para identificação e exibição, sem valores temporais.
/// </summary>
public class StrategyTokenMetadata
{
    public TokenType? Type { get; set; } // Supplied, Borrowed, Reward
    public string Symbol { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Logo { get; set; }
    public string Chain { get; set; } = string.Empty;
}
