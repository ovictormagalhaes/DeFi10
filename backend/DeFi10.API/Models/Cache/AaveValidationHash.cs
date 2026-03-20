using MongoDB.Bson.Serialization.Attributes;

namespace DeFi10.API.Models.Cache;

/// <summary>
/// Hash de validação tipado para cache do Aave
/// Classe tipada evita problemas de _t/_v do MongoDB
/// </summary>
[BsonIgnoreExtraElements]
public class AaveValidationHash
{
    [BsonElement("marketAddress")]
    public string MarketAddress { get; set; } = string.Empty;
    
    [BsonElement("chainId")]
    public int ChainId { get; set; }
    
    [BsonElement("userAddress")]
    public string UserAddress { get; set; } = string.Empty;
    
    [BsonElement("supplyCount")]
    public int SupplyCount { get; set; }
    
    [BsonElement("borrowCount")]
    public int BorrowCount { get; set; }
    
    [BsonElement("totalSupplyUsd")]
    public string TotalSupplyUsd { get; set; } = string.Empty;
    
    [BsonElement("totalBorrowUsd")]
    public string TotalBorrowUsd { get; set; } = string.Empty;
    
    [BsonElement("supplies")]
    public List<AaveBalanceHash> Supplies { get; set; } = new();
    
    [BsonElement("borrows")]
    public List<AaveBalanceHash> Borrows { get; set; } = new();
}

/// <summary>
/// Representa um saldo de token Aave para validação de cache
/// </summary>
[BsonIgnoreExtraElements]
public class AaveBalanceHash
{
    [BsonElement("tokenAddress")]
    public string TokenAddress { get; set; } = string.Empty;
    
    [BsonElement("symbol")]
    public string Symbol { get; set; } = string.Empty;
}
