using MongoDB.Bson.Serialization.Attributes;

namespace DeFi10.API.Models;

/// <summary>
/// Define uma alocação de ativo para estratégias Type 1 (AllocationByWeight).
/// Contém metadados completos do protocolo, chain, token e peso alvo.
/// </summary>
public class StrategyAllocation
{
    [BsonElement("assetKey")]
    public string AssetKey { get; set; } = string.Empty;
    
    [BsonElement("protocol")]
    public AllocationProtocol Protocol { get; set; } = new();
    
    [BsonElement("chain")]
    public AllocationChain Chain { get; set; } = new();
    
    [BsonElement("token")]
    public AllocationToken Token { get; set; } = new();
    
    [BsonElement("group")]
    public string Group { get; set; } = string.Empty;
    
    [BsonElement("groupType")]
    public int GroupType { get; set; }
    
    [BsonElement("targetWeight")]
    public int TargetWeight { get; set; }
    
    [BsonElement("positionType")]
    public int PositionType { get; set; }
}
