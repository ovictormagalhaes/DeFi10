using DeFi10.API.Models;

namespace DeFi10.API.Repositories.Interfaces;

public interface IStrategyRepository
{
    Task<WalletGroupStrategies?> GetByWalletGroupIdAsync(Guid walletGroupId, CancellationToken ct = default);
    Task<WalletGroupStrategies> UpsertAsync(WalletGroupStrategies walletGroupStrategies, CancellationToken ct = default);
    Task<bool> DeleteByWalletGroupIdAsync(Guid walletGroupId, CancellationToken ct = default);
}
