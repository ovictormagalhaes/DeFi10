using MyWebWallet.API.Aggregation;
using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Models;
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

        public SolanaRaydiumMapper(ITokenFactory tokenFactory)
        {
            _tokenFactory = tokenFactory;
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
                Logo = "https://raydium.io/_next/static/media/logo.2b8a1b0a.svg"
            };
        }

        public Task<List<WalletItem>> MapAsync(IEnumerable<RaydiumPosition> input, ChainEnum chain)
        {
            if (input == null || !input.Any())
            {
                return Task.FromResult(new List<WalletItem>());
            }

            var walletItems = input.Select(p =>
            {
                var tokens = p.Tokens.Select(t =>
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
                    Type = WalletItemType.LiquidityPool,
                    Protocol = GetProtocolDefinition(chain),
                    Position = new Position
                    {
                        Label = p.Pool,
                        Tokens = tokens
                    },
                    AdditionalData = new AdditionalData
                    {
                        TotalValueUsd = p.TotalValueUsd,
                        Apr = p.Apr,
                        Fees24h = p.Fees24h
                    }
                };

                return walletItem;

            }).ToList();

            return Task.FromResult(walletItems);
        }
    }
}
