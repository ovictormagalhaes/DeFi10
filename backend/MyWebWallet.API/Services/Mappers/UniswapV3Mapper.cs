using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Interfaces;
using System.Globalization;
using ChainEnum = MyWebWallet.API.Models.Chain;
using Microsoft.Extensions.Logging;
using MyWebWallet.API.Aggregation;

namespace MyWebWallet.API.Services.Mappers;

public class UniswapV3Mapper : IWalletItemMapper<UniswapV3GetActivePoolsResponse>
{
    private readonly IUniswapV3OnChainService _uniswapV3OnChainService;
    private readonly ILogger<UniswapV3Mapper> _logger;
    private readonly ITokenFactory _tokenFactory;
    private readonly IUniswapV3FeesService _feesService;

    private static readonly HashSet<ChainEnum> Supported = new() { ChainEnum.Base, ChainEnum.Arbitrum };

    public UniswapV3Mapper(IUniswapV3OnChainService uniswapV3OnChainService, ILogger<UniswapV3Mapper> logger, ITokenFactory tokenFactory, IUniswapV3FeesService feesService)
    {
        _uniswapV3OnChainService = uniswapV3OnChainService;
        _logger = logger;
        _tokenFactory = tokenFactory;
        _feesService = feesService;
    }

    public string ProtocolName => "UniswapV3";
    public string GetProtocolName() => ProtocolName;

    public bool SupportsChain(ChainEnum chain) => Supported.Contains(chain);
    public IEnumerable<ChainEnum> GetSupportedChains() => Supported;

    public async Task<List<WalletItem>> MapAsync(UniswapV3GetActivePoolsResponse response, ChainEnum chain)
    {
        if (!SupportsChain(chain)) throw new NotSupportedException($"Chain {chain} is not supported by {GetProtocolName()}");
        if (response?.Data?.Positions == null) return new List<WalletItem>();

        var nativePriceUSD = TryParseInvariant(response.Data.Bundles?.FirstOrDefault()?.NativePriceUSD) ?? 0m;
        if (nativePriceUSD <= 0) _logger.LogWarning("UniV3 nativePriceUSD=0 chain={Chain}", chain);
        else _logger.LogDebug("UniV3 nativePriceUSD={Price} chain={Chain}", nativePriceUSD, chain);

        var walletItems = new List<WalletItem>();
        foreach (var position in response.Data.Positions)
        {
            var item = ProcessPosition(position, chain, nativePriceUSD);
            if (item != null)
            {
                try
                {
                    var token0PriceUsd = item.Position?.Tokens?.FirstOrDefault(t => t.Symbol == position.Token0.Symbol)?.Financials?.Price ?? 0m;
                    var token1PriceUsd = item.Position?.Tokens?.FirstOrDefault(t => t.Symbol == position.Token1.Symbol)?.Financials?.Price ?? 0m;
                    var fees24h = await _feesService.GetFees24hUsdAsync(position, chain, token0PriceUsd, token1PriceUsd);
                    if (fees24h.HasValue && fees24h.Value > 0)
                    {
                        item.AdditionalData ??= new AdditionalData();
                        item.AdditionalData.Fees24h = fees24h.Value;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Fees24h calculation failed pos={Id}", position.Id);
                }
                walletItems.Add(item);
            }
        }
        return await Task.FromResult(walletItems);
    }

    private WalletItem? ProcessPosition(UniswapV3Position position, ChainEnum chain, decimal nativePriceUSD)
    {
        try
        {
            int token0Decimals = (int)(TryParseInvariantInt(position.Token0.Decimals) ?? 0);
            int token1Decimals = (int)(TryParseInvariantInt(position.Token1.Decimals) ?? 0);

            var depositedToken0 = TryParseInvariant(position.DepositedToken0) ?? 0m;
            var withdrawnToken0 = TryParseInvariant(position.WithdrawnToken0) ?? 0m;
            var depositedToken1 = TryParseInvariant(position.DepositedToken1) ?? 0m;
            var withdrawnToken1 = TryParseInvariant(position.WithdrawnToken1) ?? 0m;
            var currentSupplyToken0 = depositedToken0 - withdrawnToken0;
            var currentSupplyToken1 = depositedToken1 - withdrawnToken1;

            var feesToken0 = TryParseInvariant(position.CollectedFeesToken0) ?? 0m;
            var feesToken1 = TryParseInvariant(position.CollectedFeesToken1) ?? 0m;

            var token0DerivedNative = TryParseInvariant(position.Token0.DerivedNative) ?? 0m;
            var token1DerivedNative = TryParseInvariant(position.Token1.DerivedNative) ?? 0m;

            var ratioT1PerT0 = TryParseInvariant(position.CurrentPriceToken1PerToken0) ?? 0m;

            var token0PriceUSD = nativePriceUSD * token0DerivedNative;
            var token1PriceUSD = nativePriceUSD * token1DerivedNative;

            bool ratioDerived0 = false;
            bool ratioDerived1 = false;

            if (ratioT1PerT0 > 0)
            {
                if (token0PriceUSD > 0 && token1PriceUSD <= 0)
                {
                    token1PriceUSD = token0PriceUSD / ratioT1PerT0;
                    ratioDerived1 = true;
                }
                else if (token1PriceUSD > 0 && token0PriceUSD <= 0)
                {
                    token0PriceUSD = token1PriceUSD * ratioT1PerT0;
                    ratioDerived0 = true;
                }
            }

            bool priceUnavailable = false;
            if (token0PriceUSD <= 0 && token1PriceUSD <= 0)
            {
                priceUnavailable = true;
                _logger.LogDebug("UniV3 price missing pos={Id} t0={T0} t1={T1} ratio={Ratio} nativeUSD={Native}", position.Id, position.Token0.Symbol, position.Token1.Symbol, ratioT1PerT0, nativePriceUSD);
            }

            if (ratioDerived0 || ratioDerived1)
            {
                _logger.LogTrace("UniV3 ratio fallback pos={Id} t0={T0}:{P0} der0={Der0} t1={T1}:{P1} der1={Der1} ratio={Ratio}", position.Id, position.Token0.Symbol, token0PriceUSD, ratioDerived0, position.Token1.Symbol, token1PriceUSD, ratioDerived1, ratioT1PerT0);
            }

            if (token0PriceUSD < 0) token0PriceUSD = 0;
            if (token1PriceUSD < 0) token1PriceUSD = 0;

            var lower = TryParseInvariant(position.MinPriceToken1PerToken0);
            var upper = TryParseInvariant(position.MaxPriceToken1PerToken0);
            var current = TryParseInvariant(position.CurrentPriceToken1PerToken0);
            bool? inRange = position.RangeStatus?.Equals("in-range", StringComparison.OrdinalIgnoreCase);

            int? tickSpacing = TryParseInvariantInt(position.Pool?.TickSpacing);
            long? createdAt = TryParseInvariantLong(position.Pool?.CreatedAtUnix);
            var sqrtPriceX96 = string.IsNullOrEmpty(position.Pool?.SqrtPriceX96) ? null : position.Pool!.SqrtPriceX96;

            var supplied0 = _tokenFactory.CreateSupplied(position.Token0.Name, position.Token0.Symbol, position.Token0.Id, chain, token0Decimals, currentSupplyToken0, token0PriceUSD);
            var supplied1 = _tokenFactory.CreateSupplied(position.Token1.Name, position.Token1.Symbol, position.Token1.Id, chain, token1Decimals, currentSupplyToken1, token1PriceUSD);
            var reward0 = _tokenFactory.CreateUncollectedReward(position.Token0.Name, position.Token0.Symbol, position.Token0.Id, chain, token0Decimals, feesToken0, token0PriceUSD);
            var reward1 = _tokenFactory.CreateUncollectedReward(position.Token1.Name, position.Token1.Symbol, position.Token1.Id, chain, token1Decimals, feesToken1, token1PriceUSD);

            return new WalletItem
            {
                Type = WalletItemType.LiquidityPool,
                Protocol = GetProtocol(chain),
                Position = new Position
                {
                    Label = "Liquidity Pool",
                    Tokens =
                    [
                        supplied0,
                        supplied1,
                        reward0,
                        reward1
                    ]
                },
                AdditionalData = new AdditionalData
                {
                    TickSpacing = tickSpacing,
                    SqrtPriceX96 = sqrtPriceX96,
                    CreatedAt = createdAt,
                    Range = new RangeInfo
                    {
                        Lower = lower,
                        Upper = upper,
                        Current = current,
                        InRange = inRange
                    },
                    PriceUnavailable = priceUnavailable
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "UniV3 process position failed id={Id}", position.Id);
            return null;
        }
    }

    private static decimal? TryParseInvariant(string? s)
        => decimal.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var v) ? v : null;
    private static int? TryParseInvariantInt(string? s)
        => int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) ? v : null;
    private static long? TryParseInvariantLong(string? s)
        => long.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) ? v : null;

    private static Protocol GetProtocol(ChainEnum chain) => new()
    {
        Name = "Uniswap V3",
        Chain = chain.ToChainId(),
        Id = "uniswap-v3",
        Url = "https://app.uniswap.org",
        Logo = "https://cdn.moralis.io/defi/uniswap.png"
    };
}