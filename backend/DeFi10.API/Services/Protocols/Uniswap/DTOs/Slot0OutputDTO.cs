using Nethereum.ABI.FunctionEncoding.Attributes;
using System.Numerics;

namespace DeFi10.API.Services.Protocols.Uniswap.DTOs;

[FunctionOutput]
public class Slot0OutputDTO : IFunctionOutputDTO
{
    [Parameter("uint160", "sqrtPriceX96", 1)]
    public BigInteger SqrtPriceX96 { get; set; }
    
    [Parameter("int24", "tick", 2)]
    public int Tick { get; set; }
}
