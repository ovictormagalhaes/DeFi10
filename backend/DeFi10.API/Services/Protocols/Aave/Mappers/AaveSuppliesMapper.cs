using DeFi10.API.Models;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Aggregation;
using System.Globalization;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Protocols.Aave.Models.Supplies;

namespace DeFi10.API.Services.Protocols.Aave.Mappers;

public class AaveSuppliesMapper : IWalletItemMapper<AaveGetUserSuppliesResponse>
{
    private readonly ITokenFactory _tokenFactory;
    private readonly IProtocolConfigurationService _protocolConfig;
    private readonly IChainConfigurationService _chainConfig;

    public AaveSuppliesMapper(ITokenFactory tokenFactory, IProtocolConfigurationService protocolConfig, IChainConfigurationService chainConfig)
    { _tokenFactory = tokenFactory; _protocolConfig = protocolConfig; _chainConfig = chainConfig; }

    public bool SupportsChain(ChainEnum chain) => 
        _protocolConfig.IsChainEnabledForProtocol(ProtocolNames.AaveV3, chain);
    
    public IEnumerable<ChainEnum> GetSupportedChains() => 
        _protocolConfig.GetEnabledChainEnums(ProtocolNames.AaveV3);

    public Protocol GetProtocolDefinition(ChainEnum chain)
    {
        if (!SupportsChain(chain)) throw new InvalidOperationException($"Protocol {ProtocolNames.AaveV3} disabled on chain {chain}");
        var def = _protocolConfig.GetProtocol(ProtocolNames.AaveV3) ?? throw new InvalidOperationException($"Protocol definition not found: {ProtocolNames.AaveV3}");
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