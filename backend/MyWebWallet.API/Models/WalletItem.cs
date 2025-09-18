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
            if (Amount > 0 && DecimalPlaces > 0)
            {
                var divisor = (decimal)Math.Pow(10, (double)DecimalPlaces.Value);
                return Amount.Value / divisor;
            }
            return null;
        }
    }
    public decimal? BalanceFormatted { get; set; }
    public decimal? Price { get; set; }
    public decimal? TotalPrice { get; set; }
}

public class Token
{
    public TokenType? Type { get; set; }
    public string Name { get; set; }
    public string Chain { get; set; }
    public string Symbol { get; set; }
    public string ContractAddress { get; set; }
    public string Logo { get; set; }
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
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public RangeInfo? Range { get; set; }
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