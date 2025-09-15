using MyWebWallet.API.Models;

namespace MyWebWallet.API.Services.Interfaces;

public interface IWalletService
{
    Task<WalletResponse> GetWalletInfoAsync(string account);
    Task<WalletResponse> GetWalletInfoAsync(string account, Chain chain);
    Task<WalletResponse> GetWalletInfoAsync(string account, IEnumerable<Chain> chains);
}