using DeFi10.API.Models;
using MongoDB.Bson.Serialization.Attributes;

namespace DeFi10.API.Controllers.Requests;

public class StrategyItem
{
    [BsonElement("version")]
    public string Version { get; set; } = "2";

    [BsonElement("assets")]
    public List<StrategyAsset> Assets { get; set; } = new();
    
    [BsonElement("note")]
    public int Note { get; set; } = 0;
    
    [BsonElement("groupType")]
    public int GroupType { get; set; } = 1;
    
    [BsonElement("value")]
    public string? Value { get; set; }
    
    [BsonElement("metadata")]
    public StrategyAssetMetadata Metadata { get; set; } = new();
    
    [BsonElement("additionalInfo")]
    public StrategyItemAdditionalInfo AdditionalInfo { get; set; } = new();
}
