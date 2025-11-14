using System.Text.Json.Serialization;
using MyWebWallet.API.Models;

namespace MyWebWallet.API.Models;

public class WalletItem
{
    public WalletItemType Type { get; set; }
    //DeFi specific properties
    public Protocol Protocol { get; set; }
    public Position Position { get; set; }
    public AdditionalData AdditionalData { get; set; }
}

public class Protocol {
    public string Name { get; set; }
    public string Chain { get; set; }
    public string Id { get; set; }
    public string Url { get; set; }
    public string Logo { get; set; }
}

public class Position
{
    public string Label { get; set; }
    public List<Token> Tokens { get; set; }
}

public class TokenFinancials
{
    public decimal? Amount { get; set; }
    public decimal? DecimalPlaces { get; set; }
    public decimal? AmountFormatted
    {
        get
        {
            if (Amount.HasValue && Amount.Value > 0 && DecimalPlaces.HasValue && DecimalPlaces.Value >= 0)
            {
                var places = (int)DecimalPlaces.Value;
                if (places <= MaxCachedPower)
                {
                    return Amount.Value / DecimalPow10(places);
                }
                // Fallback: cap at max cached (avoids overflow beyond 10^28 which decimal cannot represent)
                return Amount.Value / DecimalPow10(MaxCachedPower);
            }
            return null;
        }
    }
    public decimal? BalanceFormatted { get; set; }
    public decimal? Price { get; set; }
    public decimal? TotalPrice { get; set; }

    // Decimal max ~7.9e28, so 10^29 would overflow. Cache 0..28.
    private const int MaxCachedPower = 28;
    private static readonly decimal[] Pow10Cache = BuildCache();
    private static decimal[] BuildCache()
    {
        var arr = new decimal[MaxCachedPower + 1]; // 0..28
        arr[0] = 1m;
        for (int i = 1; i < arr.Length; i++) arr[i] = arr[i - 1] * 10m; // safe within decimal range
        return arr;
    }
    public static decimal DecimalPow10(int n)
    {
        if (n < 0) return 1m;
        if (n <= MaxCachedPower) return Pow10Cache[n];
        // Cap at largest exact power representable to avoid OverflowException
        return Pow10Cache[MaxCachedPower];
    }
}

public class Token
{
    public TokenType? Type { get; set; }
    public string Name { get; set; }
    public string Chain { get; set; }
    public string Symbol { get; set; }
    public string ContractAddress { get; set; }
    public string? Logo { get; set; }
    public string Thumbnail { get; set; }
    public TokenFinancials Financials { get; set; } = new();
    public bool? Native { get; set; }
    public bool? PossibleSpam { get; set; }
}

public class AdditionalData
{
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
    // Novo campo específico para locks/staking com data de desbloqueio em epoch seconds
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

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? Apr { get; set; }
}

public class RangeInfo
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? Upper { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? Lower { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? Current { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public bool? InRange { get; set; }
}