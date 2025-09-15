using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Mappers;

public class AaveSuppliesMapper : IWalletItemMapper<AaveGetUserSuppliesResponse>
{
    public string ProtocolName => "Aave-Supplies";
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

    public async Task<List<WalletItem>> MapAsync(AaveGetUserSuppliesResponse response, ChainEnum chain)
    {
        if (!SupportsChain(chain))
            throw new NotSupportedException($"Chain {chain} is not supported by {GetProtocolName()}");

        if (response?.Data?.UserBorrows == null)
            return new List<WalletItem>();

        var walletItems = new List<WalletItem>();

        foreach (var supply in response.Data.UserBorrows)
        {
            var walletItem = new WalletItem
            {
                Type = WalletItemType.LendingAndBorrowing,
                Protocol = GetProtocol(chain),
                Position = new Position
                {
                    Label = "Supplied",
                    Tokens = new List<Token>
                    {
                        new Token
                        {
                            Type = TokenType.Supplied,
                            Name = supply.Currency.Name,
                            Symbol = supply.Currency.Symbol,
                            ContractAddress = supply.Currency.Address,
                            Chain = chain.ToChainId(),
                            Financials = new TokenFinancials
                            {
                                Amount = decimal.Parse(supply.Balance.Amount.Value),
                                BalanceFormatted = decimal.Parse(supply.Balance.Amount.Value),
                                Price = decimal.Parse(supply.Balance.Usd) / decimal.Parse(supply.Balance.Amount.Value),
                                TotalPrice = decimal.Parse(supply.Balance.Usd)
                            }
                        }
                    }
                },
                AdditionalData = new AdditionalData
                {
                    IsCollateral = supply.IsCollateral,
                    CanBeCollateral = supply.CanBeCollateral
                }
            };

            walletItems.Add(walletItem);
        }

        return walletItems;
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