using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Models;
using DeFi10.API.Services.Configuration;
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
                        TotalValueUsd = p.TotalValueUsd,
                        Apr = p.Apr,
                        Fees24h = p.Fees24h,
                        SqrtPriceX96 = p.SqrtPriceX96,
                        Range = CalculateRange(p.TickLower, p.TickUpper, p.TickCurrent),
                        Projection = _projectionCalculator.CalculateAprProjection(p.TotalValueUsd, p.Apr)
                    }
                };

                walletItems.Add(walletItem);
            }

            _labelEnricher.EnrichLabels(walletItems);

            _logger.LogInformation("RAYDIUM MAPPER: Completed mapping - Total WalletItems: {Count}", walletItems.Count);

            return walletItems;
        }

        private RangeInfo CalculateRange(int tickLower, int tickUpper, int tickCurrent)
        {
            var priceLower = Math.Pow(1.0001, tickLower);
            var priceUpper = Math.Pow(1.0001, tickUpper);
            var priceCurrent = Math.Pow(1.0001, tickCurrent);

            return new RangeInfo
            {
                Lower = (decimal)priceLower,
                Upper = (decimal)priceUpper,
                Current = (decimal)priceCurrent,
                InRange = tickCurrent >= tickLower && tickCurrent <= tickUpper
            };
        }
    }

}
