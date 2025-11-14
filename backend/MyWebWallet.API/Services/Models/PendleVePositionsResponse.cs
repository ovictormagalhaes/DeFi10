using System.Text.Json.Serialization;

namespace MyWebWallet.API.Services.Models;

// Modelo simplificado para resposta de posições vePENDLE (lock)
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
    [JsonPropertyName("amount")] public string Amount { get; set; } = string.Empty; // raw amount
    [JsonPropertyName("amountFormatted")] public string AmountFormatted { get; set; } = string.Empty; // decimal formatted
    [JsonPropertyName("unlockTime")] public long UnlockTime { get; set; } // epoch seconds
    [JsonPropertyName("penalty")] public string? Penalty { get; set; }
    [JsonPropertyName("veBalance")] public string? VeBalance { get; set; } // voting power formatted
}
