using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;
using System.Numerics;

namespace DeFi10.API.Services.Protocols.Uniswap.DTOs;

[Function("latestRoundData", typeof(LatestRoundDataOutputDTO))]
public class LatestRoundDataFunction : FunctionMessage { }

[FunctionOutput]
public class LatestRoundDataOutputDTO : IFunctionOutputDTO
{
    [Parameter("uint80", "roundId", 1)]
    public BigInteger RoundId { get; set; }
    
    [Parameter("int256", "answer", 2)]
    public BigInteger Answer { get; set; }
    
    [Parameter("uint256", "startedAt", 3)]
    public BigInteger StartedAt { get; set; }
    
    [Parameter("uint256", "updatedAt", 4)]
    public BigInteger UpdatedAt { get; set; }
    
    [Parameter("uint80", "answeredInRound", 5)]
    public BigInteger AnsweredInRound { get; set; }
}
