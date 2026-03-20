using MongoDB.Bson.Serialization.Attributes;
using System.Text.Json.Serialization;

namespace DeFi10.API.Controllers.Requests;

public class StrategyItemAdditionalInfo
{
    public string? Logo1 { get; set; }
    public string? Logo2 { get; set; }
    public decimal? TierPercent { get; set; }
    
    [BsonElement("supplies")]
    public List<SupplyItem> Supplies { get; set; } = new();
    
    [BsonElement("borrows")]
    public List<BorrowItem> Borrows { get; set; } = new();
    
    [BsonElement("suppliesTokens")]
    public List<TokenInfo> SuppliesTokens { get; set; } = new();
    
    [BsonElement("borrowsTokens")]
    public List<TokenInfo> BorrowsTokens { get; set; } = new();
}

/// <summary>
/// Informações hidratadas de um token (metadados completos)
/// Usado para evitar repetição de dados em cada transação
/// </summary>
[BsonIgnoreExtraElements]
public class TokenInfo
{
    /// <summary>
    /// Endereço do token em protocolos EVM (Aave/Base)
    /// </summary>
    [BsonElement("tokenAddress")]
    [JsonPropertyName("tokenAddress")]
    public string? TokenAddress { get; set; }
    
    /// <summary>
    /// Endereço do mint em protocolos Solana (Kamino)
    /// </summary>
    [BsonElement("mintAddress")]
    [JsonPropertyName("mintAddress")]
    public string? MintAddress { get; set; }
    
    /// <summary>
    /// Símbolo do token (ex: USDC, SOL, WETH)
    /// </summary>
    [BsonElement("symbol")]
    [JsonPropertyName("symbol")]
    public string Symbol { get; set; } = string.Empty;
    
    /// <summary>
    /// Nome completo do token (ex: "USD Coin", "Wrapped Ether")
    /// </summary>
    [BsonElement("name")]
    [JsonPropertyName("name")]
    public string? Name { get; set; }
    
    /// <summary>
    /// URL do logo do token
    /// </summary>
    [BsonElement("logoUrl")]
    [JsonPropertyName("logoUrl")]
    public string? LogoUrl { get; set; }
    
    /// <summary>
    /// Número de casas decimais do token (ex: 6 para USDC, 18 para WETH, 9 para SOL)
    /// </summary>
    [BsonElement("decimals")]
    [JsonPropertyName("decimals")]
    public int Decimals { get; set; }
}

/// <summary>
/// Representa um item de supply (fornecimento/depósito)
/// Compatível com Aave (EVM - tokenAddress) e Kamino (Solana - mintAddress)
/// </summary>
[BsonIgnoreExtraElements]
public class SupplyItem
{
    /// <summary>
    /// Endereço do token em protocolos EVM (Aave/Base)
    /// </summary>
    [BsonElement("tokenAddress")]
    public string? TokenAddress { get; set; }
    
    /// <summary>
    /// Endereço do mint em protocolos Solana (Kamino)
    /// </summary>
    [BsonElement("mintAddress")]
    public string? MintAddress { get; set; }
    
    /// <summary>
    /// Símbolo do token (ex: WETH, SOL, cbBTC)
    /// </summary>
    [BsonElement("symbol")]
    public string? Symbol { get; set; }
    
    /// <summary>
    /// Balanço bruto (sem decimais aplicados, string para precisão)
    /// </summary>
    [BsonElement("balance")]
    public string? Balance { get; set; }
    
    /// <summary>
    /// Data/timestamp do evento de supply
    /// </summary>
    [BsonElement("timestamp")]
    [JsonPropertyName("timestamp")]
    public DateTime? Timestamp { get; set; }
}

/// <summary>
/// Representa um item de borrow (empréstimo)
/// Compatível com Aave (EVM - tokenAddress) e Kamino (Solana - mintAddress)
/// </summary>
[BsonIgnoreExtraElements]
public class BorrowItem
{
    /// <summary>
    /// Endereço do token em protocolos EVM (Aave/Base)
    /// </summary>
    [BsonElement("tokenAddress")]
    public string? TokenAddress { get; set; }
    
    /// <summary>
    /// Endereço do mint em protocolos Solana (Kamino)
    /// </summary>
    [BsonElement("mintAddress")]
    public string? MintAddress { get; set; }
    
    /// <summary>
    /// Símbolo do token (ex: USDC, USDT)
    /// </summary>
    [BsonElement("symbol")]
    public string? Symbol { get; set; }
    
    /// <summary>
    /// Balanço bruto (sem decimais aplicados, string para precisão)
    /// </summary>
    [BsonElement("balance")]
    public string? Balance { get; set; }
    
    /// <summary>
    /// Data/timestamp do evento de borrow
    /// </summary>
    [BsonElement("timestamp")]
    [JsonPropertyName("timestamp")]
    public DateTime? Timestamp { get; set; }
}

/// <summary>
/// Representa um item de repay (pagamento de empréstimo)
/// Compatível com Aave (EVM - tokenAddress) e Kamino (Solana - mintAddress)
/// </summary>
[BsonIgnoreExtraElements]
public class RepayItem
{
    /// <summary>
    /// Endereço do token em protocolos EVM (Aave/Base)
    /// </summary>
    [BsonElement("tokenAddress")]
    public string? TokenAddress { get; set; }
    
    /// <summary>
    /// Endereço do mint em protocolos Solana (Kamino)
    /// </summary>
    [BsonElement("mintAddress")]
    public string? MintAddress { get; set; }
    
    /// <summary>
    /// Símbolo do token (ex: USDC, USDT)
    /// </summary>
    [BsonElement("symbol")]
    public string? Symbol { get; set; }
    
    /// <summary>
    /// Valor pago (sem decimais aplicados, string para precisão)
    /// </summary>
    [BsonElement("balance")]
    public string? Balance { get; set; }
    
    /// <summary>
    /// Data/timestamp do evento de repay
    /// </summary>
    [BsonElement("timestamp")]
    [JsonPropertyName("timestamp")]
    public DateTime? Timestamp { get; set; }
}
