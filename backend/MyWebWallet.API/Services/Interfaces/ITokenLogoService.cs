using MyWebWallet.API.Models;

namespace MyWebWallet.API.Services.Interfaces;

public interface ITokenLogoService
{
    Task<string?> GetTokenLogoAsync(string tokenAddress, Chain chain);
    Task SetTokenLogoAsync(string tokenAddress, Chain chain, string logoUrl);
    Task<Dictionary<string, string>> GetAllTokenLogosAsync(Chain chain);
    Task LoadAllTokensIntoMemoryAsync();
    Task<int> GetCachedTokenCountAsync(Chain chain);
    
    // Batch operations for efficiency
    Task<Dictionary<string, string?>> GetTokenLogosAsync(IEnumerable<string> tokenAddresses, Chain chain);
    Task SetTokenLogosAsync(Dictionary<string, string> tokenLogos, Chain chain);
}