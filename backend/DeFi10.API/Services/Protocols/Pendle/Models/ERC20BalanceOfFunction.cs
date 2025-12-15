using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;

namespace DeFi10.API.Services.Protocols.Pendle.Models;

[Function("balanceOf", "uint256")]
public class ERC20BalanceOfFunction : FunctionMessage 
{ 
    [Parameter("address", "owner", 1)] 
    public string Owner { get; set; } = string.Empty; 
}
