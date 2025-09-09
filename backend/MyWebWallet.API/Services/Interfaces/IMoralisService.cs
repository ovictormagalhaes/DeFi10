using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;

namespace MyWebWallet.API.Services.Interfaces
{
    public interface IMoralisService
    {
        Task<GetERC20TokenMoralisResponse> GetERC20TokenBalanceAsync(string address, string chain);
        Task<GetDeFiPositionsMoralisResponse> GetDeFiPositionsAsync(string address, string chain);
    }
}