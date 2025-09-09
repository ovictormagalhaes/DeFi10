using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;

namespace MyWebWallet.API.Services;

public class WalletService : IWalletService
{
    private readonly IEnumerable<IBlockchainService> _blockchainServices;
    
    public WalletService(IEnumerable<IBlockchainService> blockchainServices)
    {
        _blockchainServices = blockchainServices;
    }

    public async Task<WalletInfo> GetWalletInfoAsync(string account)
    {
        var blockchainService = _blockchainServices.FirstOrDefault(s => s.IsValidAddress(account));
        
        if (blockchainService == null)
            throw new ArgumentException("Invalid account address format");

        var walletInfo = await blockchainService.GetWalletTokensAsync(account);

        return walletInfo;
    }
}