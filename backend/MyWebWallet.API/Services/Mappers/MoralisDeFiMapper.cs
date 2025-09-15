using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;

namespace MyWebWallet.API.Services.Mappers;

public class MoralisDeFiMapper : IWalletItemMapper<IEnumerable<GetDeFiPositionsMoralisInfo>>
{
    public string ProtocolName => "Moralis-DeFi";
    public string GetProtocolName() => ProtocolName;

    public bool SupportsChain(MyWebWallet.API.Models.Chain chain)
    {
        return GetSupportedChains().Contains(chain);
    }

    public IEnumerable<MyWebWallet.API.Models.Chain> GetSupportedChains()
    {
        return new[] { MyWebWallet.API.Models.Chain.Base, MyWebWallet.API.Models.Chain.BNB };
    }

    public async Task<List<WalletItem>> MapAsync(IEnumerable<GetDeFiPositionsMoralisInfo> items, MyWebWallet.API.Models.Chain chain)
    {
        if (!SupportsChain(chain))
            throw new NotSupportedException($"Chain {chain} is not supported by {GetProtocolName()}");

        return await Task.FromResult(items?.Select(d =>
        {
            var label = d.Position?.Label?.ToLowerInvariant();

            var walletItemType = label switch
            {
                "liquidity" => WalletItemType.LiquidityPool,
                "supplied" or "borrowed" => WalletItemType.LendingAndBorrowing,
                "staking" => WalletItemType.Staking,
                _ => WalletItemType.Other,
            };

            return new WalletItem
            {
                Type = walletItemType,
                Protocol = new Protocol
                {
                    Name = d.ProtocolName,
                    Chain = chain.GetDisplayName(),
                    Id = d.ProtocolId,
                    Url = d.ProtocolUrl,
                    Logo = d.ProtocolLogo
                },
                Position = new Position
                {
                    Label = d.Position.Label,
                    Tokens = d.Position.Tokens.Select(t =>
                    {
                        var balance = t.Balance != null ? decimal.Parse(t.Balance) : 0;
                        var decimalPlaces = int.TryParse(t.Decimals, out var decimals) ? decimals : 0;
                        var balanceFormatted = balance / (decimal)Math.Pow(10, decimalPlaces);

                        return new Token
                        {
                            Type = ParseTokenType(t.TokenType),
                            Name = t.Name,
                            Symbol = t.Symbol,
                            ContractAddress = t.ContractAddress,
                            Logo = t.Logo,
                            Chain = chain.ToChainId(),
                            Thumbnail = t.Thumbnail,
                            Financials = new TokenFinancials
                            {
                                Amount = balance,
                                DecimalPlaces = decimalPlaces,
                                BalanceFormatted = balanceFormatted,
                                Price = t.UsdPrice,
                                TotalPrice = t.UsdValue
                            }
                        };
                    }).ToList()
                },
                AdditionalData = new AdditionalData
                {
                    //HealthFactor = d.AccountData?.HealthFactory != null && decimal.TryParse(d.AccountData.HealthFactory, out var healthFactor) ? healthFactor : null
                }
            };
        })?.ToList() ?? []);
    }

    private static TokenType? ParseTokenType(string tokenType)
    {
        return tokenType?.ToLowerInvariant() switch
        {
            "supplied" => TokenType.Supplied,
            "borrowed" => TokenType.Borrowed,
            "reward" => TokenType.Reward,
            "native" => TokenType.Native,
            "staked" => TokenType.Staked,
            _ => null
        };
    }
}