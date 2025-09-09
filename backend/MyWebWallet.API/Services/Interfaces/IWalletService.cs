using MyWebWallet.API.Models;

namespace MyWebWallet.API.Services.Interfaces;

public interface IWalletService
{
    Task<WalletInfo> GetWalletInfoAsync(string account);
}