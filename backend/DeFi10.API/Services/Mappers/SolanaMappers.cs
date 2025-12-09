using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Models.Solana.Common;
using DeFi10.API.Services.Models.Solana.Kamino;
using DeFi10.API.Services.Models.Solana.Raydium;
using DeFi10.API.Services.Solana;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Mappers
{
    public sealed class SolanaTokenMapper : IWalletItemMapper<SolanaTokenResponse>
    {
        private readonly ITokenFactory _tokenFactory;
        private readonly IProtocolConfigurationService _protocolConfig;
        private readonly IChainConfigurationService _chainConfig;

        public SolanaTokenMapper(ITokenFactory tokenFactory, IProtocolConfigurationService protocolConfig, IChainConfigurationService chainConfig)
        {
            _tokenFactory = tokenFactory;
            _protocolConfig = protocolConfig;
            _chainConfig = chainConfig;
        }

        public bool SupportsChain(ChainEnum chain) => GetSupportedChains().Contains(chain);
        
        public IEnumerable<ChainEnum> GetSupportedChains() => 
            _protocolConfig.GetEnabledChainEnums(ProtocolNames.SolanaWallet);

        public Protocol GetProtocolDefinition(ChainEnum chain)
        {
            var def = _protocolConfig.GetProtocol(ProtocolNames.SolanaWallet) 
                ?? throw new InvalidOperationException($"Protocol definition not found: {ProtocolNames.SolanaWallet}");
            return def.ToProtocol(chain, _chainConfig);
        }

        public Task<List<WalletItem>> MapAsync(SolanaTokenResponse source, ChainEnum chain)
        {
            var walletItems = new List<WalletItem>();

            if (source?.Tokens == null || !source.Tokens.Any())
            {
                return Task.FromResult(walletItems);
            }

            var tokens = source.Tokens.Select(t =>
            {
                var token = _tokenFactory.CreateSupplied(
                    t.Name ?? "Unknown Token",
                    t.Symbol ?? "UNKNOWN",
                    t.Mint,
                    chain,
                    t.Decimals,
                    t.Amount,
                    t.PriceUsd ?? 0
                );

                token.Logo = t.Logo;
                return token;
            }).ToList();

            var walletItem = new WalletItem
            {
                Type = WalletItemType.Wallet,
                Protocol = GetProtocolDefinition(chain),
                Position = new Position
                {
                    Label = "Wallet",
                    Tokens = tokens
                },
                AdditionalData = new AdditionalData()
            };

            walletItems.Add(walletItem);

            return Task.FromResult(walletItems);
        }
    }

    public sealed class SolanaKaminoMapper : IWalletItemMapper<IEnumerable<KaminoPosition>>
    {
        private readonly ITokenFactory _tokenFactory;
        private readonly ILogger<SolanaKaminoMapper> _logger;
        private readonly IProtocolConfigurationService _protocolConfig;
        private readonly IChainConfigurationService _chainConfig;

        public SolanaKaminoMapper(ITokenFactory tokenFactory, ILogger<SolanaKaminoMapper> logger, IProtocolConfigurationService protocolConfig, IChainConfigurationService chainConfig)
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

    public sealed class SolanaRaydiumMapper : IWalletItemMapper<IEnumerable<RaydiumPosition>>
    {
        private readonly ITokenFactory _tokenFactory;
        private readonly ILogger<SolanaRaydiumMapper> _logger;
        private readonly ITokenMetadataService _metadataService;
        private readonly WalletItemLabelEnricher _labelEnricher;
        private readonly IProtocolConfigurationService _protocolConfig;
        private readonly IChainConfigurationService _chainConfig;

        public SolanaRaydiumMapper(
            ITokenFactory tokenFactory, 
            ILogger<SolanaRaydiumMapper> logger,
            ITokenMetadataService metadataService,
            WalletItemLabelEnricher labelEnricher,
            IProtocolConfigurationService protocolConfig,
            IChainConfigurationService chainConfig)
        {
            _tokenFactory = tokenFactory;
            _logger = logger;
            _metadataService = metadataService;
            _labelEnricher = labelEnricher;
            _protocolConfig = protocolConfig;
            _chainConfig = chainConfig;
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
                    var metadata = await _metadataService.GetTokenMetadataAsync(t.Mint);
                    
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
                        Range = CalculateRange(p.TickLower, p.TickUpper, p.TickCurrent)
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
