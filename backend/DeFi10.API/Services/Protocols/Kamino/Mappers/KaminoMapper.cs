using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Models;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Domain;
using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Helpers;
using DeFi10.API.Services.Protocols.Kamino.Models;
using DeFi10.API.Services.Protocols.Raydium.Models;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Protocols.Kamino.Mappers
{
    public sealed class KaminoMapper : IWalletItemMapper<IEnumerable<KaminoPosition>>
    {
        private readonly ITokenFactory _tokenFactory;
        private readonly ILogger<KaminoMapper> _logger;
        private readonly IProtocolConfigurationService _protocolConfig;
        private readonly IChainConfigurationService _chainConfig;
        private readonly IProjectionCalculator _projectionCalculator;

        public KaminoMapper(
            ITokenFactory tokenFactory, 
            ILogger<KaminoMapper> logger, 
            IProtocolConfigurationService protocolConfig, 
            IChainConfigurationService chainConfig, 
            IProjectionCalculator projectionCalculator)
        {
            _tokenFactory = tokenFactory;
            _logger = logger;
            _protocolConfig = protocolConfig;
            _chainConfig = chainConfig;
            _projectionCalculator = projectionCalculator;
        }

        public bool SupportsChain(ChainEnum chain) => GetSupportedChains().Contains(chain);

        public IEnumerable<ChainEnum> GetSupportedChains() =>
            _protocolConfig.GetEnabledChainEnums(ProtocolNames.Kamino);

        public Protocol GetProtocolDefinition(ChainEnum chain)
        {
            var def = _protocolConfig.GetProtocol(ProtocolNames.Kamino)
                ?? throw new InvalidOperationException($"Protocol definition not found: {ProtocolNames.Kamino}");
            return def.ToProtocol(chain, _chainConfig);
        }

        public async Task<List<WalletItem>> MapAsync(IEnumerable<KaminoPosition> input, ChainEnum chain)
        {
            _logger.LogDebug("KAMINO MAPPER: Starting mapping");

            if (input == null || !input.Any())
            {
                _logger.LogWarning("KAMINO MAPPER: Input is null or empty!");
                return new List<WalletItem>();
            }

            _logger.LogDebug("KAMINO MAPPER: Input has {Count} positions", input.Count());

            var walletItems = new List<WalletItem>();
            var protocol = GetProtocolDefinition(chain);

            foreach (var position in input)
            {
                _logger.LogDebug("KAMINO MAPPER: Processing position: ID={Id}, Market={Market}, TokenCount={TokenCount}",
                    position.Id, position.Market, position.Tokens?.Count ?? 0);

                if (position.Tokens == null || !position.Tokens.Any())
                {
                    _logger.LogWarning("KAMINO MAPPER: Position {Id} has no tokens!", position.Id);
                    continue;
                }

                // Create one WalletItem per token (like Aave)
                foreach (var splToken in position.Tokens)
                {
                    var unitPrice = splToken.PriceUsd ?? 0;
                    var totalPrice = splToken.Amount * unitPrice;

                    if (totalPrice <= 0)
                    {
                        _logger.LogDebug("KAMINO MAPPER: Skipping token {Symbol} with totalPrice={TotalPrice}",
                            splToken.Symbol, totalPrice);
                        continue;
                    }

                    Token token;
                    string label;

                    if (splToken.Type == TokenType.Supplied)
                    {
                        token = _tokenFactory.CreateSupplied(
                            splToken.Name ?? "Unknown Token",
                            splToken.Symbol ?? "UNKNOWN",
                            splToken.Mint ?? "",
                            chain,
                            splToken.Decimals,
                            splToken.Amount,
                            unitPrice
                        );
                        label = "Supplied";
                        _logger.LogDebug("KAMINO MAPPER: Created SUPPLIED token - Symbol={Symbol}, Amount={Amount}, Price={Price}, APY={Apy}%",
                            splToken.Symbol, splToken.Amount, unitPrice, splToken.Apy);
                    }
                    else if (splToken.Type == TokenType.Borrowed)
                    {
                        token = _tokenFactory.CreateBorrowed(
                            splToken.Name ?? "Unknown Token",
                            splToken.Symbol ?? "UNKNOWN",
                            splToken.Mint ?? "",
                            chain,
                            splToken.Decimals,
                            splToken.Amount,
                            unitPrice
                        );
                        label = "Borrowed";
                        _logger.LogDebug("KAMINO MAPPER: Created BORROWED token - Symbol={Symbol}, Amount={Amount}, Price={Price}, APY={Apy}%",
                            splToken.Symbol, splToken.Amount, unitPrice, splToken.Apy);
                    }
                    else
                    {
                        _logger.LogWarning("KAMINO MAPPER: Unknown token type {Type} for {Symbol}", splToken.Type, splToken.Symbol);
                        continue;
                    }

                    token.Logo = splToken.Logo;

                    // Use the APY from the enriched token data
                    decimal? apy = splToken.Apy;
                    Projection? projection = null;

                    _logger.LogInformation("KAMINO MAPPER: Token {Symbol} has APY={Apy}% (null={IsNull})", 
                        splToken.Symbol, apy, apy == null);

                    if (apy.HasValue)
                    {
                        // For borrows, negate only the APY (not the value) so projection calculator accepts it
                        // The negative APY will result in negative projections (representing costs)
                        var projectionApy = splToken.Type == TokenType.Borrowed ? -apy.Value : apy.Value;
                        projection = _projectionCalculator.CalculateApyProjection(totalPrice, projectionApy);

                        _logger.LogDebug("KAMINO MAPPER: APY for {Symbol}: {Apy}%, Projection OneDay={OneDay}",
                            splToken.Symbol, apy, projection?.OneDay);
                    }

                    // Negate APY for borrows (cost) in the final output
                    var displayApy = apy.HasValue && splToken.Type == TokenType.Borrowed ? -apy.Value : apy;

                    var walletItem = new WalletItem
                    {
                        Type = WalletItemType.LendingAndBorrowing,
                        Protocol = protocol,
                        Position = new Position
                        {
                            Label = label,
                            Tokens = new List<Token> { token }
                        },
                        AdditionalData = new AdditionalData
                        {
                            HealthFactor = position.HealthFactor,
                            IsCollateral = splToken.Type == TokenType.Supplied,
                            Apy = displayApy,
                            Projection = projection
                        }
                    };

                    _logger.LogInformation("KAMINO MAPPER: Created WalletItem - Label={Label}, Symbol={Symbol}, APY={Apy}%, HasProjection={HasProj}",
                        label, token.Symbol, apy, projection != null);

                    walletItems.Add(walletItem);

                    _logger.LogDebug("KAMINO MAPPER: Created WalletItem - Type={Type}, Label={Label}, Symbol={Symbol}, HealthFactor={HF}",
                        walletItem.Type, label, token.Symbol, walletItem.AdditionalData.HealthFactor);
                }
            }

            _logger.LogDebug("KAMINO MAPPER: Mapping completed with {Count} wallet items", walletItems.Count);
            return walletItems;
        }
    }

}
