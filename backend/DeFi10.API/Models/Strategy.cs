using System.ComponentModel.DataAnnotations;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using DeFi10.API.Controllers.Requests;

namespace DeFi10.API.Models;

public sealed class Strategy
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; }

    [BsonElement("walletGroupId")]
    [BsonRepresentation(BsonType.String)]
    [Required]
    public Guid WalletGroupId { get; set; }

    [BsonElement("version")]
    public int Version { get; set; } = 2;

    [BsonElement("strategyType")]
    public StrategyType StrategyType { get; set; } = StrategyType.AllocationByWeight;

    [BsonElement("name")]
    [MaxLength(200)]
    public string? Name { get; set; }

    [BsonElement("description")]
    [MaxLength(1000)]
    public string? Description { get; set; }

    // === Type 1: Allocation by Weight ===
    [BsonElement("allocations")]
    public List<StrategyAllocation>? Allocations { get; set; }

    // === Type 2: Health Factor Rebalance ===
    [BsonElement("targets")]
    public List<HealthFactorTarget>? Targets { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("updatedAt")]
    public DateTime UpdatedAt { get; set; }

    [BsonElement("isDeleted")]
    public bool IsDeleted { get; set; } = false;
}
