using DeFi10.API.Services.Protocols.Uniswap.Models;

namespace DeFi10.API.Services.Protocols.Uniswap;

public interface IUniswapV3Service
{
    Task<UniswapV3GetActivePoolsResponse> GetActivePoolsAsync(string account);
    Task<UniswapV3GetActivePoolsResponse> GetActivePoolsHybridAsync(string account, DeFi10.API.Models.Chain chain);
}