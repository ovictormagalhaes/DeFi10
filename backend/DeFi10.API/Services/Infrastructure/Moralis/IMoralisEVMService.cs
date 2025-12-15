using DeFi10.API.Models;
using DeFi10.API.Services.Infrastructure.Moralis.Models;

namespace DeFi10.API.Services.Infrastructure.Moralis
{
    public interface IMoralisEVMService
    {
        Task<MoralisGetERC20TokenResponse> GetERC20TokenBalanceAsync(string address, string chain);
        Task<MoralisGetDeFiPositionsResponse> GetDeFiPositionsAsync(string address, string chain);
        Task<MoralisGetNFTsResponse> GetNFTsAsync(string address, string chain);
    }
}