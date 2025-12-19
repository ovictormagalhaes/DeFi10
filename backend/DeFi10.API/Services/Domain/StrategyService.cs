using System.Text.Json;
using DeFi10.API.Controllers.Requests;
using DeFi10.API.Infrastructure;
using DeFi10.API.Models;
using DeFi10.API.Repositories.Interfaces;
using DeFi10.API.Services.Interfaces;

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

    public async Task SaveAsync(Guid walletGroupId, List<StrategyItem> items)
    {
        ValidateItems(items);
        
        var existing = await _repository.GetByWalletGroupIdAsync(walletGroupId);
        
        if (existing != null)
        {
            existing.Items = items;
            existing.UpdatedAt = _clock.UtcNow;
            await _repository.UpdateAsync(existing);
            _logger.LogInformation("Updated Strategy for WalletGroupId={WalletGroupId}", walletGroupId);
        }
        else
        {
            var strategy = new Strategy
            {
                Id = Guid.NewGuid(),
                WalletGroupId = walletGroupId,
                Items = items,
                CreatedAt = _clock.UtcNow,
                UpdatedAt = _clock.UtcNow,
                IsDeleted = false
            };
            await _repository.CreateAsync(strategy);
            _logger.LogInformation("Created Strategy for WalletGroupId={WalletGroupId}", walletGroupId);
        }
    }

    public async Task<List<StrategyItem>?> GetAsync(Guid walletGroupId)
    {
        var strategy = await _repository.GetByWalletGroupIdAsync(walletGroupId);
        return strategy?.Items;
    }

    private static void ValidateItems(List<StrategyItem> items)
    {
        if (items == null || items.Count == 0) throw new ArgumentException("Items are required");
        foreach (var it in items)
        {

            if (it.Assets == null || it.Assets.Count == 0)
            {
                throw new ArgumentException("Assets list is required and must contain at least one asset");
            }

            foreach (var asset in it.Assets)
            {
                if (string.IsNullOrWhiteSpace(asset.Key))
                {
                    throw new ArgumentException("Each asset must have a non-empty Key");
                }
            }
            
            if (it.Note < 0 || it.Note > 100) throw new ArgumentOutOfRangeException(nameof(it.Note), "Note must be between 0 and 100");

            it.Version = string.IsNullOrWhiteSpace(it.Version) ? "1" : it.Version.Trim();
            if (it.Value != null) it.Value = it.Value.Trim();
        }
    }
}
