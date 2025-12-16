using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;
using System.Numerics;

namespace DeFi10.API.Services.Protocols.Uniswap.DTOs;

[Function("positions", typeof(PositionDTO))]
public class PositionsFunction : FunctionMessage
{
    [Parameter("uint256", "tokenId", 1)]
    public BigInteger TokenId { get; set; }
}
