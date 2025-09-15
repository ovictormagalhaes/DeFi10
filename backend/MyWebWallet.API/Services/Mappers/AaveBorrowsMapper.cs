using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Mappers;

public class AaveBorrowsMapper : IWalletItemMapper<AaveGetUserBorrowsResponse>
{
    public string ProtocolName => "Aave-Borrows";
    public string GetProtocolName() => ProtocolName;

    public bool SupportsChain(ChainEnum chain)
    {
        return GetSupportedChains().Contains(chain);
    }

    public IEnumerable<ChainEnum> GetSupportedChains()
    {
        // Aave V3 is currently only supported on Base in this implementation
        return new[] { ChainEnum.Base };
    }

    public async Task<List<WalletItem>> MapAsync(AaveGetUserBorrowsResponse response, ChainEnum chain)
    {
        if (!SupportsChain(chain))
            throw new NotSupportedException($"Chain {chain} is not supported by {GetProtocolName()}");

        return await Task.FromResult(response?.Data?.UserBorrows?.Select(supply =>
        {
            decimal.TryParse(supply.Debt.Amount.Value, out var balance);
            decimal.TryParse(supply.Debt.Usd, out var totalPrice);
            var price = balance > 0 ? totalPrice / balance : 0;

            return new WalletItem
            {
                Type = WalletItemType.LendingAndBorrowing,
                Protocol = GetProtocol(chain),
                Position = new Position
                {
                    Label = "Borrowed",
                    Tokens = new List<Token>
                    {
                        new Token
                        {
                            Type = TokenType.Borrowed,
                            Name = supply.Currency.Name,
                            Symbol = supply.Currency.Symbol,
                            Chain = chain.ToChainId(),
                            ContractAddress = supply.Currency.Address,
                            Financials = new TokenFinancials
                            {
                                Amount = balance,
                                BalanceFormatted = balance,
                                Price = price,
                                TotalPrice = totalPrice
                            }
                        }
                    }
                },
                AdditionalData = new AdditionalData()
            };
        }).ToList() ?? []);
    }

    private static Protocol GetProtocol(ChainEnum chain) => new()
    {
        Name = "Aave V3",
        Chain = chain.GetDisplayName(),
        Id = "aave-v3",
        Url = "https://app.aave.com",
        Logo = "https://cdn.moralis.io/defi/aave.png"
    };
}