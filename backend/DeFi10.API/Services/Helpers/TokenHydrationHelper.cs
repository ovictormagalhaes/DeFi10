using DeFi10.API.Models;
using DeFi10.API.Services.Interfaces;
using DeFi10.API.Services.Infrastructure.MoralisSolana;

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
        
        // Build a map of address -> token data for reference
        var addressToTokenData = new Dictionary<string, Token>(StringComparer.OrdinalIgnoreCase);
        foreach (var walletItem in walletItems)
        {
            if (walletItem.Position?.Tokens != null)
            {
                foreach (var token in walletItem.Position.Tokens)
                {
                    if (!string.IsNullOrEmpty(token.ContractAddress))
                    {
                        var normalizedAddress = token.ContractAddress.ToLowerInvariant();
                        if (!addressToTokenData.ContainsKey(normalizedAddress))
                        {
                            addressToTokenData[normalizedAddress] = token;
                        }
                    }
                }
            }
        }

        foreach (var tokenAddress in uniqueTokens)
        {
            var normalizedAddress = tokenAddress.ToLowerInvariant();

            var metadata = await _metadataService.GetTokenMetadataAsync(chain, normalizedAddress);
            
            if (metadata?.LogoUrl != null)
            {
                existingLogos[normalizedAddress] = metadata.LogoUrl;
            }
            else
            {
                // Try to get token data for this address
                Token? tokenData = null;
                addressToTokenData.TryGetValue(normalizedAddress, out tokenData);

                if (incomingLogos?.TryGetValue(normalizedAddress, out var incomingLogo) == true && !string.IsNullOrEmpty(incomingLogo))
                {
                    // Skip tokens with price = 0 (likely spam)
                    var tokenPrice = tokenData?.Financials?.Price;
                    if (tokenPrice.HasValue && tokenPrice.Value == 0)
                    {
                        _logger.LogDebug("[TokenHydration] Skipping token with price = 0: {Symbol} ({Name}) - Address: {Address}",
                            tokenData?.Symbol, tokenData?.Name, normalizedAddress);
                        continue;
                    }
                    
                    existingLogos[normalizedAddress] = incomingLogo;

                    // ✅ Extract symbol and name from token data
                    tokensToStore[normalizedAddress] = new TokenMetadata
                    {
                        Symbol = tokenData?.Symbol ?? string.Empty,
                        Name = tokenData?.Name ?? string.Empty,
                        LogoUrl = incomingLogo
                    };
                    
                    _logger.LogDebug("[TokenHydration] Prepared to store metadata: address={Address}, symbol={Symbol}, name={Name}, hasLogo={HasLogo}",
                        normalizedAddress, tokenData?.Symbol ?? "EMPTY", tokenData?.Name ?? "EMPTY", true);
                }
            }
        }

        var logosFromTokens = ExtractLogosFromTokens(walletItems);
        foreach (var kvp in logosFromTokens)
        {
            var normalizedAddress = kvp.Key.ToLowerInvariant();
            
            if (!existingLogos.ContainsKey(normalizedAddress) && !string.IsNullOrEmpty(kvp.Value))
            {
                // ✅ Extract symbol and name from token data
                Token? tokenData = null;
                addressToTokenData.TryGetValue(normalizedAddress, out tokenData);
                
                // Skip tokens with price = 0 (likely spam)
                var tokenPrice = tokenData?.Financials?.Price;
                if (tokenPrice.HasValue && tokenPrice.Value == 0)
                {
                    _logger.LogDebug("[TokenHydration] Skipping token with price = 0: {Symbol} ({Name}) - Address: {Address}",
                        tokenData?.Symbol, tokenData?.Name, normalizedAddress);
                    continue;
                }
                
                existingLogos[normalizedAddress] = kvp.Value;
                
                tokensToStore[normalizedAddress] = new TokenMetadata
                {
                    Symbol = tokenData?.Symbol ?? string.Empty,
                    Name = tokenData?.Name ?? string.Empty,
                    LogoUrl = kvp.Value,
                    PriceUsd = tokenData?.Financials?.Price
                };
                
                _logger.LogDebug("[TokenHydration] Prepared to store metadata from existing token: address={Address}, symbol={Symbol}, name={Name}, hasLogo={HasLogo}",
                    normalizedAddress, tokenData?.Symbol ?? "EMPTY", tokenData?.Name ?? "EMPTY", true);
            }
        }

        // ✅ Save all metadata to storage via TokenMetadataService
        foreach (var kvp in tokensToStore)
        {
            await _metadataService.SetTokenMetadataAsync(chain, kvp.Key, kvp.Value);
            _logger.LogInformation("[TokenHydration] Stored metadata BY ADDRESS: address={Address}, symbol={Symbol}, name={Name}, logo={HasLogo}",
                kvp.Key, kvp.Value.Symbol, kvp.Value.Name, !string.IsNullOrEmpty(kvp.Value.LogoUrl));
            
            // ✅ ALSO log symbol+name indexing
            if (!string.IsNullOrEmpty(kvp.Value.Symbol) && !string.IsNullOrEmpty(kvp.Value.Name))
            {
                _logger.LogInformation("[TokenHydration] Metadata also indexed BY SYMBOL+NAME: {Symbol}/{Name}",
                    kvp.Value.Symbol, kvp.Value.Name);
            }
        }

        if (tokensToStore.Any())
        {
            _logger.LogDebug("Stored {TokenCount} new token metadata entries on {Chain}", tokensToStore.Count, chain);
        }

        return existingLogos;
    }

    public (Dictionary<string, TokenMetadata> AddressToMetadata, 
            Dictionary<string, TokenMetadata> SymbolNameToMetadata, 
            Dictionary<string, string> SymbolToLogo) BuildMetadataDictionaries(IEnumerable<WalletItem> walletItems)
    {
        var addressToMetadata = new Dictionary<string, TokenMetadata>(StringComparer.OrdinalIgnoreCase);
        var symbolNameToMetadata = new Dictionary<string, TokenMetadata>(StringComparer.OrdinalIgnoreCase);
        var symbolToLogo = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var allTokens = walletItems.SelectMany(wi => wi.Position?.Tokens ?? Enumerable.Empty<Token>()).ToList();
        
        foreach (var token in allTokens)
        {
            var hasSymbol = !string.IsNullOrEmpty(token.Symbol);
            var hasName = !string.IsNullOrEmpty(token.Name);
            var hasLogo = !string.IsNullOrEmpty(token.Logo);
            var hasAddress = !string.IsNullOrEmpty(token.ContractAddress);
            
            if (hasAddress && (hasSymbol || hasName || hasLogo))
            {
                var normalizedAddress = token.ContractAddress!.ToLowerInvariant();
                
                var metadata = new TokenMetadata
                {
                    Symbol = token.Symbol ?? string.Empty,
                    Name = token.Name ?? string.Empty,
                    LogoUrl = token.Logo,
                    PriceUsd = token.Financials?.Price
                };
                
                if (!addressToMetadata.ContainsKey(normalizedAddress))
                {
                    addressToMetadata[normalizedAddress] = metadata;
                    _logger.LogDebug("[TokenHydration] Registered metadata for address {Address}: symbol={Symbol}, name={Name}, hasLogo={HasLogo}", 
                        token.ContractAddress, token.Symbol ?? "EMPTY", token.Name ?? "EMPTY", hasLogo);
                }
            }
            
            if (hasSymbol && hasName)
            {
                var compositeKey = $"{token.Symbol!.ToUpperInvariant()}:{token.Name!.ToUpperInvariant()}";
                
                // Only add/update if:
                // 1. Key doesn't exist, OR
                // 2. Existing entry has no price but current token has price, OR
                // 3. Existing entry has no logo but current token has logo
                var tokenPrice = token.Financials?.Price > 0 ? token.Financials.Price : null;
                
                if (!symbolNameToMetadata.TryGetValue(compositeKey, out var existingMetadata))
                {
                    // New entry - add it
                    var metadata = new TokenMetadata
                    {
                        Symbol = token.Symbol!,
                        Name = token.Name!,
                        LogoUrl = token.Logo,
                        PriceUsd = tokenPrice
                    };
                    symbolNameToMetadata[compositeKey] = metadata;
                    _logger.LogInformation("[TokenHydration] Registered NEW metadata for {Symbol}/{Name}, hasLogo={HasLogo}, priceUsd={Price}", 
                        token.Symbol, token.Name, hasLogo, metadata.PriceUsd);
                }
                else
                {
                    // Update existing entry if current token has better data
                    bool updated = false;
                    
                    if (existingMetadata.PriceUsd == null && tokenPrice.HasValue)
                    {
                        existingMetadata.PriceUsd = tokenPrice;
                        updated = true;
                        _logger.LogInformation("[TokenHydration] UPDATED price for {Symbol}/{Name}: {Price}", 
                            token.Symbol, token.Name, tokenPrice);
                    }
                    
                    if (string.IsNullOrEmpty(existingMetadata.LogoUrl) && hasLogo)
                    {
                        existingMetadata.LogoUrl = token.Logo;
                        updated = true;
                        _logger.LogInformation("[TokenHydration] UPDATED logo for {Symbol}/{Name}", 
                            token.Symbol, token.Name);
                    }
                    
                    if (updated)
                    {
                        _logger.LogInformation("[TokenHydration] Final metadata for {Symbol}/{Name}: hasLogo={HasLogo}, hasPrice={HasPrice}", 
                            token.Symbol, token.Name, !string.IsNullOrEmpty(existingMetadata.LogoUrl), existingMetadata.PriceUsd.HasValue);
                    }
                }
            }
            
            if (hasSymbol && hasLogo)
            {
                var normalizedSymbol = token.Symbol!.ToUpperInvariant();
                if (!symbolToLogo.ContainsKey(normalizedSymbol))
                {
                    symbolToLogo[normalizedSymbol] = token.Logo!;
                }
            }
        }
        
        _logger.LogInformation("[TokenHydration] Built metadata dictionaries: addressToMetadata={AddressCount}, symbolNameToMetadata={SymbolNameCount}, symbolToLogo={SymbolCount}",
            addressToMetadata.Count, symbolNameToMetadata.Count, symbolToLogo.Count);

        return (addressToMetadata, symbolNameToMetadata, symbolToLogo);
    }

    public async Task ApplyTokenLogosToWalletItemsAsync(
        IEnumerable<WalletItem> walletItemsToProcess, 
        Dictionary<string, string?> tokenLogos, 
        Chain chain,
        (Dictionary<string, TokenMetadata> AddressToMetadata, 
         Dictionary<string, TokenMetadata> SymbolNameToMetadata, 
         Dictionary<string, string> SymbolToLogo) metadataDictionaries)
    {
        var (addressToMetadata, symbolNameToMetadata, symbolToLogo) = metadataDictionaries;

        _logger.LogInformation("[TokenHydration] Using metadata dictionaries: addressToMetadata={AddressCount}, symbolNameToMetadata={SymbolNameCount}, symbolToLogo={SymbolCount}",
            addressToMetadata.Count, symbolNameToMetadata.Count, symbolToLogo.Count);

        foreach (var walletItem in walletItemsToProcess)
        {
            if (walletItem.Position?.Tokens != null)
            {
                _logger.LogInformation("[TokenHydration] Processing {TokenCount} tokens in wallet item", walletItem.Position.Tokens.Count);
                
                foreach (var token in walletItem.Position.Tokens)
                {
                    _logger.LogInformation("[TokenHydration] Processing token: address={Address}, symbol={Symbol}, name={Name}, currentPrice={Price}", 
                        token.ContractAddress, token.Symbol, token.Name, token.Financials?.Price);
                    
                    TokenMetadata? foundMetadata = null;
                    
                    if (!string.IsNullOrEmpty(token.ContractAddress))
                    {
                        var normalizedAddress = token.ContractAddress.ToLowerInvariant();
                        
                        // Always try to get from MongoDB if we need price data
                        var needsPriceFromDb = token.Financials?.Price == null || token.Financials.Price == 0;
                        
                        if (addressToMetadata.TryGetValue(normalizedAddress, out foundMetadata) && !needsPriceFromDb)
                        {
                            _logger.LogDebug("[TokenHydration] Found metadata by address (local): {Address}", token.ContractAddress);
                        }
                        else
                        {
                            // Fetch from MongoDB to get price data
                            foundMetadata = await _metadataService.GetTokenMetadataAsync(chain, normalizedAddress);
                            if (foundMetadata != null)
                            {
                                _logger.LogInformation("[TokenHydration] Found metadata by address (storage): {Address}, symbol={Symbol}, name={Name}, hasLogo={HasLogo}, priceUsd={PriceUsd}", 
                                    token.ContractAddress, foundMetadata.Symbol, foundMetadata.Name, 
                                    !string.IsNullOrEmpty(foundMetadata.LogoUrl), foundMetadata.PriceUsd);
                                addressToMetadata[normalizedAddress] = foundMetadata;
                            }
                            else
                            {
                                _logger.LogWarning("[TokenHydration] Metadata NOT FOUND in storage: address={Address}, chain={Chain}", 
                                    token.ContractAddress, chain);
                            }
                        }
                        
                        if (foundMetadata != null)
                        {
                            bool needsMetadataUpdate = false;
                            
                            if (string.IsNullOrEmpty(token.Symbol) && !string.IsNullOrEmpty(foundMetadata.Symbol))
                            {
                                token.Symbol = foundMetadata.Symbol;
                                needsMetadataUpdate = true;
                                _logger.LogDebug("[TokenHydration] Filled symbol by address: {Symbol} (address: {Address})", 
                                    foundMetadata.Symbol, token.ContractAddress);
                            }
                            if (string.IsNullOrEmpty(token.Name) && !string.IsNullOrEmpty(foundMetadata.Name))
                            {
                                token.Name = foundMetadata.Name;
                                needsMetadataUpdate = true;
                                _logger.LogDebug("[TokenHydration] Filled name by address: {Name} (address: {Address})", 
                                    foundMetadata.Name, token.ContractAddress);
                            }
                            if (string.IsNullOrEmpty(token.Logo) && !string.IsNullOrEmpty(foundMetadata.LogoUrl))
                            {
                                token.Logo = foundMetadata.LogoUrl;
                                needsMetadataUpdate = true;
                                _logger.LogDebug("[TokenHydration] Filled logo by address: {Address}", token.ContractAddress);
                            }
                            
                            // Hydrate price from MongoDB if current price is 0 or null
                            if (foundMetadata.PriceUsd.HasValue && foundMetadata.PriceUsd.Value > 0)
                            {
                                var currentPrice = token.Financials?.Price;
                                _logger.LogDebug("[TokenHydration] Checking price hydration: address={Address}, symbol={Symbol}, currentPrice={CurrentPrice}, dbPrice={DbPrice}", 
                                    token.ContractAddress, token.Symbol, currentPrice, foundMetadata.PriceUsd.Value);
                                    
                                if (currentPrice == null || currentPrice == 0)
                                {
                                    if (token.Financials == null)
                                        token.Financials = new TokenFinancials();
                                        
                                    token.Financials.Price = foundMetadata.PriceUsd.Value;
                                    
                                    // Calculate TotalPrice using BalanceFormatted
                                    if (token.Financials.BalanceFormatted.HasValue)
                                    {
                                        token.Financials.TotalPrice = token.Financials.BalanceFormatted.Value * foundMetadata.PriceUsd.Value;
                                    }
                                    
                                    _logger.LogInformation("[TokenHydration] ✅ Filled price by address: {Price} USD (address: {Address}, symbol: {Symbol}, balance: {Balance}, totalPrice: {TotalPrice})", 
                                        foundMetadata.PriceUsd.Value, token.ContractAddress, token.Symbol, 
                                        token.Financials.BalanceFormatted, token.Financials.TotalPrice);
                                }
                                else
                                {
                                    _logger.LogDebug("[TokenHydration] Price already set, skipping: address={Address}, symbol={Symbol}, price={Price}", 
                                        token.ContractAddress, token.Symbol, currentPrice);
                                }
                            }
                            else
                            {
                                _logger.LogDebug("[TokenHydration] No valid price in DB: address={Address}, symbol={Symbol}, dbPriceUsd={DbPrice}", 
                                    token.ContractAddress, token.Symbol, foundMetadata.PriceUsd);
                            }
                            
                            if (needsMetadataUpdate)
                            {
                                var completeMetadata = new TokenMetadata
                                {
                                    Symbol = token.Symbol ?? foundMetadata.Symbol,
                                    Name = token.Name ?? foundMetadata.Name,
                                    LogoUrl = token.Logo ?? foundMetadata.LogoUrl
                                };
                                await _metadataService.SetTokenMetadataAsync(chain, normalizedAddress, completeMetadata);
                            }
                            
                            // Skip further lookups only if all metadata fields AND price are complete
                            var hasCompleteMetadata = !string.IsNullOrEmpty(token.Symbol) && 
                                                     !string.IsNullOrEmpty(token.Name) && 
                                                     !string.IsNullOrEmpty(token.Logo);
                            var hasValidPrice = token.Financials?.Price != null && token.Financials.Price > 0;
                            
                            if (hasCompleteMetadata && hasValidPrice)
                                continue;
                        }
                    }
                    
                    // Try to find metadata by symbol+name if:
                    // 1. Logo is missing, OR
                    // 2. Price is missing/zero (even if logo exists)
                    var needsLogoFallback = !string.IsNullOrEmpty(token.Symbol) && !string.IsNullOrEmpty(token.Name) && string.IsNullOrEmpty(token.Logo);
                    var needsPriceFallback = !string.IsNullOrEmpty(token.Symbol) && !string.IsNullOrEmpty(token.Name) && 
                                            (token.Financials?.Price == null || token.Financials.Price == 0);
                    
                    _logger.LogInformation("[TokenHydration] Fallback check: address={Address}, symbol={Symbol}, name={Name}, logo={HasLogo}, price={Price}, needsLogoFallback={NeedsLogo}, needsPriceFallback={NeedsPrice}",
                        token.ContractAddress, token.Symbol, token.Name, !string.IsNullOrEmpty(token.Logo), token.Financials?.Price, needsLogoFallback, needsPriceFallback);
                    
                    if (needsLogoFallback || needsPriceFallback)
                    {
                        try
                        {
                            var compositeKey = $"{token.Symbol!.ToUpperInvariant()}:{token.Name!.ToUpperInvariant()}";
                            
                            if (symbolNameToMetadata.TryGetValue(compositeKey, out foundMetadata))
                            {
                                _logger.LogInformation("[TokenHydration] Found metadata by symbol+name (local): {Symbol}/{Name}", token.Symbol, token.Name);
                            }
                            else
                            {
                                _logger.LogInformation("[TokenHydration] Calling GetTokenMetadataBySymbolAndNameAsync for symbol={Symbol}, name={Name}", token.Symbol, token.Name);
                                foundMetadata = await _metadataService.GetTokenMetadataBySymbolAndNameAsync(token.Symbol, token.Name);
                                if (foundMetadata != null)
                                {
                                    _logger.LogInformation("[TokenHydration] Found metadata by symbol+name (storage/CMC): {Symbol}/{Name}", token.Symbol, token.Name);
                                    symbolNameToMetadata[compositeKey] = foundMetadata;
                                }
                                else
                                {
                                    _logger.LogWarning("[TokenHydration] Symbol+name lookup FAILED: compositeKey={CompositeKey}, symbol={Symbol}, name={Name}", 
                                        compositeKey, token.Symbol, token.Name);
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "[TokenHydration] EXCEPTION during symbol+name fallback: symbol={Symbol}, name={Name}", token.Symbol, token.Name);
                        }
                        
                        if (foundMetadata != null)
                        {
                            _logger.LogInformation("[TokenHydration] Found metadata details: Symbol={Symbol}, Name={Name}, LogoUrl={Logo}, PriceUsd={Price}", 
                                foundMetadata.Symbol, foundMetadata.Name, foundMetadata.LogoUrl, foundMetadata.PriceUsd);
                            
                            bool metadataUpdated = false;
                            
                            // Fill logo if missing
                            if (string.IsNullOrEmpty(token.Logo) && !string.IsNullOrEmpty(foundMetadata.LogoUrl))
                            {
                                token.Logo = foundMetadata.LogoUrl;
                                metadataUpdated = true;
                                _logger.LogInformation("[TokenHydration] Filled logo by symbol+name: {Symbol}/{Name}", token.Symbol, token.Name);
                            }
                            
                            // Fill price if missing/zero
                            if (needsPriceFallback && foundMetadata.PriceUsd.HasValue && foundMetadata.PriceUsd.Value > 0)
                            {
                                if (token.Financials == null)
                                    token.Financials = new TokenFinancials();
                                    
                                token.Financials.Price = foundMetadata.PriceUsd.Value;
                                
                                // Calculate TotalPrice using BalanceFormatted
                                if (token.Financials.BalanceFormatted.HasValue)
                                {
                                    token.Financials.TotalPrice = token.Financials.BalanceFormatted.Value * foundMetadata.PriceUsd.Value;
                                }
                                
                                metadataUpdated = true;
                                _logger.LogInformation("[TokenHydration] ✅ Filled price by symbol+name: {Price} USD (symbol: {Symbol}, name: {Name}, balance: {Balance}, totalPrice: {TotalPrice})", 
                                    foundMetadata.PriceUsd.Value, token.Symbol, token.Name,
                                    token.Financials.BalanceFormatted, token.Financials.TotalPrice);
                            }
                            else if (needsPriceFallback)
                            {
                                _logger.LogWarning("[TokenHydration] ⚠️ Cannot fill price: needsPriceFallback={NeedsFallback}, PriceUsd.HasValue={HasValue}, PriceUsd.Value={Value}", 
                                    needsPriceFallback, foundMetadata.PriceUsd.HasValue, foundMetadata.PriceUsd);
                            }
                            
                            // Store the updated metadata
                            if (metadataUpdated && !string.IsNullOrEmpty(token.ContractAddress))
                            {
                                var completeMetadata = new TokenMetadata
                                {
                                    Symbol = token.Symbol,
                                    Name = token.Name,
                                    LogoUrl = token.Logo,
                                    PriceUsd = token.Financials?.Price
                                };
                                await _metadataService.SetTokenMetadataAsync(chain, token.ContractAddress.ToLowerInvariant(), completeMetadata);
                            }
                            
                            if (metadataUpdated)
                                continue;
                        }
                    }
                    
                    if (!string.IsNullOrEmpty(token.Symbol) && string.IsNullOrEmpty(token.Logo))
                    {
                        var normalizedSymbol = token.Symbol.ToUpperInvariant();
                        if (symbolToLogo.TryGetValue(normalizedSymbol, out var logoUrl) && !string.IsNullOrEmpty(logoUrl))
                        {
                            token.Logo = logoUrl;
                            _logger.LogDebug("[TokenHydration] Filled logo by symbol fallback: {Symbol}", token.Symbol);
                        }
                    }
                    
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
