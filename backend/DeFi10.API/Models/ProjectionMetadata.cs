using System.Text.Json.Serialization;

namespace DeFi10.API.Models;

public class ProjectionMetadata
{
    [JsonPropertyName("apr")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? Apr { get; set; }

    [JsonPropertyName("aprHistorical")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? AprHistorical { get; set; }

    [JsonPropertyName("apy")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? Apy { get; set; }

    [JsonPropertyName("createdAt")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public long? CreatedAt { get; set; }

    [JsonPropertyName("totalFeesGenerated")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? TotalFeesGenerated { get; set; }

    [JsonPropertyName("daysActive")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? DaysActive { get; set; }

    [JsonPropertyName("fees24h")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? Fees24h { get; set; }
}
