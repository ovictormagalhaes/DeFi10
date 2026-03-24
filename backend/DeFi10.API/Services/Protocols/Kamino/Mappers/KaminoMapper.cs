using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Controllers.Requests;
using DeFi10.API.Models;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Domain;
using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Helpers;
using DeFi10.API.Services.Interfaces;
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
        private readonly ITokenMetadataService _tokenMetadataService;

        public KaminoMapper(
            ITokenFactory tokenFactory, 
            ILogger<KaminoMapper> logger, 
            IProtocolConfigurationService protocolConfig, 
            IChainConfigurationService chainConfig, 
            IProjectionCalculator projectionCalculator,
            ITokenMetadataService tokenMetadataService)
        {
            _tokenFactory = tokenFactory;
            _logger = logger;
            _protocolConfig = protocolConfig;
            _chainConfig = chainConfig;
            _projectionCalculator = projectionCalculator;
            _tokenMetadataService = tokenMetadataService;
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

                    // Don't filter tokens with price=0 - hydration will fill correct prices using mint address
                    _logger.LogDebug("KAMINO MAPPER: Processing token {Symbol}, Amount={Amount}, PriceUsd={Price}, TotalPrice={TotalPrice}, Mint={Mint}",
                        splToken.Symbol, splToken.Amount, unitPrice, totalPrice, splToken.Mint);

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

                    // Populate supplies and borrows for this specific token
                    var supplies = new List<SupplyItem>();
                    var borrows = new List<BorrowItem>();
                    var repays = new List<RepayItem>();
                    
                    if (position.TransactionHistory != null && position.TransactionHistory.Any())
                    {
                        var tokenHistory = position.TransactionHistory
                            .Where(evt => evt.MintAddress == splToken.Mint)
                            .ToList();

                        foreach (var evt in tokenHistory)
                        {
                            // Buscar metadata para símbolo
                            var metadata = await _tokenMetadataService.GetTokenMetadataAsync(chain, evt.MintAddress);
                            var symbol = metadata?.Symbol ?? "UNKNOWN";
                            
                            // Usar decimals do splToken (já disponível no contexto)
                            // Converter decimal formatado para raw balance (sem decimais aplicados)
                            // Exemplo: 1399064.655 USDC (6 decimals) → "1399064655000" raw
                            var rawBalance = ConvertToRawBalance(evt.AmountChange, splToken.Decimals);
                            
                            if (evt.Type == "deposit")
                            {
                                supplies.Add(new SupplyItem
                                {
                                    MintAddress = evt.MintAddress,
                                    Symbol = symbol,
                                    Balance = rawBalance,
                                    Timestamp = evt.Timestamp
                                });
                            }
                            else if (evt.Type == "borrow")
                            {
                                borrows.Add(new BorrowItem
                                {
                                    MintAddress = evt.MintAddress,
                                    Symbol = symbol,
                                    Balance = rawBalance,
                                    Timestamp = evt.Timestamp
                                });
                            }
                            else if (evt.Type == "repay")
                            {
                                repays.Add(new RepayItem
                                {
                                    MintAddress = evt.MintAddress,
                                    Symbol = symbol,
                                    Balance = rawBalance,
                                    Timestamp = evt.Timestamp
                                });
                            }
                        }
                    }

                    // Hidratar tokens únicos para supplies e borrows
                    var suppliesTokens = await HydrateUniqueTokens(supplies.Select(s => s.MintAddress).Distinct(), chain);
                    var borrowsTokens = await HydrateUniqueTokens(borrows.Select(b => b.MintAddress).Distinct(), chain);
                    var repaysTokens = await HydrateUniqueTokens(repays.Select(r => r.MintAddress).Distinct(), chain);

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
                            Projections = projection != null ? new List<ProjectionData>
                            {
                                _projectionCalculator.CreateProjectionData(
                                    ProjectionType.Apy,
                                    projection,
                                    new ProjectionMetadata { Value = displayApy }
                                )
                            } : new List<ProjectionData>(),
                            Supplies = supplies.Any() ? supplies : null,
                            Borrows = borrows.Any() ? borrows : null,
                            Repays = repays.Any() ? repays : null,
                            SuppliesTokens = suppliesTokens.Any() ? suppliesTokens : null,
                            BorrowsTokens = borrowsTokens.Any() ? borrowsTokens : null,
                            RepaysTokens = repaysTokens.Any() ? repaysTokens : null
                        }
                    };

                    _logger.LogInformation("KAMINO MAPPER: Created WalletItem - Label={Label}, Symbol={Symbol}, APY={Apy}%, HasProjection={HasProj}, Supplies={SuppliesCount}, Borrows={BorrowsCount}, Repays={RepaysCount}",
                        label, token.Symbol, apy, projection != null, supplies.Count, borrows.Count, repays.Count);

                    walletItems.Add(walletItem);

                    _logger.LogDebug("KAMINO MAPPER: Created WalletItem - Type={Type}, Label={Label}, Symbol={Symbol}, HealthFactor={HF}",
                        walletItem.Type, label, token.Symbol, walletItem.AdditionalData.HealthFactor);
                }
            }

            _logger.LogDebug("KAMINO MAPPER: Mapping completed with {Count} wallet items", walletItems.Count);
            return walletItems;
        }

        /// <summary>
        /// Converte um valor decimal formatado (com decimais aplicados) para o valor RAW (string sem decimais)
        /// Exemplo: 1399064.655 USDC (6 decimals) → "1399064655000"
        /// </summary>
        private static string ConvertToRawBalance(decimal formattedAmount, int decimals)
        {
            // Multiplicar por 10^decimals para remover a parte decimal
            var multiplier = (decimal)Math.Pow(10, decimals);
            var rawValue = formattedAmount * multiplier;
            
            // Truncar parte decimal e converter diretamente para string
            // Evita overflow de long ao usar decimal.Truncate
            var rawValueTruncated = decimal.Truncate(rawValue);
            return rawValueTruncated.ToString("F0", System.Globalization.CultureInfo.InvariantCulture);
        }

        /// <summary>
        /// Hidrata tokens únicos buscando metadados completos (nome, logo, decimals)
        /// Usado para evitar repetição de dados em cada transação
        /// </summary>
        private async Task<List<TokenInfo>> HydrateUniqueTokens(IEnumerable<string?> addresses, ChainEnum chain)
        {
            var result = new List<TokenInfo>();
            var uniqueAddresses = addresses.Where(a => !string.IsNullOrEmpty(a)).Distinct().ToList();

            foreach (var address in uniqueAddresses)
            {
                if (string.IsNullOrEmpty(address)) continue;

                // Buscar metadata completo do token
                var metadata = await _tokenMetadataService.GetTokenMetadataAsync(chain, address);

                result.Add(new TokenInfo
                {
                    MintAddress = address,
                    Symbol = metadata?.Symbol ?? "UNKNOWN",
                    Name = metadata?.Name,
                    LogoUrl = metadata?.LogoUrl,
                    Decimals = GetDecimalsForToken(address, metadata?.Symbol)
                });
            }

            return result;
        }

        /// <summary>
        /// Obtém o número de decimais para um token baseado no mintAddress ou símbolo
        /// Fallback: 9 decimals (padrão Solana)
        /// </summary>
        private static int GetDecimalsForToken(string mintAddress, string? symbol)
        {
            // Tokens conhecidos do Solana
            return mintAddress?.ToLowerInvariant() switch
            {
                "epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v" => 6,  // USDC
                "es9vmfrzacermjfrf4h2fyd4kdcoqpl8wfpyzu6wde2" => 6,   // USDT
                "so11111111111111111111111111111111111111112" => 9,   // SOL (wrapped)
                "cbbtcf3aa214zxhbiazqwf4122fbybrnddfqgw4imij" => 8,  // cbBTC
                _ => symbol?.ToUpperInvariant() switch
                {
                    "USDC" => 6,
                    "USDT" => 6,
                    "SOL" => 9,
                    "BTC" or "WBTC" or "CBBTC" => 8,
                    _ => 9 // Solana default
                }
            };
        }
    }

}
