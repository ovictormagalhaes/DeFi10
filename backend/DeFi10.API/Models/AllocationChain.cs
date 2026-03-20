using MongoDB.Bson.Serialization.Attributes;

namespace DeFi10.API.Models;

public class AllocationChain
{
    [BsonElement("id")]
    public string Id { get; set; } = string.Empty;
    
    [BsonElement("name")]
    public string Name { get; set; } = string.Empty;
    
    [BsonElement("logo")]
    public string? Logo { get; set; }
}
