using DeFi10.API.Controllers.Requests;
using DeFi10.API.Models;

namespace DeFi10.API.Services.Domain;

public interface IStrategyService
{
    Task<WalletGroupStrategies> SaveStrategiesAsync(Guid walletGroupId, List<string> accounts, List<StrategyRequest> strategies);
    Task<WalletGroupStrategies?> GetStrategiesAsync(Guid walletGroupId);
}
