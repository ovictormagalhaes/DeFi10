using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Solana;

namespace DeFi10.API.Services.Helpers;


public class TokenHydrationHelper
{
    private readonly ITokenMetadataService _metadataService;
    private readonly ILogger<TokenHydrationHelper> _logger;

    public TokenHydrationHelper(ITokenMetadataService metadataService, ILogger<TokenHydrationHelper> logger)
    {
        _metadataService = metadataService;
        _logger = logger;
    }


    public async Task<Dictionary<string, string?>> HydrateTokenLogosAsync(
        IEnumerable<WalletItem> walletItems, 
        Chain chain, 
        Dictionary<string, string>? incomingLogos = null)
    {
        var uniqueTokens = ExtractUniqueTokens(walletItems);
        
        if (!uniqueTokens.Any())
            return new Dictionary<string, string?>();

        _logger.LogDebug("Found {TokenCount} unique tokens for hydration on {Chain}", uniqueTokens.Count, chain);

        var existingLogos = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        var tokensToStore = new Dictionary<string, TokenMetadata>();

        foreach (var tokenAddress in uniqueTokens)
        {
            var normalizedAddress = tokenAddress.ToLowerInvariant();

            var metadata = await _metadataService.GetTokenMetadataAsync(normalizedAddress);
            
            if (metadata?.LogoUrl != null)
            {
                existingLogos[normalizedAddress] = metadata.LogoUrl;
            }
            else
            {

                if (incomingLogos?.TryGetValue(normalizedAddress, out var incomingLogo) == true && !string.IsNullOrEmpty(incomingLogo))
                {
                    existingLogos[normalizedAddress] = incomingLogo;

                    tokensToStore[normalizedAddress] = new TokenMetadata
                    {
                        Symbol = string.Empty,
                        Name = string.Empty,
                        LogoUrl = incomingLogo
                    };
                }
            }
        }

        var logosFromTokens = ExtractLogosFromTokens(walletItems);
        foreach (var kvp in logosFromTokens)
        {
            var normalizedAddress = kvp.Key.ToLowerInvariant();
            
            if (!existingLogos.ContainsKey(normalizedAddress) && !string.IsNullOrEmpty(kvp.Value))
            {
                existingLogos[normalizedAddress] = kvp.Value;
                
                tokensToStore[normalizedAddress] = new TokenMetadata
                {
                    Symbol = string.Empty,
                    Name = string.Empty,
                    LogoUrl = kvp.Value
                };
            }
        }

        foreach (var kvp in tokensToStore)
        {
            await _metadataService.SetTokenMetadataAsync(kvp.Key, kvp.Value);
        }

        if (tokensToStore.Any())
        {
            _logger.LogDebug("Stored {TokenCount} new token metadata entries on {Chain}", tokensToStore.Count, chain);
        }

        return existingLogos;
    }


    public async Task ApplyTokenLogosToWalletItemsAsync(IEnumerable<WalletItem> walletItems, Dictionary<string, string?> tokenLogos)
    {
        // Construir mapas de metadados para cross-chain sharing
        var addressToMetadata = new Dictionary<string, TokenMetadata>(StringComparer.OrdinalIgnoreCase);
        var symbolNameToMetadata = new Dictionary<string, TokenMetadata>(StringComparer.OrdinalIgnoreCase);
        var symbolToLogo = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var allTokens = walletItems.SelectMany(wi => wi.Position?.Tokens ?? Enumerable.Empty<Token>()).ToList();
        
        // Primeira passagem: coletar todos os metadados existentes de tokens já completos
        foreach (var token in allTokens)
        {
            var hasSymbol = !string.IsNullOrEmpty(token.Symbol);
            var hasName = !string.IsNullOrEmpty(token.Name);
            var hasLogo = !string.IsNullOrEmpty(token.Logo);
            var hasAddress = !string.IsNullOrEmpty(token.ContractAddress);
            
            // Se tem address e algum metadado, registrar
            if (hasAddress && (hasSymbol || hasName || hasLogo))
            {
                var normalizedAddress = token.ContractAddress!.ToLowerInvariant();
                
                // Criar metadata com os dados disponíveis
                var metadata = new TokenMetadata
                {
                    Symbol = token.Symbol ?? string.Empty,
                    Name = token.Name ?? string.Empty,
                    LogoUrl = token.Logo
                };
                
                // Registrar no mapa de addresses
                if (!addressToMetadata.ContainsKey(normalizedAddress))
                {
                    addressToMetadata[normalizedAddress] = metadata;
                    _logger.LogDebug("[TokenHydration] Registered metadata for address {Address}: symbol={Symbol}, name={Name}, hasLogo={HasLogo}", 
                        token.ContractAddress, token.Symbol ?? "EMPTY", token.Name ?? "EMPTY", hasLogo);
                }
                
                // Se veio do cache, também adicionar ao symbolToLogo
                if (hasSymbol && hasLogo && tokenLogos.TryGetValue(normalizedAddress, out var cachedLogo))
                {
                    var normalizedSymbol = token.Symbol!.ToUpperInvariant();
                    if (!symbolToLogo.ContainsKey(normalizedSymbol))
                    {
                        symbolToLogo[normalizedSymbol] = cachedLogo;
                    }
                }
            }
            
            // Se tem symbol+name, registrar independente de ter address
            if (hasSymbol && hasName)
            {
                var compositeKey = $"{token.Symbol!.ToUpperInvariant()}:{token.Name!.ToUpperInvariant()}";
                
                if (!symbolNameToMetadata.ContainsKey(compositeKey))
                {
                    var metadata = new TokenMetadata
                    {
                        Symbol = token.Symbol!,
                        Name = token.Name!,
                        LogoUrl = token.Logo
                    };
                    symbolNameToMetadata[compositeKey] = metadata;
                    _logger.LogDebug("[TokenHydration] Registered metadata for {Symbol}/{Name}, hasLogo={HasLogo}", 
                        token.Symbol, token.Name, hasLogo);
                }
            }
            
            // Registrar logo standalone por symbol
            if (hasSymbol && hasLogo)
            {
                var normalizedSymbol = token.Symbol!.ToUpperInvariant();
                if (!symbolToLogo.ContainsKey(normalizedSymbol))
                {
                    symbolToLogo[normalizedSymbol] = token.Logo!;
                }
            }
        }
        
        _logger.LogInformation("[TokenHydration] Collected metadata maps: addressToMetadata={AddressCount}, symbolNameToMetadata={SymbolNameCount}, symbolToLogo={SymbolCount}",
            addressToMetadata.Count, symbolNameToMetadata.Count, symbolToLogo.Count);

        // Segunda passagem: hidratar metadados faltantes em tokens incompletos
        foreach (var walletItem in walletItems)
        {
            if (walletItem.Position?.Tokens != null)
            {
                foreach (var token in walletItem.Position.Tokens)
                {
                    TokenMetadata? foundMetadata = null;
                    bool metadataChanged = false;
                    
                    // Estratégia 1: Buscar por ContractAddress (mais específico)
                    if (!string.IsNullOrEmpty(token.ContractAddress))
                    {
                        var normalizedAddress = token.ContractAddress.ToLowerInvariant();
                        
                        // 1a. Verificar no mapa local de metadados
                        if (addressToMetadata.TryGetValue(normalizedAddress, out foundMetadata))
                        {
                            _logger.LogDebug("[TokenHydration] Found metadata by address (local): {Address}", token.ContractAddress);
                        }
                        // 1b. Buscar no Redis cache
                        else
                        {
                            foundMetadata = await _metadataService.GetTokenMetadataAsync(normalizedAddress);
                            if (foundMetadata != null)
                            {
                                _logger.LogDebug("[TokenHydration] Found metadata by address (Redis): {Address}", token.ContractAddress);
                                // Adicionar ao mapa local para próximos tokens
                                addressToMetadata[normalizedAddress] = foundMetadata;
                            }
                        }
                        
                        // Aplicar metadados encontrados
                        if (foundMetadata != null)
                        {
                            if (string.IsNullOrEmpty(token.Symbol) && !string.IsNullOrEmpty(foundMetadata.Symbol))
                            {
                                token.Symbol = foundMetadata.Symbol;
                                metadataChanged = true;
                                _logger.LogDebug("[TokenHydration] Filled symbol by address: {Symbol} (address: {Address})", 
                                    foundMetadata.Symbol, token.ContractAddress);
                            }
                            if (string.IsNullOrEmpty(token.Name) && !string.IsNullOrEmpty(foundMetadata.Name))
                            {
                                token.Name = foundMetadata.Name;
                                metadataChanged = true;
                                _logger.LogDebug("[TokenHydration] Filled name by address: {Name} (address: {Address})", 
                                    foundMetadata.Name, token.ContractAddress);
                            }
                            if (string.IsNullOrEmpty(token.Logo) && !string.IsNullOrEmpty(foundMetadata.LogoUrl))
                            {
                                token.Logo = foundMetadata.LogoUrl;
                                metadataChanged = true;
                                _logger.LogDebug("[TokenHydration] Filled logo by address: {Address}", token.ContractAddress);
                            }
                            
                            // Se preenchemos dados, salvar no Redis para futura reutilização
                            if (metadataChanged)
                            {
                                var completeMetadata = new TokenMetadata
                                {
                                    Symbol = token.Symbol ?? foundMetadata.Symbol,
                                    Name = token.Name ?? foundMetadata.Name,
                                    LogoUrl = token.Logo ?? foundMetadata.LogoUrl
                                };
                                await _metadataService.SetTokenMetadataAsync(normalizedAddress, completeMetadata);
                            }
                            
                            // Se tudo foi preenchido, ir para próximo token
                            if (!string.IsNullOrEmpty(token.Symbol) && !string.IsNullOrEmpty(token.Name) && !string.IsNullOrEmpty(token.Logo))
                                continue;
                        }
                    }
                    
                    // Estratégia 2: Buscar por Symbol+Name (cross-chain)
                    if (!string.IsNullOrEmpty(token.Symbol) && !string.IsNullOrEmpty(token.Name))
                    {
                        var compositeKey = $"{token.Symbol.ToUpperInvariant()}:{token.Name.ToUpperInvariant()}";
                        
                        // 2a. Verificar no mapa local
                        if (symbolNameToMetadata.TryGetValue(compositeKey, out foundMetadata))
                        {
                            _logger.LogDebug("[TokenHydration] Found metadata by symbol+name (local): {Symbol}/{Name}", token.Symbol, token.Name);
                        }
                        // 2b. Buscar no Redis cache
                        else
                        {
                            foundMetadata = await _metadataService.GetTokenMetadataBySymbolAndNameAsync(token.Symbol, token.Name);
                            if (foundMetadata != null)
                            {
                                _logger.LogDebug("[TokenHydration] Found metadata by symbol+name (Redis): {Symbol}/{Name}", token.Symbol, token.Name);
                                // Adicionar ao mapa local para próximos tokens
                                symbolNameToMetadata[compositeKey] = foundMetadata;
                            }
                        }
                        
                        // Aplicar logo se encontrado (symbol e name já estão preenchidos)
                        if (foundMetadata != null && string.IsNullOrEmpty(token.Logo) && !string.IsNullOrEmpty(foundMetadata.LogoUrl))
                        {
                            token.Logo = foundMetadata.LogoUrl;
                            metadataChanged = true;
                            _logger.LogDebug("[TokenHydration] Filled logo by symbol+name: {Symbol}/{Name}", token.Symbol, token.Name);
                            
                            // Salvar no Redis por address se disponível
                            if (!string.IsNullOrEmpty(token.ContractAddress))
                            {
                                var completeMetadata = new TokenMetadata
                                {
                                    Symbol = token.Symbol,
                                    Name = token.Name,
                                    LogoUrl = token.Logo
                                };
                                await _metadataService.SetTokenMetadataAsync(token.ContractAddress.ToLowerInvariant(), completeMetadata);
                            }
                            continue;
                        }
                    }
                    
                    // Estratégia 3: Buscar logo apenas por Symbol (fallback menos específico)
                    if (!string.IsNullOrEmpty(token.Symbol) && string.IsNullOrEmpty(token.Logo))
                    {
                        var normalizedSymbol = token.Symbol.ToUpperInvariant();
                        if (symbolToLogo.TryGetValue(normalizedSymbol, out var logoUrl) && !string.IsNullOrEmpty(logoUrl))
                        {
                            token.Logo = logoUrl;
                            _logger.LogDebug("[TokenHydration] Filled logo by symbol fallback: {Symbol}", token.Symbol);
                        }
                    }
                    
                    // Log para tokens que ainda estão incompletos
                    var missingFields = new List<string>();
                    if (string.IsNullOrEmpty(token.Symbol)) missingFields.Add("symbol");
                    if (string.IsNullOrEmpty(token.Name)) missingFields.Add("name");
                    if (string.IsNullOrEmpty(token.Logo)) missingFields.Add("logo");
                    
                    if (missingFields.Any())
                    {
                        _logger.LogWarning("[TokenHydration] Token still missing [{Missing}]: address={Address}, symbol={Symbol}, name={Name}", 
                            string.Join(", ", missingFields), 
                            token.ContractAddress ?? "N/A", 
                            token.Symbol ?? "N/A", 
                            token.Name ?? "N/A");
                    }
                }
            }
        }
    }

    private static HashSet<string> ExtractUniqueTokens(IEnumerable<WalletItem> walletItems)
    {
        var uniqueTokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var walletItem in walletItems)
        {
            if (walletItem.Position?.Tokens != null)
            {
                foreach (var token in walletItem.Position.Tokens)
                {
                    if (!string.IsNullOrEmpty(token.ContractAddress))
                    {
                        uniqueTokens.Add(token.ContractAddress.ToLowerInvariant());
                    }
                }
            }
        }

        return uniqueTokens;
    }

    private static Dictionary<string, string> ExtractLogosFromTokens(IEnumerable<WalletItem> walletItems)
    {
        var tokenLogos = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var walletItem in walletItems)
        {
            if (walletItem.Position?.Tokens != null)
            {
                foreach (var token in walletItem.Position.Tokens)
                {
                    if (!string.IsNullOrEmpty(token.ContractAddress) && !string.IsNullOrEmpty(token.Logo))
                    {
                        var normalizedAddress = token.ContractAddress.ToLowerInvariant();
                        if (!tokenLogos.ContainsKey(normalizedAddress))
                        {
                            tokenLogos[normalizedAddress] = token.Logo;
                        }
                    }
                }
            }
        }

        return tokenLogos;
    }
}
