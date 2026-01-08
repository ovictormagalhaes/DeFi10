using System.Text.Json.Serialization;

namespace DeFi10.API.Models;

public class ProjectionData
{
    /// <summary>
    /// Type of projection calculation method
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// The calculated projection across different time ranges
    /// </summary>
    [JsonPropertyName("projection")]
    public Projection Projection { get; set; } = new();

    /// <summary>
    /// Additional metadata about how this projection was calculated
    /// </summary>
    [JsonPropertyName("metadata")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ProjectionMetadata? Metadata { get; set; }
}

/// <summary>
/// Projection types supported by the system
/// </summary>
public static class ProjectionType
{
    /// <summary>
    /// Projection based on current APR (Annual Percentage Rate)
    /// Uses: currentValue * APR / timeframes
    /// </summary>
    public const string Apr = "apr";

    /// <summary>
    /// Projection based on historical APR calculated from actual fees generated since position creation
    /// Uses: (totalFeesGenerated / daysActive) * timeframes, then converts to APR
    /// </summary>
    public const string AprHistorical = "aprHistorical";

    /// <summary>
    /// Projection based on 24-hour fees
    /// Uses: fees24h * timeframes
    /// </summary>
    public const string Fees24h = "fees24h";

    /// <summary>
    /// Projection based on current APY (Annual Percentage Yield)
    /// Uses: currentValue * APY / timeframes (compound interest)
    /// </summary>
    public const string Apy = "apy";
}
