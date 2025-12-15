using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Aave.Models.Borrows;

public class UserBorrowsData
{
    [JsonPropertyName("userBorrows")]
    public List<UserBorrow> UserBorrows { get; set; } = new();
}
