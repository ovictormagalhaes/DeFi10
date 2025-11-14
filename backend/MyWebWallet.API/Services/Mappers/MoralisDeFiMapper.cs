using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Interfaces;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Mappers;

public class MoralisDeFiMapper : IWalletItemMapper<IEnumerable<GetDeFiPositionsMoralisInfo>>
{
    private readonly IChainConfigurationService _chainConfig;
    private readonly IProtocolConfigurationService _protocolConfig;
    private const string PROTOCOL_ID = "moralis";

    public MoralisDeFiMapper(IChainConfigurationService chainConfig, IProtocolConfigurationService protocolConfig)
    { _chainConfig = chainConfig; _protocolConfig = protocolConfig; }

    public bool SupportsChain(ChainEnum chain) => GetSupportedChains().Contains(chain);
    public IEnumerable<ChainEnum> GetSupportedChains() => new[] { ChainEnum.Base, ChainEnum.BNB };

    public Protocol GetProtocolDefinition(ChainEnum chain)
    {
        var protoDef = _protocolConfig.GetProtocol(PROTOCOL_ID) ?? throw new InvalidOperationException($"Protocol configuration missing for {PROTOCOL_ID}");
        if (string.IsNullOrWhiteSpace(protoDef.Key) || string.IsNullOrWhiteSpace(protoDef.DisplayName))
            throw new InvalidOperationException($"Protocol {PROTOCOL_ID} missing mandatory metadata (Key/DisplayName)");
        var chainSlug = _chainConfig.GetChainConfig(chain)?.Slug ?? throw new InvalidOperationException($"Chain slug missing for {chain}");
        return new Protocol { Name = protoDef.DisplayName!, Chain = chainSlug, Id = protoDef.Key!, Url = protoDef.Website ?? string.Empty, Logo = protoDef.Icon ?? string.Empty };
    }

    public async Task<List<WalletItem>> MapAsync(IEnumerable<GetDeFiPositionsMoralisInfo> items, ChainEnum chain)
    {
        if (!SupportsChain(chain)) throw new NotSupportedException($"Chain {chain} is not supported by {PROTOCOL_ID}");
        var protocol = GetProtocolDefinition(chain);
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
                Protocol = protocol,
                Position = new Position
                {
                    Label = d.Position.Label,
                    Tokens = d.Position.Tokens.Select(t =>
                    {
                        decimal balance = 0; if (!string.IsNullOrEmpty(t.Balance)) decimal.TryParse(t.Balance, out balance);
                        int decimalPlaces = int.TryParse(t.Decimals, out var dec) ? dec : 0;
                        var balanceFormatted = decimalPlaces > 0 ? balance / (decimal)Math.Pow(10, decimalPlaces) : balance;
                        return new Token
                        {
                            Type = ParseTokenType(t.TokenType),
                            Name = t.Name,
                            Symbol = t.Symbol,
                            ContractAddress = t.ContractAddress,
                            Logo = t.Logo,
                            Chain = protocol.Chain,
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
                AdditionalData = new AdditionalData { }
            };
        })?.ToList() ?? []);
    }

    private static TokenType? ParseTokenType(string tokenType) => tokenType?.ToLowerInvariant() switch { "supplied" => TokenType.Supplied, "borrowed" => TokenType.Borrowed, _ => null };
}