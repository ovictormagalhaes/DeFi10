using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;
using MyWebWallet.API.Aggregation;

namespace MyWebWallet.API.Services.Mappers;

public class AaveSuppliesMapper : IWalletItemMapper<AaveGetUserSuppliesResponse>
{
    private readonly ITokenFactory _tokenFactory;
    public AaveSuppliesMapper(ITokenFactory tokenFactory)
    {
        _tokenFactory = tokenFactory;
    }

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

        if (response?.Data?.UserSupplies == null)
            return new List<WalletItem>();

        var walletItems = new List<WalletItem>();

        foreach (var supply in response.Data.UserSupplies)
        {
            if (!decimal.TryParse(supply.Balance.Amount.Value, out var amountFormatted)) amountFormatted = 0m;
            if (!decimal.TryParse(supply.Balance.Usd, out var totalUsd)) totalUsd = 0m;
            var unitPrice = amountFormatted > 0 ? totalUsd / amountFormatted : 0m;

            var suppliedToken = _tokenFactory.CreateSupplied(
                supply.Currency.Name,
                supply.Currency.Symbol,
                supply.Currency.Address,
                chain,
                0, // decimals unknown in current payload
                amountFormatted,
                unitPrice);

            var walletItem = new WalletItem
            {
                Type = WalletItemType.LendingAndBorrowing,
                Protocol = GetProtocol(chain),
                Position = new Position
                {
                    Label = "Supplied",
                    Tokens = new List<Token> { suppliedToken }
                },
                AdditionalData = new AdditionalData
                {
                    IsCollateral = supply.IsCollateral,
                    CanBeCollateral = supply.CanBeCollateral
                }
            };

            walletItems.Add(walletItem);
        }

        return await Task.FromResult(walletItems);
    }

    private static Protocol GetProtocol(ChainEnum chain) => new()
    {
        Name = "Aave V3",
        Chain = chain.ToChainId(),
        Id = "aave-v3",
        Url = "https://app.aave.com",
        Logo = "https://cdn.moralis.io/defi/aave.png"
    };
}