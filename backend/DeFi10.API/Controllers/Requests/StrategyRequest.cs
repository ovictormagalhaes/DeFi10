using DeFi10.API.Models;
using System.ComponentModel.DataAnnotations;

namespace DeFi10.API.Controllers.Requests;

public class StrategyRequest
{
    public Guid? Id { get; set; }
    
    public StrategyType StrategyType { get; set; } = StrategyType.AllocationByWeight;

    [MaxLength(200)]
    public string? Name { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }

    // === Type 1: Allocation by Weight ===
    public List<StrategyAllocation>? Allocations { get; set; }

    // === Type 2: Health Factor Rebalance ===
    public List<HealthFactorTarget>? Targets { get; set; }
    
    public DateTime? CreatedAt { get; set; }
    
    public DateTime? UpdatedAt { get; set; }
}

public class StrategiesRequest
{
    [Required]
    public Guid WalletGroupId { get; set; }

    [Required]
    public List<StrategyRequest> Strategies { get; set; } = new();
}
