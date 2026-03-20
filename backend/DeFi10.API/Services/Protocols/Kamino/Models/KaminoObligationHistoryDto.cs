using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Kamino.Models;

/// <summary>
/// Histórico de métricas de uma obligation ao longo do tempo
/// </summary>
internal class KaminoObligationHistoryResponseDto
{
    [JsonPropertyName("obligation")]
    public string? Obligation { get; set; }

    [JsonPropertyName("history")]
    public List<KaminoHistorySnapshotDto>? History { get; set; }
}

/// <summary>
/// Snapshot de métricas em um determinado timestamp
/// </summary>
internal class KaminoHistorySnapshotDto
{
    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }

    [JsonPropertyName("deposits")]
    public List<KaminoHistoryDepositDto>? Deposits { get; set; }

    [JsonPropertyName("borrows")]
    public List<KaminoHistoryBorrowDto>? Borrows { get; set; }

    [JsonPropertyName("depositedValue")]
    public string? DepositedValue { get; set; }

    [JsonPropertyName("borrowedValue")]
    public string? BorrowedValue { get; set; }

    [JsonPropertyName("netAccountValue")]
    public string? NetAccountValue { get; set; }

    [JsonPropertyName("loanToValue")]
    public string? LoanToValue { get; set; }

    [JsonPropertyName("healthFactor")]
    public string? HealthFactor { get; set; }
}

/// <summary>
/// Deposit em um snapshot histórico
/// </summary>
internal class KaminoHistoryDepositDto
{
    [JsonPropertyName("mintAddress")]
    public string? MintAddress { get; set; }

    [JsonPropertyName("amount")]
    public string? Amount { get; set; }

    [JsonPropertyName("marketValueRefreshed")]
    public string? MarketValueRefreshed { get; set; }
}

/// <summary>
/// Borrow em um snapshot histórico
/// </summary>
internal class KaminoHistoryBorrowDto
{
    [JsonPropertyName("mintAddress")]
    public string? MintAddress { get; set; }

    [JsonPropertyName("amount")]
    public string? Amount { get; set; }

    [JsonPropertyName("marketValueRefreshed")]
    public string? MarketValueRefreshed { get; set; }
}
