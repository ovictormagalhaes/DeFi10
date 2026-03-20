using System.Text.Json.Serialization;

namespace DeFi10.API.Models.Cache;

/// <summary>
/// Formato estável para cache de histórico de transações do Kamino
/// Desacoplado da API do Kamino para evitar quebras quando eles atualizarem
/// </summary>
public class KaminoTransactionHistoryCacheDto
{
    [JsonPropertyName("version")]
    public string Version { get; set; } = "1.0";

    [JsonPropertyName("events")]
    public List<KaminoTransactionEventCache> Events { get; set; } = new();
}

/// <summary>
/// Evento individual de transação no formato de cache
/// Contém apenas os dados ESSENCIAIS crus, sem hidratação
/// </summary>
public class KaminoTransactionEventCache
{
    /// <summary>
    /// Tipo do evento: "deposit" ou "borrow"
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Endereço do mint token na Solana
    /// </summary>
    [JsonPropertyName("mintAddress")]
    public string MintAddress { get; set; } = string.Empty;

    /// <summary>
    /// Variação do amount entre snapshots (delta) - quantidade da transação
    /// </summary>
    [JsonPropertyName("amountChange")]
    public decimal AmountChange { get; set; }

    /// <summary>
    /// Data/hora do evento (UTC)
    /// </summary>
    [JsonPropertyName("timestamp")]
    public DateTime Timestamp { get; set; }
}
