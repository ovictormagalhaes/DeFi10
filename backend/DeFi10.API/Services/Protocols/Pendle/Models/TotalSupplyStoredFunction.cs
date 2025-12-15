using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;

namespace DeFi10.API.Services.Protocols.Pendle.Models;

[Function("totalSupplyStored", "uint128")]
public class TotalSupplyStoredFunction : FunctionMessage { }
