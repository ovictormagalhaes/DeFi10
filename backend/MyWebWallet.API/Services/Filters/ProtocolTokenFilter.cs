using System.Collections.Generic;
using System.Linq;

namespace MyWebWallet.API.Services.Filters
{
    /// <summary>
    /// Filters protocol receipt tokens to avoid double-counting in wallet balance.
    /// Protocol tokens (like aTokens from Aave, staked tokens, LP tokens) should be filtered
    /// from wallet views since their underlying value is already counted in protocol positions.
    /// </summary>
    public static class ProtocolTokenFilter
    {
        // Known protocol token prefixes that represent staked/lent/wrapped tokens
        private static readonly HashSet<string> ProtocolTokenPrefixes = new(StringComparer.OrdinalIgnoreCase)
        {
            "a",      // Aave tokens (aUSDC, aWETH, aBasUSDC, aBasWETH, aEthUSDC)
            "st",     // Staked tokens (stETH, stSOL)
            "c",      // Compound tokens (cUSDC, cDAI)
            "j",      // Jito tokens (JitoSOL)
            "m",      // Marinade tokens (mSOL)
            "b",      // BlazeStake tokens (bSOL)
            "variableDebt",  // Aave variable debt tokens
            "stableDebt",    // Aave stable debt tokens
        };

        // Exception list - tokens that look like protocol tokens but aren't
        private static readonly HashSet<string> ProtocolTokenExceptions = new(StringComparer.OrdinalIgnoreCase)
        {
            "WETH",   // Wrapped ETH is a base token, not a receipt
            "WBTC",   // Wrapped BTC is a base token
            "WSOL",   // Wrapped SOL is a base token
            "WAVAX",  // Wrapped AVAX is a base token
            "WMATIC", // Wrapped MATIC is a base token
            "WBNB",   // Wrapped BNB is a base token
            "ATOM",   // Cosmos token (starts with 'a')
            "ADA",    // Cardano token (starts with 'a')
        };

        /// <summary>
        /// Determines if a token should be filtered out to avoid double-counting.
        /// Uses symbol patterns and contract address matching.
        /// </summary>
        /// <param name="symbol">Token symbol (e.g., "aBasUSDC", "JitoSOL")</param>
        /// <param name="contractAddress">Token contract address (optional, for precise matching)</param>
        /// <returns>True if the token should be filtered (hidden from wallet)</returns>
        public static bool ShouldFilterToken(string? symbol, string? contractAddress = null)
        {
            if (string.IsNullOrWhiteSpace(symbol))
                return false;

            // Check exceptions first (tokens that look like protocol tokens but aren't)
            if (ProtocolTokenExceptions.Contains(symbol))
                return false;

            // Check by symbol patterns
            return HasProtocolTokenPattern(symbol);
        }

        /// <summary>
        /// Checks if symbol matches known protocol token patterns.
        /// </summary>
        private static bool HasProtocolTokenPattern(string symbol)
        {
            // Aave-style tokens (aToken format: a + Base/chain name + underlying)
            // Examples: aBasUSDC, aBasWETH, aEthUSDC, aArbUSDC
            if (symbol.StartsWith('a') && symbol.Length > 1 && char.IsUpper(symbol[1]))
            {
                // Check if it's a known Aave format
                // Pattern: a[ChainName][UnderlyingToken]
                // Examples: aBasUSDC, aEthDAI, aArbWETH
                return true;
            }

            // Variable debt tokens: variableDebtEthUSDC, variableDebtBasUSDC
            if (symbol.StartsWith("variableDebt", StringComparison.OrdinalIgnoreCase))
                return true;

            // Stable debt tokens: stableDebtEthUSDC, stableDebtBasUSDC
            if (symbol.StartsWith("stableDebt", StringComparison.OrdinalIgnoreCase))
                return true;

            // Staked SOL variants (endsWith SOL but not just "SOL")
            // Examples: JitoSOL, mSOL, bSOL, stSOL
            if (symbol.EndsWith("SOL", StringComparison.OrdinalIgnoreCase) && symbol.Length > 3)
            {
                // Exclude just "SOL" itself
                if (symbol.Equals("SOL", StringComparison.OrdinalIgnoreCase))
                    return false;
                
                return true;
            }

            // Compound-style tokens (cToken format)
            // Examples: cUSDC, cDAI, cETH
            if (symbol.StartsWith('c') && symbol.Length > 1 && char.IsUpper(symbol[1]))
            {
                // Common compound tokens
                var compoundTokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase) 
                { 
                    "cUSDC", "cDAI", "cUSDT", "cETH", "cWBTC", "cBAT", "cUNI", "cCOMP" 
                };
                
                if (compoundTokens.Contains(symbol))
                    return true;
            }

            // Staked ETH variants
            // Examples: stETH, cbETH, rETH, wstETH
            if (symbol.Contains("ETH", StringComparison.OrdinalIgnoreCase) && 
                (symbol.StartsWith("st", StringComparison.OrdinalIgnoreCase) ||
                 symbol.StartsWith("cb", StringComparison.OrdinalIgnoreCase) ||
                 symbol.StartsWith("r", StringComparison.OrdinalIgnoreCase) ||
                 symbol.StartsWith("wst", StringComparison.OrdinalIgnoreCase)))
            {
                // Exclude base WETH
                if (symbol.Equals("WETH", StringComparison.OrdinalIgnoreCase))
                    return false;
                
                var stakedEthTokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase) 
                { 
                    "stETH", "wstETH", "cbETH", "rETH", "sETH2" 
                };
                
                if (stakedEthTokens.Contains(symbol))
                    return true;
            }

            return false;
        }

        /// <summary>
        /// Extracts the underlying token symbol from a protocol token.
        /// Examples: aBasUSDC -> USDC, JitoSOL -> SOL, stETH -> ETH
        /// </summary>
        /// <param name="protocolTokenSymbol">Protocol token symbol</param>
        /// <returns>Underlying token symbol (or original if not a protocol token)</returns>
        public static string GetUnderlyingSymbol(string protocolTokenSymbol)
        {
            if (string.IsNullOrWhiteSpace(protocolTokenSymbol))
                return protocolTokenSymbol;

            // Aave tokens: aBasUSDC -> USDC, aEthWETH -> WETH
            if (protocolTokenSymbol.StartsWith('a') && char.IsUpper(protocolTokenSymbol[1]))
            {
                var underlying = protocolTokenSymbol[1..]; // Remove 'a'
                
                // Handle chain-specific tokens: aBasUSDC -> USDC, aEthDAI -> DAI
                // Common patterns: aBas, aEth, aArb, aPol (Base, Ethereum, Arbitrum, Polygon)
                var chainPrefixes = new[] { "Bas", "Eth", "Arb", "Pol", "Opt", "Avax" };
                foreach (var prefix in chainPrefixes)
                {
                    if (underlying.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    {
                        underlying = underlying[prefix.Length..];
                        break;
                    }
                }
                
                return underlying;
            }

            // Variable/Stable debt tokens: variableDebtEthUSDC -> USDC
            if (protocolTokenSymbol.StartsWith("variableDebt", StringComparison.OrdinalIgnoreCase))
            {
                var underlying = protocolTokenSymbol[12..]; // Remove 'variableDebt'
                
                // Remove chain prefix if present
                var chainPrefixes = new[] { "Bas", "Eth", "Arb", "Pol", "Opt", "Avax" };
                foreach (var prefix in chainPrefixes)
                {
                    if (underlying.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    {
                        underlying = underlying[prefix.Length..];
                        break;
                    }
                }
                
                return underlying;
            }

            if (protocolTokenSymbol.StartsWith("stableDebt", StringComparison.OrdinalIgnoreCase))
            {
                var underlying = protocolTokenSymbol[10..]; // Remove 'stableDebt'
                
                // Remove chain prefix if present
                var chainPrefixes = new[] { "Bas", "Eth", "Arb", "Pol", "Opt", "Avax" };
                foreach (var prefix in chainPrefixes)
                {
                    if (underlying.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                    {
                        underlying = underlying[prefix.Length..];
                        break;
                    }
                }
                
                return underlying;
            }

            // Staked SOL: JitoSOL, mSOL, bSOL -> SOL
            if (protocolTokenSymbol.EndsWith("SOL", StringComparison.OrdinalIgnoreCase) && 
                protocolTokenSymbol.Length > 3 &&
                !protocolTokenSymbol.Equals("SOL", StringComparison.OrdinalIgnoreCase))
            {
                return "SOL";
            }

            // Staked ETH: stETH, wstETH, cbETH, rETH -> ETH
            if (protocolTokenSymbol.Contains("ETH", StringComparison.OrdinalIgnoreCase) &&
                !protocolTokenSymbol.Equals("WETH", StringComparison.OrdinalIgnoreCase) &&
                !protocolTokenSymbol.Equals("ETH", StringComparison.OrdinalIgnoreCase))
            {
                var stakedEthTokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase) 
                { 
                    "stETH", "wstETH", "cbETH", "rETH", "sETH2" 
                };
                
                if (stakedEthTokens.Contains(protocolTokenSymbol))
                    return "ETH";
            }

            // Compound tokens: cUSDC -> USDC, cDAI -> DAI
            if (protocolTokenSymbol.StartsWith('c') && protocolTokenSymbol.Length > 1 && char.IsUpper(protocolTokenSymbol[1]))
            {
                return protocolTokenSymbol[1..]; // Remove 'c'
            }

            return protocolTokenSymbol;
        }
    }
}
