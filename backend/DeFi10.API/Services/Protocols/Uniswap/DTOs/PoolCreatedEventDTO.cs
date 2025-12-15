using Nethereum.ABI.FunctionEncoding.Attributes;

namespace DeFi10.API.Services.Protocols.Uniswap.DTOs;

[Event("PoolCreated")]
public class PoolCreatedEventDTO : IEventDTO
{
    [Parameter("address", "token0", 1, true)]
    public string Token0 { get; set; } = string.Empty;
    
    [Parameter("address", "token1", 2, true)]
    public string Token1 { get; set; } = string.Empty;
    
    [Parameter("uint24", "fee", 3, false)]
    public uint Fee { get; set; }
    
    [Parameter("int24", "tickSpacing", 4, false)]
    public int TickSpacing { get; set; }
    
    [Parameter("address", "pool", 5, true)]
    public string Pool { get; set; } = string.Empty;
}
