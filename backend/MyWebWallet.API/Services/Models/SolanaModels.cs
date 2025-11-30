using MyWebWallet.API.Models;
using System.Text.Json.Serialization;

namespace MyWebWallet.API.Services.Models
{
    public sealed class SolanaTokenResponse
    {
        [JsonPropertyName("tokens")] public List<SplToken> Tokens { get; set; } = new();
        [JsonPropertyName("nativeBalanceUsd")] public decimal? NativeBalanceUsd { get; set; }
    }

    public sealed class SplToken
    {
        [JsonPropertyName("mint")] public string Mint { get; set; } = string.Empty;
        [JsonPropertyName("symbol")] public string? Symbol { get; set; }
        [JsonPropertyName("name")] public string? Name { get; set; }
        [JsonPropertyName("decimals")] public int Decimals { get; set; }
        [JsonPropertyName("amount")] public decimal Amount { get; set; }
        [JsonPropertyName("priceUsd")] public decimal? PriceUsd { get; set; }
        [JsonPropertyName("logo")] public string? Logo { get; set; }
        [JsonPropertyName("type")] public TokenType? Type { get; set; }
    }

    public sealed class KaminoPosition
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;
        
        [JsonPropertyName("market")]
        public string Market { get; set; } = string.Empty;
        
        [JsonPropertyName("suppliedUsd")]
        public decimal SuppliedUsd { get; set; }
        
        [JsonPropertyName("borrowedUsd")]
        public decimal BorrowedUsd { get; set; }
        
        [JsonPropertyName("healthFactor")]
        public decimal HealthFactor { get; set; }
        
        [JsonPropertyName("tokens")]
        public List<SplToken> Tokens { get; set; } = new();
    }

    public sealed class RaydiumPosition
    {
        [JsonPropertyName("pool")]
        public string Pool { get; set; } = string.Empty;
        
        [JsonPropertyName("tokens")]
        public List<SplToken> Tokens { get; set; } = new();
        
        [JsonPropertyName("totalValueUsd")]
        public decimal TotalValueUsd { get; set; }
        
        [JsonPropertyName("apr")]
        public decimal? Apr { get; set; }
        
        [JsonPropertyName("fees24h")]
        public decimal? Fees24h { get; set; }
        
        // Range information
        [JsonPropertyName("sqrtPriceX96")]
        public string? SqrtPriceX96 { get; set; }
        
        [JsonPropertyName("tickLower")]
        public int TickLower { get; set; }
        
        [JsonPropertyName("tickUpper")]
        public int TickUpper { get; set; }
        
        [JsonPropertyName("tickCurrent")]
        public int TickCurrent { get; set; }
    }

    // Models for Moralis Solana Portfolio API Endpoint
    // GET /account/{network}/{address}/portfolio
    public class MoralisSolanaPortfolioResponse
    {
        [JsonPropertyName("nativeBalance")]
        public PortfolioNativeBalance NativeBalance { get; set; }

        [JsonPropertyName("tokens")]
        public List<PortfolioToken> Tokens { get; set; } = new();

        [JsonPropertyName("nfts")]
        public List<PortfolioNft> Nfts { get; set; } = new();
    }

    public class PortfolioNativeBalance
    {
        [JsonPropertyName("lamports")]
        public string Lamports { get; set; }

        [JsonPropertyName("solana")]
        public string Solana { get; set; }
    }

    public class PortfolioToken
    {
        [JsonPropertyName("associatedTokenAddress")]
        public string AssociatedTokenAddress { get; set; }

        [JsonPropertyName("mint")]
        public string Mint { get; set; }

        [JsonPropertyName("amountRaw")]
        public string AmountRaw { get; set; }

        [JsonPropertyName("amount")]
        public string Amount { get; set; }

        [JsonPropertyName("decimals")]
        public int Decimals { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("symbol")]
        public string Symbol { get; set; }

        [JsonPropertyName("logo")]
        public string? Logo { get; set; }
    }

    public class PortfolioNft
    {
        [JsonPropertyName("mint")]
        public string Mint { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }
    }
}
