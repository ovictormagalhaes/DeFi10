using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DeFi10.API.Models.Persistence;

public sealed class TokenMetadataDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; }
    
    [BsonElement("symbol")]
    [BsonRequired]
    public string Symbol { get; set; } = string.Empty;
    
    [BsonElement("name")]
    [BsonRequired]
    public string Name { get; set; } = string.Empty;
    
    [BsonElement("logo_url")]
    public string? LogoUrl { get; set; }
    
    [BsonElement("chain_id")]
    [BsonRequired]
    public int ChainId { get; set; }
    
    [BsonElement("address")]
    [BsonRequired]
    public string Address { get; set; } = string.Empty;
    
    [BsonElement("price_usd")]
    public decimal? PriceUsd { get; set; }
    
    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [BsonElement("updated_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
