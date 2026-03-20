using MongoDB.Bson.Serialization.Attributes;

namespace DeFi10.API.Models;

/// <summary>
/// Define a alocação alvo (peso/nota) de um ativo dentro de um grupo.
/// Usado em estratégias Type 1 (AllocationByWeight).
/// </summary>
public class TargetAllocation
{
    /// <summary>
    /// Chave do ativo (ex: "cbBTC", "WETH/USDC", "lend-0#0").
    /// </summary>
    [BsonElement("assetKey")]
    public string AssetKey { get; set; } = string.Empty;
    
    /// <summary>
    /// Grupo onde o ativo se aplica: "Lending Supply", "Lending Borrow", "Liquidity", "Staking", "Wallet", "All".
    /// </summary>
    [BsonElement("group")]
    public string Group { get; set; } = "All";
    
    /// <summary>
    /// Peso/nota alvo (0-100). Exemplo: 50 = 50% da alocação do grupo.
    /// </summary>
    [BsonElement("targetWeight")]
    public int TargetWeight { get; set; }
    
    /// <summary>
    /// Símbolo do token para referência rápida (opcional, denormalizado).
    /// </summary>
    [BsonElement("symbol")]
    public string? Symbol { get; set; }
    
    /// <summary>
    /// Nome do token/pool para referência rápida (opcional, denormalizado).
    /// </summary>
    [BsonElement("name")]
    public string? Name { get; set; }
    
    // ===== METADADOS VISUAIS =====
    
    /// <summary>
    /// Logo do token/asset
    /// </summary>
    [BsonElement("tokenLogo")]
    public string? TokenLogo { get; set; }
    
    /// <summary>
    /// Protocolo onde o asset está (ex: "aave-v3", "uniswap-v3")
    /// </summary>
    [BsonElement("protocol")]
    public string? Protocol { get; set; }
    
    /// <summary>
    /// Nome do protocolo para exibição (ex: "Aave V3", "Uniswap V3")
    /// </summary>
    [BsonElement("protocolName")]
    public string? ProtocolName { get; set; }
    
    /// <summary>
    /// Logo do protocolo
    /// </summary>
    [BsonElement("protocolLogo")]
    public string? ProtocolLogo { get; set; }
    
    /// <summary>
    /// Chain onde o asset está (ex: "base", "ethereum", "solana")
    /// </summary>
    [BsonElement("chain")]
    public string? Chain { get; set; }
    
    /// <summary>
    /// Logo da chain
    /// </summary>
    [BsonElement("chainLogo")]
    public string? ChainLogo { get; set; }
}
