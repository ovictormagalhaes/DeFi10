using DeFi10.API.Models;

namespace DeFi10.API.Services.Domain;


public interface IWalletAggregationService
{
    Task<WalletResponse> GetWalletTokensAsync(string account);
    bool IsValidAddress(string account);
    string NetworkName { get; }
}