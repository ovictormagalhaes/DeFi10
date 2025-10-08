using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Interfaces;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Mappers;

public class MoralisTokenMapper : IWalletItemMapper<IEnumerable<TokenDetail>>
{
    private readonly IChainConfigurationService _chainConfig;
    public MoralisTokenMapper(IChainConfigurationService chainConfigurationService)
    {
        _chainConfig = chainConfigurationService;
    }

    public string ProtocolName => "Moralis";
    public string GetProtocolName() => ProtocolName;

    public bool SupportsChain(ChainEnum chain) => GetSupportedChains().Contains(chain);

    public IEnumerable<ChainEnum> GetSupportedChains() => new [] { ChainEnum.Base, ChainEnum.BNB, ChainEnum.Arbitrum, ChainEnum.Ethereum };

    public async Task<List<WalletItem>> MapAsync(IEnumerable<TokenDetail> tokens, ChainEnum chain)
    {
        if (!SupportsChain(chain))
            throw new NotSupportedException($"Chain {chain} is not supported by {GetProtocolName()}");

        var cfg = _chainConfig.GetChainConfig(chain);
        var chainSlug = cfg?.Slug ?? chain.ToString().ToLowerInvariant();

        return await Task.FromResult(tokens?.Select(token =>
        {
            decimal.TryParse(token.Balance, out var balance);
            var decimals = token.Decimals ?? 1;
            var balanceFormatted = balance / (decimal)Math.Pow(10, decimals);

            return new WalletItem
            {
                Type = WalletItemType.Wallet,
                Protocol = GetProtocol(chainSlug),
                Position = new Position
                {
                    Label = "Wallet",
                    Tokens = new List<Token>
                    {
                        new Token
                        {
                            Name = token.Name,
                            Chain = chainSlug,
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
        })?.ToList() ?? new List<WalletItem>());
    }

    private Protocol GetProtocol(string chainSlug) => new()
    {
        Name = "Moralis",
        Chain = chainSlug,
        Id = "wallet",
        Url = string.Empty,
        Logo = string.Empty
    };
}