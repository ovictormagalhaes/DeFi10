using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Infrastructure.Moralis.Models
{
    public class MoralisGetERC20TokenResponse
    {
        [JsonPropertyName("cursor")]
        public string? Cursor { get; set; } = null;

        [JsonPropertyName("page")]
        public int Page { get; set; } = 0;

        [JsonPropertyName("page_size")]
        public int PageSize { get; set; } = 0;

        [JsonPropertyName("block_number")]
        public long BlockNumber { get; set; } = 0;

        [JsonPropertyName("result")]
        public List<TokenDetail> Result { get; set; } = new();
    }

    public class TokenDetail
    {
        [JsonPropertyName("token_address")]
        public string TokenAddress { get; set; } = "";

        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("symbol")]
        public string Symbol { get; set; } = "";

        [JsonPropertyName("logo")]
        public string Logo { get; set; } = "";

        [JsonPropertyName("thumbnail")]
        public string Thumbnail { get; set; } = "";

        [JsonPropertyName("decimals")]
        public int? Decimals { get; set; } = null;

        [JsonPropertyName("balance")]
        public string Balance { get; set; } = "";

        [JsonPropertyName("possible_spam")]
        public bool PossibleSpam { get; set; }

        [JsonPropertyName("verified_contract")]
        public bool VerifiedContract { get; set; } = false;

        [JsonPropertyName("balance_formatted")]
        public string BalanceFormatted { get; set; } = "";

        [JsonPropertyName("usd_price")]
        public double UsdPrice { get; set; } = 0.0;

        [JsonPropertyName("usd_price_24hr_percent_change")]
        public double UsdPrice24HrPercentChange { get; set; } = 0.0;

        [JsonPropertyName("usd_price_24hr_usd_change")]
        public double UsdPrice24HrUsdChange { get; set; } = 0.0;

        [JsonPropertyName("usd_value")]
        public double UsdValue { get; set; } = 0.0;

        [JsonPropertyName("usd_value_24hr_usd_change")]
        public double UsdValue24HrUsdChange { get; set; } = 0.0;

        [JsonPropertyName("native_token")]
        public bool NativeToken { get; set; } = false;

        [JsonPropertyName("portfolio_percentage")]
        public double PortfolioPercentage { get; set; } = 0.0;
    }
}