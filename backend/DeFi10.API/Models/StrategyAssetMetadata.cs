namespace DeFi10.API.Models;

/// <summary>
/// Metadados persistentes do ativo na estratégia.
/// Contém apenas dados imutáveis necessários para identificação e exibição.
/// Valores temporais (balance, price, APY) vêm do portfolio atual via cross-reference no frontend.
/// </summary>
public class StrategyAssetMetadata
{
    // === IDENTIFICAÇÃO ===
    public string? Symbol { get; set; }
    public string? Name { get; set; }
    public string? Address { get; set; }
    public string? ChainId { get; set; }
    public string? Chain { get; set; }
    
    // === PROTOCOLO ===
    public ProtocolMetadata? Protocol { get; set; }
    
    // === POSIÇÃO ===
    public string? PositionLabel { get; set; } // "Liquidity", "Lending", "Staking"
    public WalletItemType? PositionType { get; set; }
    
    // === TOKENS ENVOLVIDOS (para pools, lending multi-token) ===
    public List<StrategyTokenMetadata> Tokens { get; set; } = new();
}
