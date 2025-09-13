using System.Text.Json.Serialization;

namespace MyWebWallet.API.Services.Models;

public class AaveGetUserSuppliesResponse
{
    [JsonPropertyName("data")]
    public UserSuppliesData Data { get; set; } = new();
}

public class UserSuppliesData
{
    [JsonPropertyName("userSupplies")]
    public List<UserSupply> UserBorrows { get; set; } = new();
}

public class UserSupply
{
    [JsonPropertyName("market")]
    public Market Market { get; set; } = new();

    [JsonPropertyName("currency")]
    public Currency Currency { get; set; } = new();

    [JsonPropertyName("balance")]
    public Balance Balance { get; set; } = new();

    [JsonPropertyName("apy")]
    public Apy Apy { get; set; } = new();

    [JsonPropertyName("isCollateral")]
    public bool IsCollateral { get; set; }

    [JsonPropertyName("canBeCollateral")]
    public bool CanBeCollateral { get; set; }
}

public class Market
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("chain")]
    public Chain Chain { get; set; } = new();
}

public class Chain
{
    [JsonPropertyName("chainId")]
    public int ChainId { get; set; }
}

public class Currency
{
    [JsonPropertyName("symbol")]
    public string Symbol { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public class Balance
{
    [JsonPropertyName("amount")]
    public Amount Amount { get; set; } = new();

    [JsonPropertyName("usd")]
    public string Usd { get; set; } = string.Empty;
}

public class Amount
{
    [JsonPropertyName("value")]
    public string Value { get; set; } = string.Empty;
}

public class Apy
{
    [JsonPropertyName("raw")]
    public string Raw { get; set; } = string.Empty;

    [JsonPropertyName("decimals")]
    public int Decimals { get; set; }

    [JsonPropertyName("value")]
    public string Value { get; set; } = string.Empty;

    [JsonPropertyName("formatted")]
    public string Formatted { get; set; } = string.Empty;
}