using System.Text.Json.Serialization;

namespace DeFi10.API.Models;

public class ProjectionData
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("calculationType")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? CalculationType { get; set; }

    [JsonPropertyName("projection")]
    public Projection Projection { get; set; } = new();

    [JsonPropertyName("metadata")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ProjectionMetadata? Metadata { get; set; }
}

/// <summary>
/// Projection types supported by the system
/// </summary>
public static class ProjectionType
{
    public const string Apr = "apr";
    public const string AprHistorical = "aprHistorical";
    public const string Fees24h = "fees24h";
    public const string Apy = "apy";
}

public static class CalculationType
{
    public const string Historical = "historical";
}
