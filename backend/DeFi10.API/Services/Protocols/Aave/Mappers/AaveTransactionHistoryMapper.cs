using DeFi10.API.Aggregation;
using DeFi10.API.Configuration;
using DeFi10.API.Controllers.Requests;
using DeFi10.API.Models;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Services.Domain.Mappers;
using DeFi10.API.Services.Helpers;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Protocols.Aave.Models;
using System.Globalization;
using ChainEnum = DeFi10.API.Models.Chain;

namespace DeFi10.API.Services.Protocols.Aave.Mappers;

/// <summary>
/// Mapper para transaction history do Aave - processa eventos de DEPOSIT, BORROW, REPAY
/// Popula as listas Supplies, Borrows e Repays no AdditionalData
/// </summary>
public class AaveTransactionHistoryMapper : IWalletItemMapper<AaveTransactionHistoryResponse>
{
    private readonly ITokenFactory _tokenFactory;
    private readonly IProtocolConfigurationService _protocolConfig;
    private readonly IChainConfigurationService _chainConfig;
    private readonly IProjectionCalculator _projectionCalculator;
    private readonly ITokenMetadataService _tokenMetadataService;
    private readonly ILogger<AaveTransactionHistoryMapper> _logger;

    public AaveTransactionHistoryMapper(
        ITokenFactory tokenFactory,
        IProtocolConfigurationService protocolConfig,
        IChainConfigurationService chainConfig,
        IProjectionCalculator projectionCalculator,
        ITokenMetadataService tokenMetadataService,
        ILogger<AaveTransactionHistoryMapper> logger)
    {
        _tokenFactory = tokenFactory;
        _protocolConfig = protocolConfig;
        _chainConfig = chainConfig;
        _projectionCalculator = projectionCalculator;
        _tokenMetadataService = tokenMetadataService;
        _logger = logger;
    }

    public bool SupportsChain(ChainEnum chain) =>
        _protocolConfig.IsChainEnabledForProtocol(ProtocolNames.AaveV3, chain);

    public IEnumerable<ChainEnum> GetSupportedChains() =>
        _protocolConfig.GetEnabledChainEnums(ProtocolNames.AaveV3);

    public Protocol GetProtocolDefinition(ChainEnum chain)
    {
        if (!SupportsChain(chain))
            throw new InvalidOperationException($"Protocol {ProtocolNames.AaveV3} disabled on chain {chain}");
        
        var def = _protocolConfig.GetProtocol(ProtocolNames.AaveV3)
            ?? throw new InvalidOperationException($"Protocol definition not found: {ProtocolNames.AaveV3}");
        
        return def.ToProtocol(chain, _chainConfig);
    }

    public async Task<List<WalletItem>> MapAsync(AaveTransactionHistoryResponse response, ChainEnum chain)
    {
        if (!SupportsChain(chain))
            return new List<WalletItem>();

        _logger.LogInformation(
            "AAVE TRANSACTION HISTORY MAPPER: DATA CHECK - Response.Data is null: {IsNull}, Supplies:{S}, Underlyings:{U}, Borrows:{B}, Repays:{R}",
            response?.Data == null,
            response?.Data?.Supplies?.Count ?? -1,
            response?.Data?.RedeemUnderlyings?.Count ?? -1,
            response?.Data?.Borrows?.Count ?? -1,
            response?.Data?.Repays?.Count ?? -1);

        if (response?.Data?.Transactions == null || !response.Data.Transactions.Any())
        {
            _logger.LogWarning("AAVE TRANSACTION HISTORY MAPPER: Transactions property is null or empty after computed getter");
            return new List<WalletItem>();
        }

        _logger.LogInformation(
            "AAVE TRANSACTION HISTORY MAPPER: Processing {TotalTx} transactions - Supplies:{Supplies}, RedeemUnderlyings:{Withdraws}, Borrows:{Borrows}, Repays:{Repays}",
            response.Data.Transactions.Count,
            response.Data.Supplies.Count,
            response.Data.RedeemUnderlyings.Count,
            response.Data.Borrows.Count,
            response.Data.Repays.Count);

        var protocol = GetProtocolDefinition(chain);
        var walletItems = new List<WalletItem>();

        // Agrupar transações por token (underlyingAsset)
        var transactionsByToken = response.Data.Transactions
            .Where(t => t.Reserve?.UnderlyingAsset != null)
            .GroupBy(t => t.Reserve!.UnderlyingAsset);
        
        // Log dos primeiros types para debug
        var firstFiveTypes = response.Data.Transactions.Take(5).Select(t => $"{t.Reserve?.Symbol}:{t.Type}").ToList();
        _logger.LogInformation(
            "AAVE TRANSACTION HISTORY MAPPER: First 5 transaction types: {Types}",
            string.Join(", ", firstFiveTypes));


        foreach (var tokenGroup in transactionsByToken)
        {
            try
            {
                var tokenAddress = tokenGroup.Key;
                var transactions = tokenGroup.ToList();

                // Pegar informações do primeiro reserve (todos devem ser do mesmo token)
                var firstReserve = transactions.First().Reserve!;
                var symbol = firstReserve.Symbol;
                var name = firstReserve.Name;
                var decimals = firstReserve.Decimals;

                // Processar transações e criar listas de supplies, borrows e repays
                var supplies = new List<SupplyItem>();
                var borrows = new List<BorrowItem>();
                var repays = new List<RepayItem>();

                foreach (var tx in transactions)
                {
                    // O Amount do The Graph JÁ VEM como raw balance (sem decimals aplicados)
                    if (string.IsNullOrEmpty(tx.Amount))
                        continue;

                    var rawBalance = tx.Amount; // Já é o valor raw
                    var timestamp = DateTimeOffset.FromUnixTimeSeconds(tx.Timestamp).DateTime;

                    var txType = tx.Type?.ToUpperInvariant();

                    if (txType == "DEPOSIT")
                    {
                        supplies.Add(new SupplyItem
                        {
                            TokenAddress = tokenAddress,
                            Symbol = symbol,
                            Balance = rawBalance,
                            Timestamp = timestamp
                        });
                    }
                    else if (txType == "WITHDRAW")
                    {
                        // Withdraws também vão para supplies mas com flag negativa ou lista separada
                        // Por enquanto, adicionando aos supplies com balance negativo
                        supplies.Add(new SupplyItem
                        {
                            TokenAddress = tokenAddress,
                            Symbol = symbol,
                            Balance = "-" + rawBalance, // Negativo para indicar withdraw
                            Timestamp = timestamp
                        });
                    }
                    else if (txType == "BORROW")
                    {
                        borrows.Add(new BorrowItem
                        {
                            TokenAddress = tokenAddress,
                            Symbol = symbol,
                            Balance = rawBalance,
                            Timestamp = timestamp
                        });
                    }
                    else if (txType == "REPAY")
                    {
                        repays.Add(new RepayItem
                        {
                            TokenAddress = tokenAddress,
                            Symbol = symbol,
                            Balance = rawBalance,
                            Timestamp = timestamp
                        });
                    }
                    else
                    {
                        _logger.LogWarning("AAVE TRANSACTION HISTORY MAPPER: Unknown transaction type {Type}", txType);
                    }
                }

                // Se não há transações relevantes para este token, pular
                if (!supplies.Any() && !borrows.Any() && !repays.Any())
                {
                    _logger.LogWarning(
                        "AAVE TRANSACTION HISTORY MAPPER: No valid transactions for token {Token} after processing {Count} transactions",
                        tokenAddress, transactions.Count);
                    continue;
                }

                _logger.LogDebug(
                    "AAVE TRANSACTION HISTORY MAPPER: Token {Symbol} - Processing supplies={SuppliesCount}, borrows={BorrowsCount}, repays={RepaysCount}",
                    symbol, supplies.Count, borrows.Count, repays.Count);

                // Hidratar tokens únicos para supplies, borrows e repays
                var suppliesTokens = await HydrateUniqueTokens(supplies.Select(s => s.TokenAddress).Distinct(), chain, symbol, name, decimals);
                var borrowsTokens = await HydrateUniqueTokens(borrows.Select(b => b.TokenAddress).Distinct(), chain, symbol, name, decimals);
                var repaysTokens = await HydrateUniqueTokens(repays.Select(r => r.TokenAddress).Distinct(), chain, symbol, name, decimals);

                // Transaction history é METADATA, não uma posição visual
                // Não criamos tokens na Position pois não há balance atual
                // Apenas populamos AdditionalData com o histórico
                var walletItem = new WalletItem
                {
                    Type = WalletItemType.LendingAndBorrowing,
                    Protocol = protocol,
                    Position = new Position
                    {
                        Label = "Transaction History - Hidden",
                        Tokens = new List<Token>() // Vazio - não mostra tokens
                    },
                    AdditionalData = new AdditionalData
                    {
                        Supplies = supplies.Any() ? supplies : null,
                        Borrows = borrows.Any() ? borrows : null,
                        Repays = repays.Any() ? repays : null,
                        SuppliesTokens = suppliesTokens.Any() ? suppliesTokens : null,
                        BorrowsTokens = borrowsTokens.Any() ? borrowsTokens : null,
                        RepaysTokens = repaysTokens.Any() ? repaysTokens : null
                    }
                };

                _logger.LogInformation(
                    "AAVE TRANSACTION HISTORY MAPPER: Created metadata WalletItem - Symbol={Symbol}, Supplies={SuppliesCount}, Borrows={BorrowsCount}, Repays={RepaysCount}",
                    symbol, supplies.Count, borrows.Count, repays.Count);

                walletItems.Add(walletItem);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "AAVE TRANSACTION HISTORY MAPPER: Error processing token {Token}", tokenGroup.Key);
            }
        }

        _logger.LogInformation("AAVE TRANSACTION HISTORY MAPPER: Completed with {Count} wallet items", walletItems.Count);
        return walletItems;
    }

    /// <summary>
    /// Converte um valor decimal formatado (com decimals aplicados) para o valor RAW (string sem decimals)
    /// Exemplo: 1000.50 USDC (6 decimals) → "1000500000"
    /// </summary>
    private static string ConvertToRawBalance(decimal formattedAmount, int decimals)
    {
        var multiplier = (decimal)Math.Pow(10, decimals);
        var rawValue = formattedAmount * multiplier;
        var rawValueTruncated = decimal.Truncate(rawValue);
        return rawValueTruncated.ToString("F0", CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Hidrata tokens únicos buscando metadados completos (nome, logo, decimals)
    /// Usado para evitar repetição de dados em cada transação
    /// </summary>
    private async Task<List<TokenInfo>> HydrateUniqueTokens(
        IEnumerable<string?> addresses,
        ChainEnum chain,
        string knownSymbol,
        string knownName,
        int knownDecimals)
    {
        var result = new List<TokenInfo>();
        var uniqueAddresses = addresses.Where(a => !string.IsNullOrEmpty(a)).Distinct().ToList();

        foreach (var address in uniqueAddresses)
        {
            if (string.IsNullOrEmpty(address))
                continue;

            try
            {
                // Buscar metadata completo do token via TokenMetadataService
                var metadata = await _tokenMetadataService.GetTokenMetadataAsync(chain, address);

                result.Add(new TokenInfo
                {
                    TokenAddress = address,
                    Symbol = metadata?.Symbol ?? knownSymbol,
                    Name = metadata?.Name ?? knownName,
                    LogoUrl = metadata?.LogoUrl,
                    Decimals = knownDecimals // TokenMetadata não tem Decimals, usar valor do AaveReserve
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "AAVE TRANSACTION HISTORY MAPPER: Failed to fetch metadata for token {Address}, using fallback", address);
                
                // Fallback: usar dados conhecidos do reserve
                result.Add(new TokenInfo
                {
                    TokenAddress = address,
                    Symbol = knownSymbol,
                    Name = knownName,
                    LogoUrl = null,
                    Decimals = knownDecimals // Usar decimals do AaveReserve
                });
            }
        }

        return result;
    }
}
