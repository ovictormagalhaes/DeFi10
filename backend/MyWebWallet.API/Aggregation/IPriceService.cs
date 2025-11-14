using MyWebWallet.API.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Aggregation;

public interface IPriceService
{
    Task<IDictionary<string, decimal>> HydratePricesAsync(IEnumerable<WalletItem> walletItems, ChainEnum chain, CancellationToken ct = default);
}
