using System.Text.Json.Serialization;

namespace MyWebWallet.API.Services.Models
{
    public class MoralisGetNFTsResponse
    {
        [JsonPropertyName("status")]
        public string? Status { get; set; }

        [JsonPropertyName("page")]
        public int Page { get; set; }

        [JsonPropertyName("page_size")]
        public int PageSize { get; set; }

        [JsonPropertyName("cursor")]
        public string? Cursor { get; set; }

        [JsonPropertyName("result")]
        public List<MoralisNftDetail> Result { get; set; } = new();
    }

    public class MoralisNftDetail
    {
        [JsonPropertyName("token_address")]
        public string TokenAddress { get; set; } = "";

        [JsonPropertyName("token_id")]
        public string TokenId { get; set; } = "";

        [JsonPropertyName("amount")]
        public string? Amount { get; set; }

        [JsonPropertyName("owner_of")]
        public string? OwnerOf { get; set; }

        [JsonPropertyName("token_hash")]
        public string? TokenHash { get; set; }

        [JsonPropertyName("block_number_minted")]
        public string? BlockNumberMinted { get; set; }

        [JsonPropertyName("block_number")]
        public string? BlockNumber { get; set; }

        [JsonPropertyName("contract_type")]
        public string? ContractType { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("symbol")]
        public string? Symbol { get; set; }

        [JsonPropertyName("token_uri")]
        public string? TokenUri { get; set; }

        [JsonPropertyName("metadata")]
        public string? Metadata { get; set; }

        [JsonPropertyName("last_token_uri_sync")]
        public string? LastTokenUriSync { get; set; }

        [JsonPropertyName("last_metadata_sync")]
        public string? LastMetadataSync { get; set; }

        [JsonPropertyName("minter_address")]
        public string? MinterAddress { get; set; }

        [JsonPropertyName("possible_spam")]
        public bool PossibleSpam { get; set; }

        [JsonPropertyName("verified_collection")]
        public bool VerifiedCollection { get; set; }
    }
}
