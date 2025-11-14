using System;

namespace MyWebWallet.API.Models
{
    /// <summary>
    /// Extension helpers for Chain enum (restores missing helpers used across the codebase).
    /// </summary>
    public static class ChainExtensions
    {
        /// <summary>
        /// Returns the canonical string chain id used when building protocol / token DTOs.
        /// Keep values stable because they are persisted/serialized to clients.
        /// </summary>
        public static string ToChainId(this Chain chain) => chain switch
        {
            Chain.Ethereum => "ethereum",
            Chain.Base => "base",
            Chain.Polygon => "polygon",
            Chain.Arbitrum => "arbitrum",
            Chain.Optimism => "optimism",
            Chain.BNB => "bsc", // common id used by providers for BNB Smart Chain
            Chain.Solana => "solana",
            _ => chain.ToString().ToLowerInvariant()
        };

        /// <summary>
        /// Builds an Alchemy RPC URL for the given chain + api key. Throws if chain is not supported by current configuration.
        /// Only applies to EVM chains.
        /// </summary>
        public static string GetAlchemyRpcUrl(this Chain chain, string apiKey) => chain switch
        {
            Chain.Ethereum => $"https://eth-mainnet.g.alchemy.com/v2/{apiKey}",
            Chain.Base => $"https://base-mainnet.g.alchemy.com/v2/{apiKey}",
            Chain.Arbitrum => $"https://arb-mainnet.g.alchemy.com/v2/{apiKey}",
            Chain.Polygon => $"https://polygon-mainnet.g.alchemy.com/v2/{apiKey}",
            Chain.Optimism => $"https://opt-mainnet.g.alchemy.com/v2/{apiKey}",
            // Alchemy may not support BNB in all accounts; keep here for future or throw to highlight unsupported use
            Chain.BNB => throw new NotSupportedException("Alchemy RPC not configured for BNB chain"),
            Chain.Solana => throw new NotSupportedException("GetAlchemyRpcUrl is EVM-only and does not support Solana"),
            _ => throw new NotSupportedException($"Unsupported chain for Alchemy RPC: {chain}")
        };
    }
}
