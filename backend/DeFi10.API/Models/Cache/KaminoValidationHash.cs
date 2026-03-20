using MongoDB.Bson.Serialization.Attributes;

namespace DeFi10.API.Models.Cache;

/// <summary>
/// Hash de validação tipado para cache do Kamino
/// Classe tipada evita problemas de _t/_v do MongoDB
/// </summary>
[BsonIgnoreExtraElements]
public class KaminoValidationHash
{
    [BsonElement("marketPubkey")]
    public string MarketPubkey { get; set; } = string.Empty;
    
    [BsonElement("obligationPubkey")]
    public string ObligationPubkey { get; set; } = string.Empty;
    
    [BsonElement("eventCount")]
    public int EventCount { get; set; }
    
    [BsonElement("lastEventDate")]
    public DateTime LastEventDate { get; set; }
    
    [BsonElement("supplies")]
    public List<TokenBalanceHash> Supplies { get; set; } = new();
    
    [BsonElement("borrows")]
    public List<TokenBalanceHash> Borrows { get; set; } = new();
}

/// <summary>
/// Representa um saldo de token para validação de cache
/// </summary>
[BsonIgnoreExtraElements]
public class TokenBalanceHash
{
    [BsonElement("mintAddress")]
    public string MintAddress { get; set; } = string.Empty;
    
    [BsonElement("balance")]
    public string Balance { get; set; } = string.Empty;
}
