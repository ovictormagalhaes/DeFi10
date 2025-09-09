using MyWebWallet.API.Services.Models;

namespace MyWebWallet.API.Models;

public record WalletResponse(
    string Account,
    string Network,
    decimal TotalValueUsd,
    IEnumerable<GetERC20TokenMoralisResponse> Tokens,
    DateTime LastUpdated
);