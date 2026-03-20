using System.Text.Json;
using DeFi10.API.Controllers.Requests;
using DeFi10.API.Infrastructure;
using DeFi10.API.Models;
using DeFi10.API.Repositories.Interfaces;
using DeFi10.API.Services.Domain;

namespace DeFi10.API.Services.Domain;

public class StrategyService : IStrategyService
{
    private readonly IStrategyRepository _repository;
    private readonly ISystemClock _clock;
    private readonly ILogger<StrategyService> _logger;

    public StrategyService(
        IStrategyRepository repository,
        ISystemClock clock,
        ILogger<StrategyService> logger)
    {
        _repository = repository;
        _clock = clock;
        _logger = logger;
    }

    public async Task<WalletGroupStrategies> SaveStrategiesAsync(Guid walletGroupId, List<string> accounts, List<StrategyRequest> strategies)
    {
        // Validate all strategies first
        foreach (var strategy in strategies)
        {
            ValidateStrategy(strategy);
        }

        var now = _clock.UtcNow;

        // Convert requests to strategy documents
        var strategyDocs = strategies.Select(req => new StrategyDocument
        {
            Id = req.Id ?? Guid.NewGuid(),
            StrategyType = req.StrategyType,
            Name = req.Name,
            Description = req.Description,
            Allocations = req.Allocations,
            Targets = req.Targets,
            CreatedAt = req.CreatedAt ?? now,
            UpdatedAt = now
        }).ToList();

        // Create or update the wallet group strategies document
        var walletGroupStrategies = new WalletGroupStrategies
        {
            WalletGroupId = walletGroupId,
            Accounts = accounts,
            Strategies = strategyDocs,
            CreatedAt = strategyDocs.FirstOrDefault()?.CreatedAt ?? now,
            UpdatedAt = now
        };

        await _repository.UpsertAsync(walletGroupStrategies);
        
        _logger.LogInformation("Saved {Count} strategies for WalletGroupId={WalletGroupId}", 
            strategyDocs.Count, walletGroupId);

        return walletGroupStrategies;
    }

    public async Task<WalletGroupStrategies?> GetStrategiesAsync(Guid walletGroupId)
    {
        return await _repository.GetByWalletGroupIdAsync(walletGroupId);
    }

    private static void ValidateStrategy(StrategyRequest strategy)
    {
        // Validate based on strategy type
        if (strategy.StrategyType == StrategyType.AllocationByWeight)
        {
            if (strategy.Allocations == null || strategy.Allocations.Count == 0)
            {
                throw new ArgumentException("Allocations are required for AllocationByWeight strategy");
            }

            foreach (var allocation in strategy.Allocations)
            {
                if (string.IsNullOrWhiteSpace(allocation.AssetKey))
                    throw new ArgumentException("AssetKey is required for each allocation");
                
                if (allocation.TargetWeight < 0 || allocation.TargetWeight > 100)
                    throw new ArgumentOutOfRangeException(nameof(allocation.TargetWeight), 
                        "TargetWeight must be between 0 and 100");
            }
        }
        else if (strategy.StrategyType == StrategyType.HealthFactorTarget)
        {
            if (strategy.Targets == null || strategy.Targets.Count == 0)
            {
                throw new ArgumentException("Targets are required for HealthFactorTarget strategy");
            }

            foreach (var target in strategy.Targets)
            {
                if (string.IsNullOrWhiteSpace(target.AssetKey))
                    throw new ArgumentException("AssetKey is required for each target");
                
                if (target.TargetHealthFactor < 1.0m || target.TargetHealthFactor > 10.0m)
                    throw new ArgumentOutOfRangeException(nameof(target.TargetHealthFactor),
                        "TargetHealthFactor must be between 1.0 and 10.0");
                
                if (target.CriticalThreshold < 1.0m || target.CriticalThreshold > target.TargetHealthFactor)
                    throw new ArgumentOutOfRangeException(nameof(target.CriticalThreshold),
                        "CriticalThreshold must be between 1.0 and TargetHealthFactor");
            }
        }
    }
}
