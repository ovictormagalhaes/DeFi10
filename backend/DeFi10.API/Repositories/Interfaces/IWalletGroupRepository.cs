using DeFi10.API.Models;

namespace DeFi10.API.Repositories.Interfaces;

public interface IWalletGroupRepository
{
    Task<WalletGroup?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<WalletGroup> CreateAsync(WalletGroup walletGroup, CancellationToken ct = default);
    Task<WalletGroup> UpdateAsync(WalletGroup walletGroup, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<bool> ExistsAsync(Guid id, CancellationToken ct = default);
    Task<List<WalletGroup>> FindByWalletAddressAsync(string walletAddress, CancellationToken ct = default);
}
