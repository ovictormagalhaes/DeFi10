using System.Text.Json.Serialization;

namespace MyWebWallet.API.Models;

public class WalletDefiInfo
{
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
    public decimal? Balance { get; set; }
    public decimal? TotalUnclaimed { get; set; }
    public List<PositionToken> Tokens { get; set; }
}

public class PositionToken
{
    public string Type { get; set; }
    public string Name { get; set; }
    public string Symbol { get; set; }
    public string ContractAddress { get; set; }
    public string Logo { get; set; }
    public string Thumbnail { get; set; }
    public decimal? Balance { get; set; }
    public decimal? DecimalPlaces { get; set; }
    public decimal? UnitPrice { get; set; }
    public decimal? TotalPrice { get; set; }
}

public class AdditionalData
{
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? HealthFactor { get; set; }
}