using MyWebWallet.API.Services.Models;

namespace MyWebWallet.API.Services.Interfaces;

public interface IUniswapV3Service
{
    Task<UniswapV3GetActivePoolsResponse> GetActivePoolsAsync(string account);
}