using DeFi10.API.Models;
using DeFi10.API.Services.Protocols.Aave.Models;
using DeFi10.API.Services.Protocols.Aave.Models.Supplies;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Protocols.Aave;

public interface IAaveeService
{
    Task<AaveGetUserSuppliesResponse> GetUserSupplies(string address, string chain);
    Task<AaveGetUserBorrowsResponse> GetUserBorrows(string address, string chain);

    Task<HashSet<string>> GetWrapperTokenAddressesAsync(ChainEnum chain);
}