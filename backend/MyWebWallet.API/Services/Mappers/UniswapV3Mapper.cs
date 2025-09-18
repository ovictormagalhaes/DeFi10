using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Interfaces;
using System.Numerics;
using System.Globalization;
using ChainEnum = MyWebWallet.API.Models.Chain;

namespace MyWebWallet.API.Services.Mappers;

public class UniswapV3Mapper : IWalletItemMapper<UniswapV3GetActivePoolsResponse>
{
    private readonly IUniswapV3OnChainService _uniswapV3OnChainService;

    public UniswapV3Mapper(IUniswapV3OnChainService uniswapV3OnChainService)
    {
        _uniswapV3OnChainService = uniswapV3OnChainService;
    }

    public string ProtocolName => "UniswapV3";
    public string GetProtocolName() => ProtocolName;

    public bool SupportsChain(ChainEnum chain)
    {
        return GetSupportedChains().Contains(chain);
    }

    public IEnumerable<ChainEnum> GetSupportedChains()
    {
        // Uniswap V3 is currently only supported on Base in this implementation
        return new[] { ChainEnum.Base };
    }

    public async Task<List<WalletItem>> MapAsync(UniswapV3GetActivePoolsResponse response, ChainEnum chain)
    {
        if (!SupportsChain(chain))
            throw new NotSupportedException($"Chain {chain} is not supported by {GetProtocolName()}");

        if (response?.Data?.Positions == null) return new List<WalletItem>();

        decimal.TryParse(response.Data.Bundles?.FirstOrDefault()?.NativePriceUSD, NumberStyles.Float, CultureInfo.InvariantCulture, out var nativePriceUSD);
        var walletItems = new List<WalletItem>();

        foreach (var position in response.Data.Positions)
        {
            await Task.Delay(1000); // Rate limiting

            var walletItem = await ProcessPositionAsync(position, chain, nativePriceUSD);
            if (walletItem != null)
                walletItems.Add(walletItem);
        }

        return walletItems;
    }

    private async Task<WalletItem?> ProcessPositionAsync(UniswapV3Position position, ChainEnum chain, decimal nativePriceUSD)
    {
        try
        {
            int.TryParse(position.Token0.Decimals, NumberStyles.Integer, CultureInfo.InvariantCulture, out var token0Decimals);
            int.TryParse(position.Token1.Decimals, NumberStyles.Integer, CultureInfo.InvariantCulture, out var token1Decimals);

            decimal.TryParse(position.DepositedToken0, NumberStyles.Float, CultureInfo.InvariantCulture, out var depositedToken0);
            decimal.TryParse(position.WithdrawnToken0, NumberStyles.Float, CultureInfo.InvariantCulture, out var withdrawnToken0);
            decimal.TryParse(position.DepositedToken1, NumberStyles.Float, CultureInfo.InvariantCulture, out var depositedToken1);
            decimal.TryParse(position.WithdrawnToken1, NumberStyles.Float, CultureInfo.InvariantCulture, out var withdrawnToken1);

            var currentSupplyToken0 = depositedToken0 - withdrawnToken0;
            var currentSupplyToken1 = depositedToken1 - withdrawnToken1;

            decimal.TryParse(position.Token0.DerivedNative, NumberStyles.Float, CultureInfo.InvariantCulture, out var token0DerivedNative);
            decimal.TryParse(position.Token1.DerivedNative, NumberStyles.Float, CultureInfo.InvariantCulture, out var token1DerivedNative);

            var token0PriceUSD = nativePriceUSD * token0DerivedNative;
            var token1PriceUSD = nativePriceUSD * token1DerivedNative;

            var positionToken0ValueUSD = currentSupplyToken0 * token0PriceUSD;
            var positionToken1ValueUSD = currentSupplyToken1 * token1PriceUSD;

            if (!BigInteger.TryParse(position.Id, NumberStyles.Integer, CultureInfo.InvariantCulture, out var tokenId)) return null;

            // Execute blockchain calls in parallel using Task.WhenAll
            var chainInformationTask = _uniswapV3OnChainService.GetPositionAsync(tokenId);
            var poolFeeGrowthTask = _uniswapV3OnChainService.GetPoolFeeGrowthAsync(position.Pool.Id);
            var currentTickTask = _uniswapV3OnChainService.GetCurrentTickAsync(position.Pool.Id);
            var tickRangeInfoTask = _uniswapV3OnChainService.GetTickRangeInfoAsync(
                position.Pool.Id, (int)position.TickLower, (int)position.TickUpper);

            await Task.WhenAll(chainInformationTask, poolFeeGrowthTask, currentTickTask, tickRangeInfoTask);

            var chainInformation = await chainInformationTask;
            var (feeGrowthGlobal0X128, feeGrowthGlobal1X128) = await poolFeeGrowthTask;
            var currentTick = await currentTickTask;
            var (lowerTickInfo, upperTickInfo) = await tickRangeInfoTask;

            var uncollectedFees = new UncollectedFees().CalculateUncollectedFees(
                chainInformation,
                feeGrowthGlobal0X128,
                feeGrowthGlobal1X128,
                token0Decimals,
                token1Decimals,
                currentTick,
                lowerTickInfo,
                upperTickInfo);

            // On-chain extras into AdditionalData
            int? tickSpacing = null; if (int.TryParse(position.Pool?.TickSpacing, NumberStyles.Integer, CultureInfo.InvariantCulture, out var ts)) tickSpacing = ts;
            long? createdAt = null; if (long.TryParse(position.Pool?.CreatedAtUnix, NumberStyles.Integer, CultureInfo.InvariantCulture, out var ca)) createdAt = ca;
            var sqrtPriceX96 = string.IsNullOrEmpty(position.Pool?.SqrtPriceX96) ? null : position.Pool!.SqrtPriceX96;

            // Range values
            decimal? lower = null, upper = null, current = null; bool? inRange = null;
            if (decimal.TryParse(position.MinPriceToken1PerToken0, NumberStyles.Float, CultureInfo.InvariantCulture, out var minP)) lower = minP;
            if (decimal.TryParse(position.MaxPriceToken1PerToken0, NumberStyles.Float, CultureInfo.InvariantCulture, out var maxP)) upper = maxP;
            if (decimal.TryParse(position.CurrentPriceToken1PerToken0, NumberStyles.Float, CultureInfo.InvariantCulture, out var curP)) current = curP;
            if (!string.IsNullOrEmpty(position.RangeStatus)) inRange = position.RangeStatus.Equals("in-range", StringComparison.OrdinalIgnoreCase);

            return new WalletItem
            {
                Type = WalletItemType.LiquidityPool,
                Protocol = GetProtocol(chain),
                Position = new Position
                {
                    Label = "Liquidity Pool",
                    Tokens = new List<Token>
                    {
                        new Token
                        {
                            Type = TokenType.Supplied,
                            Name = position.Token0.Name,
                            Symbol = position.Token0.Symbol,
                            ContractAddress = position.Token0.Id,
                            Chain = chain.ToChainId(),
                            Financials = new TokenFinancials
                            {
                                DecimalPlaces = token0Decimals,
                                Amount = currentSupplyToken0 * (decimal)Math.Pow(10, token0Decimals),
                                BalanceFormatted = currentSupplyToken0,
                                Price = token0PriceUSD,
                                TotalPrice = positionToken0ValueUSD
                            }
                        },
                        new Token
                        {
                            Type = TokenType.Supplied,
                            Name = position.Token1.Name,
                            Symbol = position.Token1.Symbol,
                            ContractAddress = position.Token1.Id,
                            Chain = chain.GetDisplayName(),
                            Financials = new TokenFinancials
                            {
                                DecimalPlaces = token1Decimals,
                                Amount = currentSupplyToken1 * (decimal)Math.Pow(10, token1Decimals),
                                BalanceFormatted = currentSupplyToken1,
                                Price = token1PriceUSD,
                                TotalPrice = positionToken1ValueUSD
                            }
                        },
                        new Token
                        {
                            Type = TokenType.Reward,
                            Name = position.Token0.Name,
                            Symbol = position.Token0.Symbol,
                            ContractAddress = position.Token0.Id,
                            Chain = chain.GetDisplayName(),
                            Financials = new TokenFinancials
                            {
                                DecimalPlaces = token0Decimals,
                                Amount = uncollectedFees.Amount0,
                                BalanceFormatted = uncollectedFees.Amount0,
                                Price = token0PriceUSD,
                                TotalPrice = uncollectedFees.Amount0 * token0PriceUSD
                            }
                        },
                        new Token
                        {
                            Type = TokenType.Reward,
                            Name = position.Token1.Name,
                            Symbol = position.Token1.Symbol,
                            ContractAddress = position.Token1.Id,
                            Chain = chain.GetDisplayName(),
                            Financials = new TokenFinancials
                            {
                                DecimalPlaces = token1Decimals,
                                Amount = uncollectedFees.Amount1,
                                BalanceFormatted = uncollectedFees.Amount1,
                                Price = token1PriceUSD,
                                TotalPrice = uncollectedFees.Amount1 * token1PriceUSD
                            }
                        }
                    }
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
                    }
                }
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ERROR: UniswapV3Mapper: Failed to process position {position.Id}: {ex.Message}");
            return null;
        }
    }

    private static Protocol GetProtocol(ChainEnum chain) => new()
    {
        Name = "Uniswap V3",
        Chain = chain.GetDisplayName(),
        Id = "uniswap-v3",
        Url = "https://app.uniswap.org",
        Logo = "https://cdn.moralis.io/defi/uniswap.png"
    };
}