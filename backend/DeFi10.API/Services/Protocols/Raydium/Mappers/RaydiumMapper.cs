using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Models;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Core.Solana;
using DeFi10.API.Services.Domain;
using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Helpers;
using DeFi10.API.Services.Protocols.Raydium.Models;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Protocols.Raydium.Mappers
{
    public sealed class RaydiumMapper : IWalletItemMapper<IEnumerable<RaydiumPosition>>
    {
        private readonly ITokenFactory _tokenFactory;
        private readonly ILogger<RaydiumMapper> _logger;
        private readonly ITokenMetadataService _metadataService;
        private readonly WalletItemLabelEnricher _labelEnricher;
        private readonly IProtocolConfigurationService _protocolConfig;
        private readonly IChainConfigurationService _chainConfig;
        private readonly IProjectionCalculator _projectionCalculator;

        public RaydiumMapper(
            ITokenFactory tokenFactory,
            ILogger<RaydiumMapper> logger,
            ITokenMetadataService metadataService,
            WalletItemLabelEnricher labelEnricher,
            IProtocolConfigurationService protocolConfig,
            IChainConfigurationService chainConfig,
            IProjectionCalculator projectionCalculator)
        {
            _tokenFactory = tokenFactory;
            _logger = logger;
            _metadataService = metadataService;
            _labelEnricher = labelEnricher;
            _protocolConfig = protocolConfig;
            _chainConfig = chainConfig;
            _projectionCalculator = projectionCalculator;
        }

        public bool SupportsChain(ChainEnum chain) => GetSupportedChains().Contains(chain);

        public IEnumerable<ChainEnum> GetSupportedChains() =>
            _protocolConfig.GetEnabledChainEnums(ProtocolNames.Raydium);

        public Protocol GetProtocolDefinition(ChainEnum chain)
        {
            var def = _protocolConfig.GetProtocol(ProtocolNames.Raydium)
                ?? throw new InvalidOperationException($"Protocol definition not found: {ProtocolNames.Raydium}");
            return def.ToProtocol(chain, _chainConfig);
        }

        public async Task<List<WalletItem>> MapAsync(IEnumerable<RaydiumPosition> input, ChainEnum chain)
        {
            _logger.LogInformation("========== RAYDIUM MAPPER: Starting mapping ==========");

            if (input == null || !input.Any())
            {
                _logger.LogWarning("RAYDIUM MAPPER: Input is null or empty!");
                return new List<WalletItem>();
            }

            _logger.LogInformation("RAYDIUM MAPPER: Input has {Count} positions", input.Count());

            var walletItems = new List<WalletItem>();

            foreach (var (p, idx) in input.Select((p, i) => (p, i)))
            {
                _logger.LogInformation("RAYDIUM MAPPER: Processing position {Index}: Pool={Pool}, TokenCount={TokenCount}",
                    idx, p.Pool, p.Tokens?.Count ?? 0);

                if (p.Tokens == null || !p.Tokens.Any())
                {
                    _logger.LogWarning("RAYDIUM MAPPER: Position {Index} has no tokens!", idx);
                    continue;
                }

                var tokens = new List<Token>();

                foreach (var t in p.Tokens)
                {
                    var metadata = await _metadataService.GetTokenMetadataAsync(chain, t.Mint);

                    string? symbol = metadata?.Symbol ?? t.Symbol;
                    string? name = metadata?.Name ?? t.Name;
                    string? logo = metadata?.LogoUrl ?? t.Logo;

                    decimal? priceUsd = t.PriceUsd;
                    if (!priceUsd.HasValue || priceUsd.Value == 0)
                    {
                        priceUsd = await _metadataService.GetTokenPriceAsync(t.Mint);

                        if (!priceUsd.HasValue && !string.IsNullOrEmpty(symbol))
                            priceUsd = await _metadataService.GetTokenPriceAsync(symbol);

                        if (!priceUsd.HasValue && !string.IsNullOrEmpty(name))
                            priceUsd = await _metadataService.GetTokenPriceAsync(name);
                    }

                    var formattedAmount = t.Decimals > 0
                        ? t.Amount / (decimal)Math.Pow(10, t.Decimals)
                        : t.Amount;

                    _logger.LogInformation(
                        "RAYDIUM MAPPER: Token mint={Mint}, symbol={Symbol}, name={Name}, hasLogo={HasLogo}, price={Price}, amount={Amount}, type={Type}",
                        t.Mint, symbol ?? "null", name ?? "null", logo != null, priceUsd ?? 0, formattedAmount, t.Type);

                    Token token;
                    if (t.Type == TokenType.LiquidityUncollectedFee)
                    {
                        token = _tokenFactory.CreateUncollectedReward(
                            name ?? string.Empty,
                            symbol ?? string.Empty,
                            t.Mint,
                            chain,
                            t.Decimals,
                            formattedAmount,
                            priceUsd ?? 0
                        );
                    }
                    else if (t.Type == TokenType.LiquidityCollectedFee)
                    {
                        token = _tokenFactory.CreateCollectedFee(
                            name ?? string.Empty,
                            symbol ?? string.Empty,
                            t.Mint,
                            chain,
                            t.Decimals,
                            formattedAmount,
                            priceUsd ?? 0
                        );
                    }
                    else
                    {
                        token = _tokenFactory.CreateSupplied(
                            name ?? string.Empty,
                            symbol ?? string.Empty,
                            t.Mint,
                            chain,
                            t.Decimals,
                            formattedAmount,
                            priceUsd ?? 0
                        );
                    }
                    token.Logo = logo;

                    tokens.Add(token);
                }

                // Calculate range info to determine if position is in range
                var rangeInfo = CalculateRange(p.TickLower, p.TickUpper, p.TickCurrent, p.Tokens);
                
                // Calculate total position value (sum only Supplied tokens, not fees)
                var totalValueUsd = tokens
                    .Where(t => t.Type == TokenType.Supplied)
                    .Sum(t => t.Financials?.TotalPrice ?? 0m);
                
                // APR is only earned when position is in range
                var effectiveApr = rangeInfo.InRange == true ? (p.Apr ?? 0m) : 0m;

                // Build multiple projections
                var projections = new List<ProjectionData>();

                // 1. APR-based projection
                if (effectiveApr > 0 && totalValueUsd > 0)
                {
                    var aprProjection = _projectionCalculator.CalculateAprProjection(totalValueUsd, effectiveApr);
                    if (aprProjection != null)
                    {
                        projections.Add(_projectionCalculator.CreateProjectionData(
                            ProjectionType.Apr,
                            aprProjection,
                            new ProjectionMetadata { Apr = effectiveApr }
                        ));
                    }
                }

                // 2. AprHistorical-based projection (historical fees)
                decimal? calculatedAprHistorical = null;
                if (p.CreatedAt.HasValue && p.CreatedAt.Value > 0 && totalValueUsd > 0)
                {
                    // Calculate total fees (collected + uncollected)
                    var totalFees = tokens
                        .Where(t => t.Type == TokenType.LiquidityCollectedFee || 
                                    t.Type == TokenType.LiquidityUncollectedFee)
                        .Sum(t => t.Financials?.TotalPrice ?? 0m);

                    if (totalFees > 0)
                    {
                        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                        var (aprHistoricalProjection, aprHistorical) = _projectionCalculator.CalculateAprHistoricalProjection(
                            totalFees,
                            totalValueUsd,
                            p.CreatedAt.Value,
                            now
                        );

                        if (aprHistoricalProjection != null && aprHistorical.HasValue)
                        {
                            calculatedAprHistorical = aprHistorical.Value;
                            var daysActive = (DateTimeOffset.UtcNow - 
                                DateTimeOffset.FromUnixTimeSeconds(p.CreatedAt.Value)).TotalDays;

                            projections.Add(_projectionCalculator.CreateProjectionData(
                                ProjectionType.AprHistorical,
                                aprHistoricalProjection,
                                new ProjectionMetadata
                                {
                                    AprHistorical = aprHistorical.Value,
                                    CreatedAt = p.CreatedAt.Value,
                                    TotalFeesGenerated = totalFees,
                                    DaysActive = (decimal)daysActive
                                }
                            ));
                        }
                    }
                }

                // 3. Fees24h-based projection
                if (p.Fees24h.HasValue && p.Fees24h.Value > 0)
                {
                    var fees24hProjection = _projectionCalculator.CalculateFees24hProjection((decimal)p.Fees24h.Value);
                    if (fees24hProjection != null)
                    {
                        projections.Add(_projectionCalculator.CreateProjectionData(
                            ProjectionType.Fees24h,
                            fees24hProjection,
                            new ProjectionMetadata { Fees24h = p.Fees24h.Value }
                        ));
                    }
                }

                var walletItem = new WalletItem
                {
                    Type = WalletItemType.LiquidityPool,
                    Protocol = GetProtocolDefinition(chain),
                    Position = new Position
                    {
                        Label = string.Empty,
                        Tokens = tokens
                    },
                    AdditionalData = new AdditionalData
                    {
                        TotalValueUsd = totalValueUsd,
                        Apr = effectiveApr,
                        AprHistorical = calculatedAprHistorical,
                        Fees24h = p.Fees24h,
                        SqrtPriceX96 = p.SqrtPriceX96,
                        PoolId = p.Pool,
                        CreatedAt = p.CreatedAt,
                        Range = rangeInfo,
                        Projections = projections.Any() ? projections : null,
                        TierPercent = p.TierPercent
                    }
                };

                walletItems.Add(walletItem);
            }

            _labelEnricher.EnrichLabels(walletItems);

            _logger.LogInformation("RAYDIUM MAPPER: Completed mapping - Total WalletItems: {Count}", walletItems.Count);

            return walletItems;
        }

        private RangeInfo CalculateRange(int tickLower, int tickUpper, int tickCurrent, List<SplToken> tokens)
        {
            // Get decimals from the first two tokens (token0 and token1)
            int decimal0 = tokens.Count > 0 ? tokens[0].Decimals : 0;
            int decimal1 = tokens.Count > 1 ? tokens[1].Decimals : 0;
            
            // Calculate raw price using tick formula: price = 1.0001^tick
            var rawPriceLower = Math.Pow(1.0001, tickLower);
            var rawPriceUpper = Math.Pow(1.0001, tickUpper);
            var rawPriceCurrent = Math.Pow(1.0001, tickCurrent);
            
            // Adjust for token decimals: price = rawPrice * 10^(decimal0 - decimal1)
            // Example: SOL (9 decimals) / USDC (6 decimals) = 10^(9-6) = 10^3 = 1000x multiplier
            var decimalAdjustment = Math.Pow(10, decimal0 - decimal1);
            
            var priceLower = rawPriceLower * decimalAdjustment;
            var priceUpper = rawPriceUpper * decimalAdjustment;
            var priceCurrent = rawPriceCurrent * decimalAdjustment;
            
            decimal? rangeSize = priceLower > 0 ? (decimal)((priceUpper - priceLower) / priceLower) : null;

            return new RangeInfo
            {
                Lower = (decimal)priceLower,
                Upper = (decimal)priceUpper,
                Current = (decimal)priceCurrent,
                InRange = tickCurrent >= tickLower && tickCurrent <= tickUpper,
                RangeSize = rangeSize
            };
        }
    }

}
