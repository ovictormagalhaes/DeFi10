using System.ComponentModel.DataAnnotations;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace DeFi10.API.Models;

/// <summary>
/// Documento MongoDB que agrupa todas as estratégias de um wallet group.
/// 1 documento por walletGroup.
/// </summary>
public sealed class WalletGroupStrategies
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid WalletGroupId { get; set; }

    [BsonElement("accounts")]
    public List<string> Accounts { get; set; } = new();

    [BsonElement("strategies")]
    public List<StrategyDocument> Strategies { get; set; } = new();

    [BsonElement("count")]
    public int Count => Strategies.Count;

    [BsonElement("key")]
    public string Key => WalletGroupId.ToString();

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}

/// <summary>
/// Estratégia individual dentro do documento WalletGroupStrategies
/// </summary>
public class StrategyDocument
{
    [BsonElement("id")]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; }

    [BsonElement("strategyType")]
    public StrategyType StrategyType { get; set; } = StrategyType.AllocationByWeight;

    [BsonElement("name")]
    [MaxLength(200)]
    public string? Name { get; set; }

    [BsonElement("description")]
    [MaxLength(1000)]
    public string? Description { get; set; }

    [BsonElement("allocations")]
    public List<StrategyAllocation>? Allocations { get; set; }

    [BsonElement("targets")]
    public List<HealthFactorTarget>? Targets { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
