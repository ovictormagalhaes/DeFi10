using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using ChainEnum = MyWebWallet.API.Models.Chain;
using MyWebWallet.API.Aggregation;
using System.Globalization;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Configuration;

namespace MyWebWallet.API.Services.Mappers;

public class AaveSuppliesMapper : IWalletItemMapper<AaveGetUserSuppliesResponse>
{
    private readonly ITokenFactory _tokenFactory;
    private readonly IProtocolConfigurationService _protocolConfig;
    private readonly IChainConfigurationService _chainConfig;
    private const string PROTOCOL_ID = "aave-v3";

    public AaveSuppliesMapper(ITokenFactory tokenFactory, IProtocolConfigurationService protocolConfig, IChainConfigurationService chainConfig)
    { _tokenFactory = tokenFactory; _protocolConfig = protocolConfig; _chainConfig = chainConfig; }

    // Only claim support if protocol enabled on chain
    public bool SupportsChain(ChainEnum chain) => IsProtocolEnabled(chain);
    public IEnumerable<ChainEnum> GetSupportedChains() => new[] { ChainEnum.Base }; // declared possible

    private bool IsProtocolEnabled(ChainEnum chain)
    {
        var def = _protocolConfig.GetProtocol(PROTOCOL_ID);
        if (def?.ChainSupports == null) return false;
        return def.ChainSupports.Any(c => c.Enabled && string.Equals(c.Chain, chain.ToString(), StringComparison.OrdinalIgnoreCase));
    }

    public Protocol GetProtocolDefinition(ChainEnum chain)
    {
        if (!IsProtocolEnabled(chain)) throw new InvalidOperationException($"Protocol {PROTOCOL_ID} disabled on chain {chain}");
        var def = _protocolConfig.GetProtocol(PROTOCOL_ID) ?? throw new InvalidOperationException($"Protocol definition not found: {PROTOCOL_ID}");
        return def.ToProtocol(chain, _chainConfig);
    }

    public async Task<List<WalletItem>> MapAsync(AaveGetUserSuppliesResponse response, ChainEnum chain)
    {
        if (!SupportsChain(chain)) return new List<WalletItem>();
        if (response?.Data?.UserSupplies == null) return new List<WalletItem>();
        var protocol = GetProtocolDefinition(chain);
        var walletItems = new List<WalletItem>();
        foreach (var supply in response.Data.UserSupplies)
        {
            try
            {
                if (!decimal.TryParse(supply.Balance.Amount.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var amountFormatted)) continue;
                if (!decimal.TryParse(supply.Balance.Usd, NumberStyles.Float, CultureInfo.InvariantCulture, out var totalPriceUsd)) continue;
                if (amountFormatted <= 0) continue;
                decimal unitPrice = amountFormatted > 0 && totalPriceUsd >= 0 ? SafeDivide(totalPriceUsd, amountFormatted) : 0;
                int decimals = GetTokenDecimals(supply.Currency.Symbol, supply.Currency.Address);
                var suppliedToken = _tokenFactory.CreateSupplied(
                    supply.Currency.Name ?? string.Empty,
                    supply.Currency.Symbol ?? string.Empty,
                    supply.Currency.Address ?? string.Empty,
                    chain,
                    decimals,
                    amountFormatted,
                    unitPrice);
                walletItems.Add(new WalletItem
                {
                    Type = WalletItemType.LendingAndBorrowing,
                    Protocol = protocol,
                    Position = new Position { Label = "Supplied", Tokens = new List<Token> { suppliedToken } },
                    AdditionalData = new AdditionalData { IsCollateral = supply.IsCollateral, CanBeCollateral = supply.CanBeCollateral }
                });
            }
            catch (Exception ex) { Console.WriteLine($"Error processing Aave supply for {supply.Currency?.Symbol}: {ex.Message}"); }
        }
        return await Task.FromResult(walletItems);
    }

    private static decimal SafeDivide(decimal num, decimal den) { if (den == 0) return 0; try { var r = num / den; return r > 1_000_000m ? 1_000_000m : r; } catch { return 0; } }
    private static int GetTokenDecimals(string? symbol, string? address) => string.IsNullOrEmpty(symbol) ? 18 : symbol.ToUpperInvariant() switch { "USDC" => 6, "USDT" => 6, "DAI" => 18, "WETH" => 18, "ETH" => 18, "WBTC" => 8, "BTC" => 8, _ => 18 };
}