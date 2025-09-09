using MyWebWallet.API.Services.Models;

namespace MyWebWallet.API.Models;

public class WalletInfo
{
    public string Account { get; set; } = string.Empty;
    public string Network { get; set; } = string.Empty;
    public IEnumerable<WalletTokenInfo> Tokens { get; set; } = new List<WalletTokenInfo>();
    public IEnumerable<WalletDefiInfo> DeFi { get; set; }

    public WalletInfo()
    {

    }

}