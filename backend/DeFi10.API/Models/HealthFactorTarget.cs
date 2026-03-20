using MongoDB.Bson.Serialization.Attributes;

namespace DeFi10.API.Models;

/// <summary>
/// Define um target de Health Factor para estratégias Type 2 (HealthFactorRebalance).
/// </summary>
public class HealthFactorTarget
{
    [BsonElement("assetKey")]
    public string AssetKey { get; set; } = string.Empty;
    
    [BsonElement("protocol")]
    public AllocationProtocol Protocol { get; set; } = new();
    
    [BsonElement("chain")]
    public AllocationChain Chain { get; set; } = new();
    
    [BsonElement("targetHealthFactor")]
    public decimal TargetHealthFactor { get; set; }
    
    [BsonElement("criticalThreshold")]
    public decimal CriticalThreshold { get; set; }
}
