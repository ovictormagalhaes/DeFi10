using DeFi10.API.Models;

namespace DeFi10.API.Repositories.Interfaces;

public interface IStrategyRepository
{
    Task<Strategy?> GetByWalletGroupIdAsync(Guid walletGroupId, CancellationToken ct = default);
    Task<List<Strategy>> GetByWalletGroupIdsAsync(IEnumerable<Guid> walletGroupIds, CancellationToken ct = default);
    Task<Strategy> CreateAsync(Strategy strategy, CancellationToken ct = default);
    Task<Strategy> UpdateAsync(Strategy strategy, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<bool> ExistsAsync(Guid walletGroupId, CancellationToken ct = default);
}
