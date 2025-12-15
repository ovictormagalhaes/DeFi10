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

        public KaminoMapper(ITokenFactory tokenFactory, ILogger<KaminoMapper> logger, IProtocolConfigurationService protocolConfig, IChainConfigurationService chainConfig)
        {
            _tokenFactory = tokenFactory;
            _logger = logger;
            _protocolConfig = protocolConfig;
            _chainConfig = chainConfig;
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

        public Task<List<WalletItem>> MapAsync(IEnumerable<KaminoPosition> input, ChainEnum chain)
        {
            _logger.LogDebug("KAMINO MAPPER: Starting mapping");

            if (input == null || !input.Any())
            {
                _logger.LogWarning("KAMINO MAPPER: Input is null or empty!");
                return Task.FromResult(new List<WalletItem>());
            }

            _logger.LogDebug("KAMINO MAPPER: Input has {Count} positions", input.Count());

            var walletItems = input.Select((p, idx) =>
            {
                _logger.LogDebug("KAMINO MAPPER: Processing position {Index}: ID={Id}, Market={Market}, TokenCount={TokenCount}",
                    idx, p.Id, p.Market, p.Tokens?.Count ?? 0);

                if (p.Tokens == null || !p.Tokens.Any())
                {
                    _logger.LogWarning("KAMINO MAPPER: Position {Index} has no tokens!", idx);
                }
                else
                {
                    foreach (var token in p.Tokens)
                    {
                        _logger.LogDebug("KAMINO MAPPER: Token in position - Symbol={Symbol}, Amount={Amount}, PriceUsd={Price}, Type={Type}",
                            token.Symbol, token.Amount, token.PriceUsd, token.Type);
                    }
                }

                var suppliedTokens = p.Tokens
                    .Where(t => t.Type == TokenType.Supplied)
                    .Select(t =>
                    {
                        var unitPrice = t.PriceUsd ?? 0;

                        _logger.LogDebug("KAMINO MAPPER: Creating SUPPLIED token - Symbol={Symbol}, Amount={Amount}, UnitPrice={Price}",
                            t.Symbol, t.Amount, unitPrice);

                        var token = _tokenFactory.CreateSupplied(
                            t.Name ?? "Unknown Token",
                            t.Symbol ?? "UNKNOWN",
                            t.Mint ?? "",
                            chain,
                            t.Decimals,
                            t.Amount,
                            unitPrice
                        );
                        token.Logo = t.Logo;

                        _logger.LogDebug("KAMINO MAPPER: Created token - Symbol={Symbol}, TotalPrice={TotalPrice}, BalanceFormatted={Balance}",
                            token.Symbol, token.Financials?.TotalPrice, token.Financials?.BalanceFormatted);

                        return token;
                    }).ToList();

                _logger.LogDebug("KAMINO MAPPER: Supplied tokens count: {Count}", suppliedTokens.Count);

                var borrowedTokens = p.Tokens
                    .Where(t => t.Type == TokenType.Borrowed)
                    .Select(t =>
                    {
                        var unitPrice = t.PriceUsd ?? 0;

                        _logger.LogDebug("KAMINO MAPPER: Creating BORROWED token - Symbol={Symbol}, Amount={Amount}, UnitPrice={Price}",
                            t.Symbol, t.Amount, unitPrice);

                        var token = _tokenFactory.CreateBorrowed(
                            t.Name ?? "Unknown Token",
                            t.Symbol ?? "UNKNOWN",
                            t.Mint ?? "",
                            chain,
                            t.Decimals,
                            t.Amount,
                            unitPrice
                        );
                        token.Logo = t.Logo;

                        _logger.LogDebug("KAMINO MAPPER: Created token - Symbol={Symbol}, TotalPrice={TotalPrice}, BalanceFormatted={Balance}",
                            token.Symbol, token.Financials?.TotalPrice, token.Financials?.BalanceFormatted);

                        return token;
                    }).ToList();

                _logger.LogDebug("KAMINO MAPPER: Borrowed tokens count: {Count}", borrowedTokens.Count);

                var allTokens = suppliedTokens.Concat(borrowedTokens).ToList();
                _logger.LogDebug("KAMINO MAPPER: Total tokens in position: {Count}", allTokens.Count);

                var walletItem = new WalletItem
                {
                    Type = WalletItemType.LendingAndBorrowing,
                    Protocol = GetProtocolDefinition(chain),
                    Position = new Position
                    {
                        Label = p.Market ?? "Kamino Lending",
                        Tokens = allTokens
                    },
                    AdditionalData = new AdditionalData
                    {
                        HealthFactor = p.HealthFactor,
                        IsCollateral = allTokens.Any(t => t.Type == TokenType.Supplied)
                    }
                };

                _logger.LogDebug("KAMINO MAPPER: Created WalletItem - Type={Type}, Protocol={Protocol}, TokensCount={Count}, HealthFactor={HF}",
                    walletItem.Type, walletItem.Protocol.Name, walletItem.Position.Tokens.Count, walletItem.AdditionalData.HealthFactor);

                return walletItem;

            }).ToList();

            _logger.LogDebug("KAMINO MAPPER: Completed mapping - Total WalletItems: {Count}", walletItems.Count);

            if (walletItems.Any())
            {
                var firstItem = walletItems.First();
                _logger.LogDebug("KAMINO MAPPER: First item summary - Tokens={Count}, Protocol={Name}",
                    firstItem.Position.Tokens.Count, firstItem.Protocol.Name);

                if (firstItem.Position.Tokens.Any())
                {
                    var firstToken = firstItem.Position.Tokens.First();
                    _logger.LogDebug("KAMINO MAPPER: First token details - Symbol={Symbol}, Type={Type}, Amount={Amount}, TotalPrice={Price}",
                        firstToken.Symbol, firstToken.Type, firstToken.Financials?.BalanceFormatted, firstToken.Financials?.TotalPrice);
                }
            }

            return Task.FromResult(walletItems);
        }
    }

}
