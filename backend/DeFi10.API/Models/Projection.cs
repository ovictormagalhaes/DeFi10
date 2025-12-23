using System.Text.Json.Serialization;

namespace DeFi10.API.Models;

public class Projection
{
    [JsonPropertyName("oneDay")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? OneDay { get; set; }

    [JsonPropertyName("oneWeek")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? OneWeek { get; set; }

    [JsonPropertyName("oneMonth")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? OneMonth { get; set; }

    [JsonPropertyName("oneYear")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? OneYear { get; set; }
}
