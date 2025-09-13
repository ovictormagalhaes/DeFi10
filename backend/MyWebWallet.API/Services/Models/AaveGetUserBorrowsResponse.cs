using System.Text.Json.Serialization;

namespace MyWebWallet.API.Services.Models;

public class AaveGetUserBorrowsResponse
{
    [JsonPropertyName("data")]
    public UserBorrowsData Data { get; set; } = new();
}

public class UserBorrowsData
{
    [JsonPropertyName("userBorrows")]
    public List<UserBorrow> UserBorrows { get; set; } = new();
}

public class UserBorrow
{
    [JsonPropertyName("market")]
    public Market Market { get; set; } = new();

    [JsonPropertyName("currency")]
    public Currency Currency { get; set; } = new();

    [JsonPropertyName("debt")]
    public Debt Debt { get; set; } = new();

    [JsonPropertyName("apy")]
    public Apy Apy { get; set; } = new();
}

public class Debt
{
    [JsonPropertyName("amount")]
    public Amount Amount { get; set; } = new();
    [JsonPropertyName("usd")]
    public string Usd { get; set; }
}