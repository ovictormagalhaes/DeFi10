using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;

namespace MyWebWallet.API.Services.Interfaces
{
    public interface IMoralisService
    {
        Task<MoralisGetERC20TokenResponse> GetERC20TokenBalanceAsync(string address, string chain);
        Task<MoralisGetDeFiPositionsResponse> GetDeFiPositionsAsync(string address, string chain);
        Task<MoralisGetNFTsResponse> GetNFTsAsync(string address, string chain);
    }
}