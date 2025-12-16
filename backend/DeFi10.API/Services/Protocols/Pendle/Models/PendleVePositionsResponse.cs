using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Pendle.Models;

public class PendleVePositionsResponse
{
    [JsonPropertyName("data")] public PendleVeData Data { get; set; } = new();
}

public class PendleVeData
{
    [JsonPropertyName("locks")] public List<PendleVeLock> Locks { get; set; } = new();
}

public class PendleVeLock
{
    [JsonPropertyName("lockId")] public string LockId { get; set; } = string.Empty;
    [JsonPropertyName("amount")] public string Amount { get; set; } = string.Empty;
    [JsonPropertyName("amountFormatted")] public string AmountFormatted { get; set; } = string.Empty;
    [JsonPropertyName("unlockTime")] public long UnlockTime { get; set; }
    [JsonPropertyName("penalty")] public string? Penalty { get; set; }
    [JsonPropertyName("veBalance")] public string? VeBalance { get; set; }
}