using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Solana;

namespace MyWebWallet.API.Services.Helpers;

/// <summary>
/// Hydrates token metadata (logos, symbols, names) using the new ITokenMetadataService
/// </summary>
public class TokenHydrationHelper
{
    private readonly ITokenMetadataService _metadataService;

    public TokenHydrationHelper(ITokenMetadataService metadataService)
    {
        _metadataService = metadataService;
    }

    /// <summary>
    /// Hydrates token logos and metadata for all tokens in wallet items
    /// </summary>
    public async Task<Dictionary<string, string?>> HydrateTokenLogosAsync(
        IEnumerable<WalletItem> walletItems, 
        Chain chain, 
        Dictionary<string, string>? incomingLogos = null)
    {
        var uniqueTokens = ExtractUniqueTokens(walletItems);
        
        if (!uniqueTokens.Any())
            return new Dictionary<string, string?>();

        Console.WriteLine($"DEBUG: TokenHydrationHelper: Found {uniqueTokens.Count} unique tokens for hydration on {chain}");

        var existingLogos = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        var tokensToStore = new Dictionary<string, TokenMetadata>();

        // Fetch metadata from cache/CMC for each token
        foreach (var tokenAddress in uniqueTokens)
        {
            var normalizedAddress = tokenAddress.ToLowerInvariant();
            
            // Try to get from metadata service
            var metadata = await _metadataService.GetTokenMetadataAsync(normalizedAddress);
            
            if (metadata?.LogoUrl != null)
            {
                existingLogos[normalizedAddress] = metadata.LogoUrl;
            }
            else
            {
                // Check if incoming logos has this token
                if (incomingLogos?.TryGetValue(normalizedAddress, out var incomingLogo) == true && !string.IsNullOrEmpty(incomingLogo))
                {
                    existingLogos[normalizedAddress] = incomingLogo;
                    
                    // Store new metadata
                    tokensToStore[normalizedAddress] = new TokenMetadata
                    {
                        Symbol = string.Empty,
                        Name = string.Empty,
                        LogoUrl = incomingLogo
                    };
                }
            }
        }

        // Extract logos from tokens themselves
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

        // Store new metadata
        foreach (var kvp in tokensToStore)
        {
            await _metadataService.SetTokenMetadataAsync(kvp.Key, kvp.Value);
        }

        if (tokensToStore.Any())
        {
            Console.WriteLine($"DEBUG: TokenHydrationHelper: Stored {tokensToStore.Count} new token metadata entries on {chain}");
        }

        return existingLogos;
    }

    /// <summary>
    /// Applies logos to wallet items based on metadata lookup
    /// </summary>
    public void ApplyTokenLogosToWalletItems(IEnumerable<WalletItem> walletItems, Dictionary<string, string?> tokenLogos)
    {
        // Build symbol → logo mapping for fallback lookup
        var symbolToLogo = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        
        // Collect all known logos by symbol
        var allTokens = walletItems.SelectMany(wi => wi.Position?.Tokens ?? Enumerable.Empty<Token>()).ToList();
        
        foreach (var token in allTokens)
        {
            if (string.IsNullOrEmpty(token.Symbol)) continue;
            
            // If we have logo by address, use it for symbol mapping
            if (!string.IsNullOrEmpty(token.ContractAddress))
            {
                var normalizedAddress = token.ContractAddress.ToLowerInvariant();
                if (tokenLogos.TryGetValue(normalizedAddress, out var logoByAddress) && !string.IsNullOrEmpty(logoByAddress))
                {
                    var normalizedSymbol = token.Symbol.ToUpperInvariant();
                    if (!symbolToLogo.ContainsKey(normalizedSymbol))
                    {
                        symbolToLogo[normalizedSymbol] = logoByAddress;
                    }
                }
            }
            
            // If token already has a logo, add to symbol mapping
            if (!string.IsNullOrEmpty(token.Logo))
            {
                var normalizedSymbol = token.Symbol.ToUpperInvariant();
                if (!symbolToLogo.ContainsKey(normalizedSymbol))
                {
                    symbolToLogo[normalizedSymbol] = token.Logo;
                }
            }
        }

        // Apply logos with fallback
        foreach (var walletItem in walletItems)
        {
            if (walletItem.Position?.Tokens != null)
            {
                foreach (var token in walletItem.Position.Tokens)
                {
                    // Skip if token already has a logo
                    if (!string.IsNullOrEmpty(token.Logo)) continue;
                    
                    string? logoUrl = null;
                    
                    // Strategy 1: Try by contract address (primary)
                    if (!string.IsNullOrEmpty(token.ContractAddress))
                    {
                        var normalizedAddress = token.ContractAddress.ToLowerInvariant();
                        if (tokenLogos.TryGetValue(normalizedAddress, out logoUrl) && !string.IsNullOrEmpty(logoUrl))
                        {
                            token.Logo = logoUrl;
                            continue;
                        }
                    }
                    
                    // Strategy 2: Fallback by symbol (secondary)
                    if (!string.IsNullOrEmpty(token.Symbol))
                    {
                        var normalizedSymbol = token.Symbol.ToUpperInvariant();
                        if (symbolToLogo.TryGetValue(normalizedSymbol, out logoUrl) && !string.IsNullOrEmpty(logoUrl))
                        {
                            token.Logo = logoUrl;
                            Console.WriteLine($"DEBUG: TokenHydrationHelper: Applied logo by symbol fallback - {token.Symbol}");
                            continue;
                        }
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
