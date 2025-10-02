using System.Text.Json.Serialization;

namespace MyWebWallet.API.Models
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum TokenType
    {
        Supplied = 1,
        Borrowed = 2,
        LiquidityUncollectedFee = 3,
        LiquidityCollectedFee = 4
    }
}