using System.Text.Json.Serialization;

namespace MyWebWallet.API.Services.Models
{
    public class GetDeFiPositionsMoralisResponse : List<GetDeFiPositionsMoralisInfo>
    {

    }

    public class GetDeFiPositionsMoralisInfo 
    {
        [JsonPropertyName("protocol_name")]
        public string ProtocolName { get; set; } = "";

        [JsonPropertyName("protocol_id")]
        public string ProtocolId { get; set; } = "";

        [JsonPropertyName("protocol_url")]
        public string ProtocolUrl { get; set; } = "";

        [JsonPropertyName("protocol_logo")]
        public string ProtocolLogo { get; set; } = "";

        [JsonPropertyName("account_data")]
        public AccountData AccountData { get; set; } = new();

        [JsonPropertyName("total_projected_earnings_usd")]
        public ProjectedEarnings TotalProjectedEarningsUsd { get; set; } = new();

        [JsonPropertyName("position")]
        public DeFiPosition Position { get; set; } = new();
    }

    public class ProjectedEarnings
    {
        [JsonPropertyName("daily")]
        public double? Daily { get; set; } = null;

        [JsonPropertyName("weekly")]
        public double? Weekly { get; set; } = null;

        [JsonPropertyName("monthly")]
        public double? Monthly { get; set; } = null;

        [JsonPropertyName("yearly")]
        public double? Yearly { get; set; } = null;
    }

    public class DeFiPosition
    {
        [JsonPropertyName("label")]
        public string Label { get; set; } = "";

        [JsonPropertyName("balance_usd")]
        public decimal? BalanceUsd { get; set; }

        [JsonPropertyName("total_unclaimed_usd_value")]
        public decimal? TotalUnclaimedUsdValue { get; set; }

        [JsonPropertyName("tokens")]
        public List<DeFiToken> Tokens { get; set; } = new();
    }

    public class DeFiToken
    {
        [JsonPropertyName("token_type")]
        public string TokenType { get; set; } = "";

        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("symbol")]
        public string? Symbol { get; set; }

        [JsonPropertyName("contract_address")]
        public string? ContractAddress { get; set; }

        [JsonPropertyName("decimals")]
        public string? Decimals { get; set; }

        [JsonPropertyName("logo")]
        public string? Logo { get; set; }

        [JsonPropertyName("thumbnail")]
        public string? Thumbnail { get; set; }

        [JsonPropertyName("balance")]
        public string? Balance { get; set; }

        [JsonPropertyName("balance_formatted")]
        public string? BalanceFormatted { get; set; }

        [JsonPropertyName("usd_price")]
        public decimal? UsdPrice { get; set; }

        [JsonPropertyName("usd_value")]
        public decimal? UsdValue { get; set; }
    }

    public class AccountData
    {
        [JsonPropertyName("health_factor")]
        public decimal? HealthFactory { get; set; }
    }
}