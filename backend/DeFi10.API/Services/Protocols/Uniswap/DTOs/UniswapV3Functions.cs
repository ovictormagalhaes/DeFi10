using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;
using System.Numerics;

namespace DeFi10.API.Services.Protocols.Uniswap.DTOs;

[Function("token0", "address")]
public class Token0Function : FunctionMessage { }

[Function("token1", "address")]
public class Token1Function : FunctionMessage { }

[Function("fee", "uint24")]
public class FeeFunction : FunctionMessage { }

[Function("tickSpacing", "int24")]
public class TickSpacingFunction : FunctionMessage { }

[Function("feeGrowthGlobal0X128", "uint256")]
public class FeeGrowthGlobal0X128Function : FunctionMessage { }

[Function("feeGrowthGlobal1X128", "uint256")]
public class FeeGrowthGlobal1X128Function : FunctionMessage { }

[Function("slot0", typeof(Slot0OutputDTO))]
public class Slot0Function : FunctionMessage { }

[Function("ticks", typeof(TickInfoDTO))]
public class TicksFunction : FunctionMessage
{
    [Parameter("int24", "tick", 1)]
    public int Tick { get; set; }
}

[Function("balanceOf", "uint256")]
public class BalanceOfFunction : FunctionMessage
{
    [Parameter("address", "owner", 1)]
    public string Owner { get; set; } = string.Empty;
}

[Function("tokenOfOwnerByIndex", "uint256")]
public class TokenOfOwnerByIndexFunction : FunctionMessage
{
    [Parameter("address", "owner", 1)]
    public string Owner { get; set; } = string.Empty;
    
    [Parameter("uint256", "index", 2)]
    public BigInteger Index { get; set; }
}

[Function("decimals", "uint8")]
public class ERC20DecimalsFunction : FunctionMessage { }

[Function("symbol", "string")]
public class ERC20SymbolFunction : FunctionMessage { }

[Function("name", "string")]
public class ERC20NameFunction : FunctionMessage { }

[Function("getPool", "address")]
public class GetPoolFunction : FunctionMessage
{
    [Parameter("address", "token0", 1)]
    public string Token0 { get; set; } = string.Empty;
    
    [Parameter("address", "token1", 2)]
    public string Token1 { get; set; } = string.Empty;
    
    [Parameter("uint24", "fee", 3)]
    public uint Fee { get; set; }
}
