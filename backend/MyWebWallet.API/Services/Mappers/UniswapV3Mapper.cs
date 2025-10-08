using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Interfaces;
using System.Globalization;
using ChainEnum = MyWebWallet.API.Models.Chain;
using MyWebWallet.API.Aggregation;

namespace MyWebWallet.API.Services.Mappers;

public class UniswapV3Mapper : IWalletItemMapper<UniswapV3GetActivePoolsResponse>
{
    private readonly IUniswapV3OnChainService _uniswapV3OnChainService;
    private readonly ILogger<UniswapV3Mapper> _logger;
    private readonly ITokenFactory _tokenFactory;

    private static readonly HashSet<ChainEnum> Supported = new() { ChainEnum.Base, ChainEnum.Arbitrum };

    public UniswapV3Mapper(IUniswapV3OnChainService uniswapV3OnChainService, ILogger<UniswapV3Mapper> logger, ITokenFactory tokenFactory)
    {
        _uniswapV3OnChainService = uniswapV3OnChainService;
        _logger = logger;
        _tokenFactory = tokenFactory;
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

            // Usar valores calculados de uncollected fees em vez dos CollectedFees (que estão sempre 0)
            var feesToken0 = TryParseInvariant(position.EstimatedUncollectedToken0) ?? 0m;
            var feesToken1 = TryParseInvariant(position.EstimatedUncollectedToken1) ?? 0m;

            // Validar e limitar valores extremos para evitar overflows
            currentSupplyToken0 = ValidateTokenAmount(currentSupplyToken0, position.Id, "currentSupplyToken0");
            currentSupplyToken1 = ValidateTokenAmount(currentSupplyToken1, position.Id, "currentSupplyToken1");
            feesToken0 = ValidateTokenAmount(feesToken0, position.Id, "feesToken0");
            feesToken1 = ValidateTokenAmount(feesToken1, position.Id, "feesToken1");

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
                    token1PriceUSD = SafeDivide(token0PriceUSD, ratioT1PerT0);
                    ratioDerived1 = true;
                }
                else if (token1PriceUSD > 0 && token0PriceUSD <= 0)
                {
                    token0PriceUSD = SafeMultiply(token1PriceUSD, ratioT1PerT0);
                    ratioDerived0 = true;
                }
            }

            bool priceUnavailable = false;
            if (token0PriceUSD <= 0 && token1PriceUSD <= 0)
            {
                priceUnavailable = true;
                _logger.LogDebug("UniV3 price missing pos={Id} t0={T0} t1={T1} ratio={Ratio} nativeUSD={Native}", position.Id, position.Token0.Symbol, position.Token1.Symbol, ratioT1PerT0, nativePriceUSD);
            }

            // Se não conseguimos determinar preços via nativePrice, tentar detectar tokens conhecidos
            // mas apenas se não houve erro de chain inválida
            if (token0PriceUSD <= 0 && token1PriceUSD <= 0 && nativePriceUSD <= 0 && !priceUnavailable)
            {
                // Tentar identificar tokens por símbolo/endereço e aplicar preços aproximados
                token0PriceUSD = EstimatePriceByToken(position.Token0.Symbol, position.Token0.Id, chain);
                token1PriceUSD = EstimatePriceByToken(position.Token1.Symbol, position.Token1.Id, chain);
                
                if (token0PriceUSD > 0 || token1PriceUSD > 0)
                {
                    _logger.LogInformation("UniV3 using fallback prices pos={Id} t0={T0}:{P0} t1={T1}:{P1}", 
                        position.Id, position.Token0.Symbol, token0PriceUSD, position.Token1.Symbol, token1PriceUSD);
                    priceUnavailable = false; // Temos pelo menos um preço
                }
            }
            
            // Se ainda não temos preços mas a posição parece válida, tentar fallback mais agressivo
            if (token0PriceUSD <= 0 && token1PriceUSD <= 0)
            {
                token0PriceUSD = EstimatePriceByToken(position.Token0.Symbol, position.Token0.Id, chain);
                token1PriceUSD = EstimatePriceByToken(position.Token1.Symbol, position.Token1.Id, chain);
                
                if (token0PriceUSD > 0 || token1PriceUSD > 0)
                {
                    _logger.LogInformation("UniV3 using fallback prices pos={Id} t0={T0}:{P0} t1={T1}:{P1}", 
                        position.Id, position.Token0.Symbol, token0PriceUSD, position.Token1.Symbol, token1PriceUSD);
                    priceUnavailable = false; // Temos pelo menos um preço
                }
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

    /// <summary>
    /// Valida e limita amounts de token para evitar overflows
    /// </summary>
    private decimal ValidateTokenAmount(decimal amount, string positionId, string fieldName)
    {
        const decimal MAX_REASONABLE_AMOUNT = 100_000_000m; // 100 milhões como limite mais conservador

        if (amount > MAX_REASONABLE_AMOUNT)
        {
            _logger.LogWarning("UniV3 capping extreme amount pos={Id} field={Field} original={Original} capped={Capped}", 
                positionId, fieldName, amount, MAX_REASONABLE_AMOUNT);
            return MAX_REASONABLE_AMOUNT;
        }

        if (amount < 0)
        {
            _logger.LogWarning("UniV3 negative amount pos={Id} field={Field} amount={Amount}", 
                positionId, fieldName, amount);
            return 0;
        }

        // Log valores suspeitos
        if (amount > 1_000_000) // Log se > 1 milhão
        {
            _logger.LogInformation("UniV3 large amount detected pos={Id} field={Field} amount={Amount}", 
                positionId, fieldName, amount);
        }

        return amount;
    }

    /// <summary>
    /// Multiplicação segura que evita overflow
    /// </summary>
    private static decimal SafeMultiply(decimal a, decimal b)
    {
        try
        {
            if (a == 0 || b == 0) return 0;
            
            // Check if multiplication would overflow
            if (a > 0 && b > 0 && a > decimal.MaxValue / b)
                return decimal.MaxValue;
            if (a < 0 && b < 0 && a < decimal.MaxValue / b)
                return decimal.MaxValue;
            if ((a > 0 && b < 0 && b < decimal.MinValue / a) || 
                (a < 0 && b > 0 && a < decimal.MinValue / b))
                return decimal.MinValue;

            return a * b;
        }
        catch (OverflowException)
        {
            return a > 0 == b > 0 ? decimal.MaxValue : decimal.MinValue;
        }
    }

    /// <summary>
    /// Divisão segura que evita overflow
    /// </summary>
    private static decimal SafeDivide(decimal a, decimal b)
    {
        try
        {
            if (b == 0) return 0;
            return a / b;
        }
        catch (OverflowException)
        {
            return a > 0 == b > 0 ? decimal.MaxValue : decimal.MinValue;
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

    /// <summary>
    /// Estima preço de token baseado em símbolo/endereço conhecidos
    /// </summary>
    private static decimal EstimatePriceByToken(string symbol, string address, ChainEnum chain)
    {
        var sym = symbol?.ToUpperInvariant();
        var addr = address?.ToLowerInvariant();
        
        // Preços aproximados para tokens conhecidos (Base chain)
        if (chain == ChainEnum.Base)
        {
            return sym switch
            {
                "WETH" when addr == "0x4200000000000000000000000000000000000006" => 4500m, // WETH aproximado
                "USDC" when addr == "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" => 1.0m,   // USDC
                "AAVE" when addr == "0x63706e401c06ac8513145b7687a14804d17f814b" => 285m,   // AAVE aproximado
                "cbBTC" when addr == "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf" => 125000m, // cbBTC aproximado
                _ => 0m
            };
        }
        
        // Preços aproximados para tokens conhecidos (Arbitrum chain)
        if (chain == ChainEnum.Arbitrum)
        {
            return sym switch
            {
                "WETH" when addr == "0x82af49447d8a07e3bd95bd0d56f35241523fbab1" => 4500m, // WETH aproximado
                "PENDLE" when addr == "0x0c880f6761f1af8d9aa9c466984b80dab9a8c9e8" => 4.7m,  // PENDLE aproximado
                "USDC" => 1.0m, // USDC genérico
                _ => 0m
            };
        }
        
        return 0m;
    }
}