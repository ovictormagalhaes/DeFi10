using DeFi10.API.Controllers.Requests;

namespace DeFi10.API.Services.Domain;

public interface IStrategyService
{
    Task SaveAsync(Guid walletGroupId, List<StrategyItem> items);
    Task<List<StrategyItem>?> GetAsync(Guid walletGroupId);
}
