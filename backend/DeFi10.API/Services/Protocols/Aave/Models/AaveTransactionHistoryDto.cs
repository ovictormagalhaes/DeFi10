using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Aave.Models;

/// <summary>
/// Response wrapper para transaction history do Aave via The Graph
/// </summary>
public class AaveTransactionHistoryResponse
{
    [JsonPropertyName("data")]
    public AaveTransactionHistoryData? Data { get; set; }
}

public class AaveTransactionHistoryData
{
    [JsonPropertyName("supplies")]
    public List<AaveTransaction> Supplies { get; set; } = new();
    
    [JsonPropertyName("redeemUnderlyings")]
    public List<AaveTransaction> RedeemUnderlyings { get; set; } = new();

    [JsonPropertyName("borrows")]
    public List<AaveTransaction> Borrows { get; set; } = new();

    [JsonPropertyName("repays")]
    public List<AaveTransaction> Repays { get; set; } = new();
    
    /// <summary>
    /// Alias para compatibilidade - Supplies são Deposits no domínio
    /// </summary>
    [JsonIgnore]
    public List<AaveTransaction> Deposits => Supplies;
    
    /// <summary>
    /// Alias para compatibilidade - RedeemUnderlyings são Withdraws no domínio
    /// </summary>
    [JsonIgnore]
    public List<AaveTransaction> Withdraws => RedeemUnderlyings;

    /// <summary>
    /// Combina todas as transações em uma lista unificada
    /// </summary>
    [JsonIgnore]
    public List<AaveTransaction> Transactions
    {
        get
        {
            var all = new List<AaveTransaction>();
            all.AddRange(Supplies.Select(d => { d.Type = "DEPOSIT"; return d; }));
            all.AddRange(RedeemUnderlyings.Select(w => { w.Type = "WITHDRAW"; return w; }));
            all.AddRange(Borrows.Select(b => { b.Type = "BORROW"; return b; }));
            all.AddRange(Repays.Select(r => { r.Type = "REPAY"; return r; }));
            return all.OrderByDescending(t => t.Timestamp).ToList();
        }
    }
}

/// <summary>
/// Representa uma transação do usuário no Aave (deposit, borrow, withdraw, repay)
/// </summary>
public class AaveTransaction
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;
    
    /// <summary>
    /// Tipo da transação (preenchido dinamicamente) - DEPOSIT, WITHDRAW, BORROW, REPAY
    /// IMPORTANTE: Não marcar como JsonIgnore para permitir serialização/cache
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;
    
    [JsonPropertyName("timestamp")]
    public long Timestamp { get; set; }
    
    [JsonPropertyName("reserve")]
    public AaveReserve? Reserve { get; set; }
    
    [JsonPropertyName("amount")]
    public string Amount { get; set; } = "0";
}

public class AaveReserve
{
    [JsonPropertyName("symbol")]
    public string Symbol { get; set; } = string.Empty;
    
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    
    [JsonPropertyName("underlyingAsset")]
    public string UnderlyingAsset { get; set; } = string.Empty;
    
    [JsonPropertyName("decimals")]
    public int Decimals { get; set; }
}
