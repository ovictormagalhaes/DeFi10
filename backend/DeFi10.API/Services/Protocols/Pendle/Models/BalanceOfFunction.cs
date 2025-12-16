using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;

namespace DeFi10.API.Services.Protocols.Pendle.Models;

[Function("balanceOf", "uint256")]
public class BalanceOfFunction : FunctionMessage 
{ 
    [Parameter("address", "user", 1)] 
    public string User { get; set; } = string.Empty; 
}
