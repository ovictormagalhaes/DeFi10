using System.Numerics;
using System.Text.Json.Serialization;

namespace MyWebWallet.API.Services.Models;

public class PendleDepositsResponse
{
    [JsonPropertyName("data")]
    public PendleDepositsData Data { get; set; } = new();
}

public class PendleDepositsData
{
    [JsonPropertyName("deposits")]
    public List<PendleDepositItem> Deposits { get; set; } = new();
}

public class PendleDepositItem
{
    [JsonPropertyName("marketSymbol")]
    public string MarketSymbol { get; set; } = string.Empty; // e.g. PT-USDe-11DEC2025
    
    [JsonPropertyName("maturityUnix")]
    public long? MaturityUnix { get; set; }

    [JsonPropertyName("ptAddress")]
    public string PtAddress { get; set; } = string.Empty;
    
    [JsonPropertyName("ptDecimals")]
    public int PtDecimals { get; set; }

    [JsonPropertyName("underlyingSymbol")]
    public string? UnderlyingSymbol { get; set; }
    
    [JsonPropertyName("underlyingAddress")]
    public string? UnderlyingAddress { get; set; }
    
    [JsonPropertyName("underlyingDecimals")]
    public int? UnderlyingDecimals { get; set; }

    [JsonPropertyName("amountRaw")]
    public BigInteger AmountRaw { get; set; }
    
    [JsonPropertyName("amountFormatted")]
    public decimal AmountFormatted { get; set; }
}
