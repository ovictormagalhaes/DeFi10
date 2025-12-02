using System.Text.Json.Serialization;

namespace MyWebWallet.API.Services.Models
{
    public class SolanaNFTResponse
    {
        [JsonPropertyName("nfts")]
        public List<SolanaNftDetail> Nfts { get; set; } = new();
    }

    public class SolanaNftDetail
    {
        [JsonPropertyName("mint")]
        public string Mint { get; set; } = "";

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("symbol")]
        public string? Symbol { get; set; }

        [JsonPropertyName("amount")]
        public decimal Amount { get; set; }

        [JsonPropertyName("decimals")]
        public int Decimals { get; set; }

        [JsonPropertyName("token_standard")]
        public string? TokenStandard { get; set; }

        [JsonPropertyName("collection")]
        public string? Collection { get; set; }

        [JsonPropertyName("metadata_uri")]
        public string? MetadataUri { get; set; }
    }
}
