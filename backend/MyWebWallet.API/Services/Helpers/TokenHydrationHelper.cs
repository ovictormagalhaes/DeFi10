using MyWebWallet.API.Models;
using MyWebWallet.API.Services.Interfaces;

namespace MyWebWallet.API.Services.Helpers;

public class TokenHydrationHelper
{
    private readonly ITokenLogoService _tokenLogoService;

    public TokenHydrationHelper(ITokenLogoService tokenLogoService)
    {
        _tokenLogoService = tokenLogoService;
    }

    public async Task<Dictionary<string, string?>> HydrateTokenLogosAsync(
        IEnumerable<WalletItem> walletItems, 
        Chain chain, 
        Dictionary<string, string>? incomingLogos = null)
    {
        // 1. Extract all unique token addresses from wallet items
        var uniqueTokens = ExtractUniqueTokens(walletItems);
        
        if (!uniqueTokens.Any())
            return new Dictionary<string, string?>();

        Console.WriteLine($"DEBUG: TokenHydrationHelper: Found {uniqueTokens.Count} unique tokens for hydration on {chain}");

        // 2. Batch get existing logos from our database
        var existingLogos = await _tokenLogoService.GetTokenLogosAsync(uniqueTokens, chain);

        // 3. Extract logos that are already present in the tokens (from APIs)
        var logosFromTokens = ExtractLogosFromTokens(walletItems);

        // 4. Identify tokens that need logos to be stored (from incoming data or token data)
        var tokensToStore = new Dictionary<string, string>();
        
        // First, check logos from the tokens themselves
        foreach (var kvp in logosFromTokens)
        {
            var normalizedAddress = kvp.Key.ToLowerInvariant();
            
            // Only store if we don't already have this token and token has a logo
            if (!existingLogos.ContainsKey(normalizedAddress) || 
                string.IsNullOrEmpty(existingLogos[normalizedAddress]))
            {
                if (!string.IsNullOrEmpty(kvp.Value))
                {
                    tokensToStore[normalizedAddress] = kvp.Value;
                    existingLogos[normalizedAddress] = kvp.Value; // Update local result
                }
            }
        }

        // Then, check incoming logos (if provided)
        if (incomingLogos != null)
        {
            foreach (var kvp in incomingLogos)
            {
                var normalizedAddress = kvp.Key.ToLowerInvariant();
                
                // Only store if we don't already have this token and incoming has a logo
                if (!existingLogos.ContainsKey(normalizedAddress) || 
                    string.IsNullOrEmpty(existingLogos[normalizedAddress]))
                {
                    if (!string.IsNullOrEmpty(kvp.Value))
                    {
                        tokensToStore[normalizedAddress] = kvp.Value;
                        existingLogos[normalizedAddress] = kvp.Value; // Update local result
                    }
                }
            }
        }

        // 5. Batch store new logos
        if (tokensToStore.Any())
        {
            await _tokenLogoService.SetTokenLogosAsync(tokensToStore, chain);
            Console.WriteLine($"DEBUG: TokenHydrationHelper: Stored {tokensToStore.Count} new token logos on {chain}");
        }

        return existingLogos;
    }

    public void ApplyTokenLogosToWalletItems(IEnumerable<WalletItem> walletItems, Dictionary<string, string?> tokenLogos)
    {
        foreach (var walletItem in walletItems)
        {
            if (walletItem.Position?.Tokens != null)
            {
                foreach (var token in walletItem.Position.Tokens)
                {
                    // Only apply logo if token doesn't already have one and we have a logo in our database
                    if (!string.IsNullOrEmpty(token.ContractAddress) && string.IsNullOrEmpty(token.Logo))
                    {
                        var normalizedAddress = token.ContractAddress.ToLowerInvariant();
                        if (tokenLogos.TryGetValue(normalizedAddress, out var logoUrl) && !string.IsNullOrEmpty(logoUrl))
                        {
                            token.Logo = logoUrl;
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
                        // Only add if we don't already have this token (first occurrence wins)
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