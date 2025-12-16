using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;

namespace DeFi10.API.Services.Protocols.Pendle.Models;

[Function("name", "string")]
public class ERC20NameFunction : FunctionMessage { }
