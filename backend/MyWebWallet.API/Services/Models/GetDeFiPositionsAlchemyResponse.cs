using System.Text.Json.Serialization;

namespace MyWebWallet.API.Services.Models
{
    public class GetDeFiPositionsAlchemyResponse
    {
        [JsonPropertyName("positions")]
        public List<DeFiPositionDetail> Positions { get; set; } = new();
    }

    public class DeFiPositionDetail
    {
        [JsonPropertyName("protocol")]
        public string Protocol { get; set; } = "";

        [JsonPropertyName("balance_usd")]
        public decimal BalanceUsd { get; set; }

        [JsonPropertyName("tokens")]
        public List<DeFiTokenDetail> Tokens { get; set; } = new();
    }

    public class DeFiTokenDetail
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = "";

        [JsonPropertyName("symbol")]
        public string Symbol { get; set; } = "";

        [JsonPropertyName("balance")]
        public string Balance { get; set; } = "";
    }
}