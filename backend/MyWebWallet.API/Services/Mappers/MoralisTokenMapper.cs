using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Mappers;

public class MoralisTokenMapper : IWalletItemMapper<IEnumerable<TokenDetail>>
{
    public string ProtocolName => "Moralis";
    public string GetProtocolName() => ProtocolName;

    public bool SupportsChain(ChainEnum chain)
    {
        return GetSupportedChains().Contains(chain);
    }

    public IEnumerable<ChainEnum> GetSupportedChains()
    {
        return new[] { ChainEnum.Base, ChainEnum.BNB };
    }

    public async Task<List<WalletItem>> MapAsync(IEnumerable<TokenDetail> tokens, ChainEnum chain)
    {
        if (!SupportsChain(chain))
            throw new NotSupportedException($"Chain {chain} is not supported by {GetProtocolName()}");

        return await Task.FromResult(tokens?.Select(token =>
        {
            decimal.TryParse(token.Balance, out var balance);
            var decimals = token.Decimals ?? 1;
            var balanceFormatted = balance / (decimal)Math.Pow(10, decimals);

            return new WalletItem
            {
                Type = WalletItemType.Wallet,
                Protocol = GetProtocol(chain),
                Position = new Position
                {
                    Label = "Wallet",
                    Tokens = new List<Token>
                    {
                        new Token
                        {
                            Name = token.Name,
                            Chain = chain.ToChainId(),
                            Symbol = token.Symbol,
                            ContractAddress = token.TokenAddress,
                            Logo = string.IsNullOrEmpty(token.Logo) ? token.Thumbnail : token.Logo,
                            Thumbnail = token.Thumbnail,
                            Financials = new TokenFinancials
                            {
                                Amount = balance,
                                DecimalPlaces = decimals,
                                BalanceFormatted = balanceFormatted,
                                Price = (decimal?)token.UsdPrice,
                                TotalPrice = (decimal?)token.UsdPrice * balanceFormatted
                            },
                            Native = token.VerifiedContract ? false : (bool?)null,
                            PossibleSpam = token.PossibleSpam
                        }
                    }
                }
            };
        })?.ToList() ?? []);
    }

    private static Protocol GetProtocol(ChainEnum chain) => new()
    {
        Name = "Moralis",
        Chain = chain.GetDisplayName(),
        Id = "moralis",
        Url = "",
        Logo = ""
    };
}