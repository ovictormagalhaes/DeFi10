using DeFi10.API.Models;

namespace DeFi10.API.Services.Core;

public interface ITokenLogoService
{
    Task<string?> GetTokenLogoAsync(string tokenAddress, Chain chain);
    Task SetTokenLogoAsync(string tokenAddress, Chain chain, string logoUrl);
    Task<Dictionary<string, string>> GetAllTokenLogosAsync(Chain chain);
    Task LoadAllTokensIntoMemoryAsync();
    Task<int> GetCachedTokenCountAsync(Chain chain);

    Task<Dictionary<string, string?>> GetTokenLogosAsync(IEnumerable<string> tokenAddresses, Chain chain);
    Task SetTokenLogosAsync(Dictionary<string, string> tokenLogos, Chain chain);
}