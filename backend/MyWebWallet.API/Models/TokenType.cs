using System.Text.Json.Serialization;

namespace MyWebWallet.API.Models
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum TokenType
    {
        Supplied,
        Borrowed,
        Reward,
        Native,
        Staked
    }
}