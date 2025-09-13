using MyWebWallet.API.Services.Models;

namespace MyWebWallet.API.Services.Interfaces
{
    public interface IAaveeService
    {
        Task<AaveGetUserSuppliesResponse> GetUserSupplies(string address, string chain);
        Task<AaveGetUserBorrowsResponse> GetUserBorrows(string address, string chain);
    }
}