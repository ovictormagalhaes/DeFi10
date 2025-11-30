using MyWebWallet.API.Aggregation;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Solana;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ChainEnum = MyWebWallet.API.Models.Chain;
using Microsoft.Extensions.Logging;

namespace MyWebWallet.API.Services.Mappers
{
    public sealed class SolanaTokenMapper : IWalletItemMapper<SolanaTokenResponse>
    {
        private readonly ITokenFactory _tokenFactory;
        private readonly IProtocolConfigurationService _protocolConfig;

        public SolanaTokenMapper(ITokenFactory tokenFactory, IProtocolConfigurationService protocolConfig)
        {
            _tokenFactory = tokenFactory;
            _protocolConfig = protocolConfig;
        }

        public bool SupportsChain(ChainEnum chain) => chain == ChainEnum.Solana;
        public IEnumerable<ChainEnum> GetSupportedChains() => new[] { ChainEnum.Solana };

        public Protocol GetProtocolDefinition(ChainEnum chain)
        {
            var p = _protocolConfig.GetProtocol("solana-wallet");
            return new Protocol
            {
                Name = p?.DisplayName ?? "Wallet",
                Chain = chain.ToString().ToLower(),
                Id = p?.Key ?? "solana-wallet",
                Url = p?.Website ?? "https://solscan.io",
                Logo = p?.Icon ?? "https://cryptologos.cc/logos/solana-sol-logo.png"
            };
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

        public SolanaKaminoMapper(ITokenFactory tokenFactory, ILogger<SolanaKaminoMapper> logger)
        {
            _tokenFactory = tokenFactory;
            _logger = logger;
        }

        public bool SupportsChain(ChainEnum chain) => chain == ChainEnum.Solana;
        public IEnumerable<ChainEnum> GetSupportedChains() => new[] { ChainEnum.Solana };

        public Protocol GetProtocolDefinition(ChainEnum chain)
        {
            return new Protocol
            {
                Id = "kamino",
                Name = "Kamino",
                Chain = chain.ToString().ToLower(),
                Url = "https://app.kamino.finance",
                Logo = "https://app.kamino.finance/favicon.ico"
            };
        }

        public Task<List<WalletItem>> MapAsync(IEnumerable<KaminoPosition> input, ChainEnum chain)
        {
            _logger.LogInformation("========== KAMINO MAPPER: Starting mapping ==========");
            
            if (input == null || !input.Any())
            {
                _logger.LogWarning("KAMINO MAPPER: Input is null or empty!");
                return Task.FromResult(new List<WalletItem>());
            }

            _logger.LogInformation("KAMINO MAPPER: Input has {Count} positions", input.Count());

            var walletItems = input.Select((p, idx) =>
            {
                _logger.LogInformation("KAMINO MAPPER: Processing position {Index}: ID={Id}, Market={Market}, TokenCount={TokenCount}", 
                    idx, p.Id, p.Market, p.Tokens?.Count ?? 0);

                if (p.Tokens == null || !p.Tokens.Any())
                {
                    _logger.LogWarning("KAMINO MAPPER: Position {Index} has no tokens!", idx);
                }
                else
                {
                    foreach (var token in p.Tokens)
                    {
                        _logger.LogInformation("KAMINO MAPPER: Token in position - Symbol={Symbol}, Amount={Amount}, PriceUsd={Price}, Type={Type}",
                            token.Symbol, token.Amount, token.PriceUsd, token.Type);
                    }
                }

                // Separate supplied and borrowed tokens (Type is nullable but should be set)
                var suppliedTokens = p.Tokens
                    .Where(t => t.Type == TokenType.Supplied)
                    .Select(t =>
                    {
                        // Calculate unit price from totalPrice and amount
                        var unitPrice = t.PriceUsd ?? 0;
                        
                        _logger.LogInformation("KAMINO MAPPER: Creating SUPPLIED token - Symbol={Symbol}, Amount={Amount}, UnitPrice={Price}",
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
                        
                        _logger.LogInformation("KAMINO MAPPER: Created token - Symbol={Symbol}, TotalPrice={TotalPrice}, BalanceFormatted={Balance}",
                            token.Symbol, token.Financials?.TotalPrice, token.Financials?.BalanceFormatted);
                        
                        return token;
                    }).ToList();

                _logger.LogInformation("KAMINO MAPPER: Supplied tokens count: {Count}", suppliedTokens.Count);

                var borrowedTokens = p.Tokens
                    .Where(t => t.Type == TokenType.Borrowed)
                    .Select(t =>
                    {
                        // Calculate unit price from totalPrice and amount
                        var unitPrice = t.PriceUsd ?? 0;
                        
                        _logger.LogInformation("KAMINO MAPPER: Creating BORROWED token - Symbol={Symbol}, Amount={Amount}, UnitPrice={Price}",
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
                        
                        _logger.LogInformation("KAMINO MAPPER: Created token - Symbol={Symbol}, TotalPrice={TotalPrice}, BalanceFormatted={Balance}",
                            token.Symbol, token.Financials?.TotalPrice, token.Financials?.BalanceFormatted);
                        
                        return token;
                    }).ToList();

                _logger.LogInformation("KAMINO MAPPER: Borrowed tokens count: {Count}", borrowedTokens.Count);

                var allTokens = suppliedTokens.Concat(borrowedTokens).ToList();
                _logger.LogInformation("KAMINO MAPPER: Total tokens in position: {Count}", allTokens.Count);

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
                        IsCollateral = allTokens.Any(t => t.Type == TokenType.Supplied) // Has supplied tokens = collateral enabled
                    }
                };

                _logger.LogInformation("KAMINO MAPPER: Created WalletItem - Type={Type}, Protocol={Protocol}, TokensCount={Count}, HealthFactor={HF}",
                    walletItem.Type, walletItem.Protocol.Name, walletItem.Position.Tokens.Count, walletItem.AdditionalData.HealthFactor);

                return walletItem;

            }).ToList();

            _logger.LogInformation("KAMINO MAPPER: Completed mapping - Total WalletItems: {Count}", walletItems.Count);
            
            if (walletItems.Any())
            {
                var firstItem = walletItems.First();
                _logger.LogInformation("KAMINO MAPPER: First item summary - Tokens={Count}, Protocol={Name}", 
                    firstItem.Position.Tokens.Count, firstItem.Protocol.Name);
                
                if (firstItem.Position.Tokens.Any())
                {
                    var firstToken = firstItem.Position.Tokens.First();
                    _logger.LogInformation("KAMINO MAPPER: First token details - Symbol={Symbol}, Type={Type}, Amount={Amount}, TotalPrice={Price}",
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

        public SolanaRaydiumMapper(
            ITokenFactory tokenFactory, 
            ILogger<SolanaRaydiumMapper> logger,
            ITokenMetadataService metadataService,
            WalletItemLabelEnricher labelEnricher)
        {
            _tokenFactory = tokenFactory;
            _logger = logger;
            _metadataService = metadataService;
            _labelEnricher = labelEnricher;
        }

        public bool SupportsChain(ChainEnum chain) => chain == ChainEnum.Solana;
        public IEnumerable<ChainEnum> GetSupportedChains() => new[] { ChainEnum.Solana };

        public Protocol GetProtocolDefinition(ChainEnum chain)
        {
            return new Protocol
            {
                Id = "raydium",
                Name = "Raydium",
                Chain = chain.ToString().ToLower(),
                Url = "https://raydium.io",
                Logo = "https://s2.coinmarketcap.com/static/img/coins/64x64/8526.png"
            };
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
                    // 1. Try to get metadata from cache (symbol, name, logo)
                    var metadata = await _metadataService.GetTokenMetadataAsync(t.Mint);
                    
                    string? symbol = metadata?.Symbol ?? t.Symbol;
                    string? name = metadata?.Name ?? t.Name;
                    string? logo = metadata?.LogoUrl ?? t.Logo;
                    
                    // 2. Try to get price from cache (by mint, symbol, or name)
                    decimal? priceUsd = t.PriceUsd;
                    if (!priceUsd.HasValue || priceUsd.Value == 0)
                    {
                        // Try mint address first
                        priceUsd = await _metadataService.GetTokenPriceAsync(t.Mint);
                        
                        // Try symbol if available
                        if (!priceUsd.HasValue && !string.IsNullOrEmpty(symbol))
                            priceUsd = await _metadataService.GetTokenPriceAsync(symbol);
                        
                        // Try name if available
                        if (!priceUsd.HasValue && !string.IsNullOrEmpty(name))
                            priceUsd = await _metadataService.GetTokenPriceAsync(name);
                    }
                    
                    // Convert raw amount to formatted amount by dividing by 10^decimals
                    var formattedAmount = t.Decimals > 0 
                        ? t.Amount / (decimal)Math.Pow(10, t.Decimals) 
                        : t.Amount;
                    
                    _logger.LogInformation(
                        "RAYDIUM MAPPER: Token mint={Mint}, symbol={Symbol}, name={Name}, hasLogo={HasLogo}, price={Price}, amount={Amount}, type={Type}",
                        t.Mint, symbol ?? "null", name ?? "null", logo != null, priceUsd ?? 0, formattedAmount, t.Type);
                    
                    // Create token based on type
                    Token token;
                    if (t.Type == TokenType.LiquidityUncollectedFee)
                    {
                        // Uncollected fees are created as UncollectedReward tokens
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
                        // Regular supplied tokens
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
                        Label = string.Empty,  // Will be enriched by WalletItemLabelEnricher
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

            // Enrich labels after all tokens have been mapped with their metadata
            _labelEnricher.EnrichLabels(walletItems);

            _logger.LogInformation("RAYDIUM MAPPER: Completed mapping - Total WalletItems: {Count}", walletItems.Count);
            
            return walletItems;
        }

        /// <summary>
        /// Calculates price range from Raydium CLMM ticks
        /// </summary>
        private RangeInfo CalculateRange(int tickLower, int tickUpper, int tickCurrent)
        {
            // Convert ticks to prices using: price = 1.0001^tick
            // This gives us the price of token1 in terms of token0
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
