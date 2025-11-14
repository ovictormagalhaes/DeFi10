using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Interfaces
{
    public interface IAaveeService
    {
        Task<AaveGetUserSuppliesResponse> GetUserSupplies(string address, string chain);
        Task<AaveGetUserBorrowsResponse> GetUserBorrows(string address, string chain);

        // New: returns set of wrapper token addresses (aToken, variableDebt, stableDebt) for the Aave market on the specified chain
        Task<HashSet<string>> GetWrapperTokenAddressesAsync(ChainEnum chain);
    }
}