using System.Text.Json.Serialization;
using DeFi10.API.Services.Protocols.Aave.Models.Borrows;

namespace DeFi10.API.Services.Protocols.Aave.Models;

public class AaveGetUserBorrowsResponse
{
    [JsonPropertyName("data")]
    public UserBorrowsData Data { get; set; } = new();
}