using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Kamino.Models;

internal class KaminoObligationDto
{
    [JsonPropertyName("obligationAddress")]
    public string? ObligationAddress { get; set; }

    [JsonPropertyName("state")]
    public KaminoStateDto? State { get; set; }

    [JsonPropertyName("refreshedStats")]
    public KaminoRefreshedStatsDto? RefreshedStats { get; set; }

    [JsonPropertyName("obligationTag")]
    public int? ObligationTag { get; set; }

    [JsonPropertyName("humanTag")]
    public string? HumanTag { get; set; }
}
