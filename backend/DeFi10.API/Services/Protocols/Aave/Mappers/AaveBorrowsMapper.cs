using DeFi10.API.Models;
using ChainEnum = DeFi10.API.Models.Chain;
using DeFi10.API.Aggregation;
using System.Globalization;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Protocols.Aave.Models;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Helpers;

namespace DeFi10.API.Services.Protocols.Aave.Mappers;

public class AaveBorrowsMapper : IWalletItemMapper<AaveGetUserBorrowsResponse>
{
    private readonly ITokenFactory _tokenFactory;
    private readonly IProtocolConfigurationService _protocolConfig;
    private readonly IChainConfigurationService _chainConfig;
    private readonly IProjectionCalculator _projectionCalculator;

    public AaveBorrowsMapper(ITokenFactory tokenFactory, IProtocolConfigurationService protocolConfig, IChainConfigurationService chainConfig, IProjectionCalculator projectionCalculator)
    { _tokenFactory = tokenFactory; _protocolConfig = protocolConfig; _chainConfig = chainConfig; _projectionCalculator = projectionCalculator; }

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

    public async Task<List<WalletItem>> MapAsync(AaveGetUserBorrowsResponse response, ChainEnum chain)
    {
        if (!SupportsChain(chain)) return new List<WalletItem>();
        if (response?.Data?.UserBorrows == null) return new List<WalletItem>();
        var protocol = GetProtocolDefinition(chain);
        var walletItems = new List<WalletItem>();
        foreach (var borrow in response.Data.UserBorrows)
        {
            try
            {
                if (!decimal.TryParse(borrow.Debt.Amount.Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var amountFormatted)) continue;
                if (!decimal.TryParse(borrow.Debt.Usd, NumberStyles.Float, CultureInfo.InvariantCulture, out var totalPriceUsd)) continue;
                if (amountFormatted <= 0) continue;
                decimal unitPrice = amountFormatted > 0 && totalPriceUsd >= 0 ? SafeDivide(totalPriceUsd, amountFormatted) : 0;
                int decimals = GetTokenDecimals(borrow.Currency.Symbol, borrow.Currency.Address);
                var borrowedToken = _tokenFactory.CreateBorrowed(
                    borrow.Currency.Name ?? string.Empty,
                    borrow.Currency.Symbol ?? string.Empty,
                    borrow.Currency.Address ?? string.Empty,
                    chain,
                    decimals,
                    amountFormatted,
                    unitPrice);
                
                // Extract Net APY from borrow APY (for borrows, APY is negative as it's a cost)
                decimal? apy = null;
                if (decimal.TryParse(borrow.Apy.Formatted, NumberStyles.Float, CultureInfo.InvariantCulture, out var apyValue))
                {
                    apy = -apyValue;
                }
                
                var projection = _projectionCalculator.CalculateApyProjection(totalPriceUsd, apy);
                
                walletItems.Add(new WalletItem
                {
                    Type = WalletItemType.LendingAndBorrowing,
                    Protocol = protocol,
                    Position = new Position { Label = "Borrowed", Tokens = new List<Token> { borrowedToken } },
                    AdditionalData = new AdditionalData()
                    {
                        Apy = apy,
                        Projections = projection != null ? new List<ProjectionData> 
                        {
                            _projectionCalculator.CreateProjectionData(
                                ProjectionType.Apy,
                                projection,
                                new ProjectionMetadata { Apy = apy }
                            )
                        } : null
                    }
                });
            }
            catch (Exception ex) { Console.WriteLine($"Error processing Aave borrow for {borrow.Currency?.Symbol}: {ex.Message}"); }
        }
        return await Task.FromResult(walletItems);
    }

    private static decimal SafeDivide(decimal num, decimal den) { if (den == 0) return 0; try { var r = num / den; return r > 1_000_000m ? 1_000_000m : r; } catch { return 0; } }
    private static int GetTokenDecimals(string? symbol, string? address) => string.IsNullOrEmpty(symbol) ? 18 : symbol.ToUpperInvariant() switch { "USDC" => 6, "USDT" => 6, "DAI" => 18, "WETH" => 18, "ETH" => 18, "WBTC" => 8, "BTC" => 8, _ => 18 };
}