using Nethereum.ABI.FunctionEncoding.Attributes;
using System.Numerics;

namespace DeFi10.API.Services.Protocols.Uniswap.DTOs;

[FunctionOutput]
public class PositionDTO : IFunctionOutputDTO
{
    [Parameter("uint96", "nonce", 1)]
    public BigInteger Nonce { get; set; }
    
    [Parameter("address", "operator", 2)]
    public string Operator { get; set; } = string.Empty;
    
    [Parameter("address", "token0", 3)]
    public string Token0 { get; set; } = string.Empty;
    
    [Parameter("address", "token1", 4)]
    public string Token1 { get; set; } = string.Empty;
    
    [Parameter("uint24", "fee", 5)]
    public uint Fee { get; set; }
    
    [Parameter("int24", "tickLower", 6)]
    public int TickLower { get; set; }
    
    [Parameter("int24", "tickUpper", 7)]
    public int TickUpper { get; set; }
    
    [Parameter("uint128", "liquidity", 8)]
    public BigInteger Liquidity { get; set; }
    
    [Parameter("uint256", "feeGrowthInside0LastX128", 9)]
    public BigInteger FeeGrowthInside0LastX128 { get; set; }
    
    [Parameter("uint256", "feeGrowthInside1LastX128", 10)]
    public BigInteger FeeGrowthInside1LastX128 { get; set; }
    
    [Parameter("uint128", "tokensOwed0", 11)]
    public BigInteger TokensOwed0 { get; set; }
    
    [Parameter("uint128", "tokensOwed1", 12)]
    public BigInteger TokensOwed1 { get; set; }
}
