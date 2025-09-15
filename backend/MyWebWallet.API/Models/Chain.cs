namespace MyWebWallet.API.Models;

public enum Chain
{
    Base = 1,
    Ethereum = 2,
    Polygon = 3,
    Arbitrum = 4,
    Optimism = 5,
    BNB = 6
}

public static class ChainExtensions
{
    public static string ToChainId(this Chain chain)
    {
        return chain switch
        {
            Chain.Base => "base",
            Chain.Ethereum => "ethereum",
            Chain.Polygon => "polygon",
            Chain.Arbitrum => "arbitrum",
            Chain.Optimism => "optimism",
            Chain.BNB => "bsc",
            _ => throw new ArgumentOutOfRangeException(nameof(chain), chain, "Unsupported chain")
        };
    }

    public static int ToNumericChainId(this Chain chain)
    {
        return chain switch
        {
            Chain.Base => 8453,
            Chain.Ethereum => 1,
            Chain.Polygon => 137,
            Chain.Arbitrum => 42161,
            Chain.Optimism => 10,
            Chain.BNB => 56,
            _ => throw new ArgumentOutOfRangeException(nameof(chain), chain, "Unsupported chain")
        };
    }

    public static string GetDisplayName(this Chain chain)
    {
        return chain switch
        {
            Chain.Base => "Base",
            Chain.Ethereum => "Ethereum",
            Chain.Polygon => "Polygon",
            Chain.Arbitrum => "Arbitrum",
            Chain.Optimism => "Optimism",
            Chain.BNB => "BNB Smart Chain",
            _ => throw new ArgumentOutOfRangeException(nameof(chain), chain, "Unsupported chain")
        };
    }

    public static string GetRpcUrl(this Chain chain)
    {
        return chain switch
        {
            Chain.Base => "https://mainnet.base.org",
            Chain.Ethereum => "https://ethereum.publicnode.com",
            Chain.Polygon => "https://polygon.publicnode.com",
            Chain.Arbitrum => "https://arbitrum.publicnode.com", 
            Chain.Optimism => "https://optimism.publicnode.com",
            Chain.BNB => "https://bsc-dataseed1.binance.org",
            _ => throw new ArgumentOutOfRangeException(nameof(chain), chain, "Unsupported chain")
        };
    }

    public static string GetAlchemyRpcUrl(this Chain chain, string? alchemyApiKey = null)
    {
        var baseUrl = chain switch
        {
            Chain.Base => "https://base-mainnet.g.alchemy.com/v2/",
            Chain.Ethereum => "https://eth-mainnet.g.alchemy.com/v2/",
            Chain.Polygon => "https://polygon-mainnet.g.alchemy.com/v2/",
            Chain.Arbitrum => "https://arb-mainnet.g.alchemy.com/v2/",
            Chain.Optimism => "https://opt-mainnet.g.alchemy.com/v2/",
            Chain.BNB => throw new NotSupportedException("Alchemy does not support BNB Smart Chain. Use GetRpcUrl() instead."),
            _ => throw new ArgumentOutOfRangeException(nameof(chain), chain, "Unsupported chain for Alchemy")
        };

        return !string.IsNullOrEmpty(alchemyApiKey) ? $"{baseUrl}{alchemyApiKey}" : baseUrl;
    }

    public static string GetIconUrl(this Chain chain)
    {
        return chain switch
        {
            Chain.Base => "https://moralis.com/wp-content/uploads/2022/12/Base-Logo-Blue.svg",
            Chain.Ethereum => "https://moralis.com/wp-content/uploads/2024/06/BNB-Logo.svg",
            Chain.Polygon => "https://moralis.com/wp-content/uploads/2024/05/Polygon.svg",
            Chain.Arbitrum => "https://moralis.com/wp-content/uploads/2025/01/Arbitrum-Logo.svg",
            Chain.Optimism => "https://moralis.com/wp-content/uploads/2024/07/Optimism-Logo.svg",
            Chain.BNB => "https://moralis.com/wp-content/uploads/2024/06/BNB-Logo.svg",
            _ => throw new ArgumentOutOfRangeException(nameof(chain), chain, "Unsupported chain")
        };
    }
}