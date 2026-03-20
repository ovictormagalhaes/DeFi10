using MongoDB.Bson.Serialization.Attributes;

namespace DeFi10.API.Models;

public class AllocationToken
{
    [BsonElement("symbol")]
    public string Symbol { get; set; } = string.Empty;
    
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;
    
    [BsonElement("address")]
    public string Address { get; set; } = string.Empty;
    
    [BsonElement("logo")]
    public string? Logo { get; set; }
}
