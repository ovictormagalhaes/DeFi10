using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Kamino.Models;

/// <summary>
/// Representa um evento inferido de transação (deposit ou borrow)
/// baseado na comparação de snapshots históricos
/// </summary>
public class KaminoTransactionEvent
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty; // "deposit" ou "borrow"

    [JsonPropertyName("tokenSymbol")]
    public string TokenSymbol { get; set; } = string.Empty;

    [JsonPropertyName("mintAddress")]
    public string MintAddress { get; set; } = string.Empty;

    [JsonPropertyName("amount")]
    public decimal Amount { get; set; }

    [JsonPropertyName("amountChange")]
    public decimal AmountChange { get; set; } // Diferença entre snapshots

    [JsonPropertyName("timestamp")]
    public DateTime Timestamp { get; set; }

    [JsonPropertyName("valueUsd")]
    public decimal? ValueUsd { get; set; }
}
