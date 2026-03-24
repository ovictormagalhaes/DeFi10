using System.Text.Json.Serialization;
using DeFi10.API.Controllers.Requests;

namespace DeFi10.API.Models;

public class AdditionalData
{
    [JsonPropertyName("healthFactor")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? HealthFactor { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? IsCollateral { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? CanBeCollateral { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? TickSpacing { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? SqrtPriceX96 { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public long? CreatedAt { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? PoolId { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public long? UnlockAt { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public RangeInfo? Range { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? PriceUnavailable { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? Fees24h { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? TotalValueUsd { get; set; }

    /// <summary>
    /// Multiple projection calculations for liquidity pool positions
    /// Each projection uses a different methodology (APR-based, CreatedAt-based, Fees24h-based)
    /// </summary>
    [JsonPropertyName("projections")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<ProjectionData>? Projections { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? TierPercent { get; set; }

    [JsonPropertyName("supplies")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<SupplyItem>? Supplies { get; set; }

    [JsonPropertyName("borrows")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<BorrowItem>? Borrows { get; set; }

    [JsonPropertyName("repays")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<RepayItem>? Repays { get; set; }

    [JsonPropertyName("suppliesTokens")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<TokenInfo>? SuppliesTokens { get; set; }

    [JsonPropertyName("borrowsTokens")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<TokenInfo>? BorrowsTokens { get; set; }

    [JsonPropertyName("repaysTokens")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<TokenInfo>? RepaysTokens { get; set; }
}
