using System.Text.Json.Serialization;

namespace DeFi10.API.Services.Protocols.Uniswap.Models;

public class UniswapV3GetActivePoolsResponse
{
    [JsonPropertyName("data")]
    public UniswapV3PositionsData Data { get; set; } = new();
}

public class UniswapV3PositionsData
{
    [JsonPropertyName("bundles")]
    public List<UniswapV3Bundle> Bundles { get; set; } = new();

    [JsonPropertyName("positions")]
    public List<UniswapV3Position> Positions { get; set; } = new();
}

public class UniswapV3Bundle
{
    [JsonPropertyName("nativePriceUSD")]
    public string NativePriceUSD { get; set; } = string.Empty;
}

public class UniswapV3Position
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("liquidity")] public string Liquidity { get; set; } = string.Empty;
    [JsonPropertyName("depositedToken0")] public string DepositedToken0 { get; set; } = string.Empty;
    [JsonPropertyName("depositedToken1")] public string DepositedToken1 { get; set; } = string.Empty;
    [JsonPropertyName("withdrawnToken0")] public string WithdrawnToken0 { get; set; } = string.Empty;
    [JsonPropertyName("withdrawnToken1")] public string WithdrawnToken1 { get; set; } = string.Empty;
    [JsonPropertyName("collectedFeesToken0")] public string CollectedFeesToken0 { get; set; } = string.Empty;
    [JsonPropertyName("collectedFeesToken1")] public string CollectedFeesToken1 { get; set; } = string.Empty;
    [JsonPropertyName("feeGrowthInside0LastX128")] public string FeeGrowthInside0LastX128 { get; set; } = string.Empty;
    [JsonPropertyName("feeGrowthInside1LastX128")] public string FeeGrowthInside1LastX128 { get; set; } = string.Empty;
    [JsonPropertyName("tickLower")] public long TickLower { get; set; } = 0;
    [JsonPropertyName("tickUpper")] public long TickUpper { get; set; } = 0;
    [JsonPropertyName("rangeStatus")] public string RangeStatus { get; set; } = string.Empty;
    [JsonPropertyName("minPriceToken1PerToken0")] public string MinPriceToken1PerToken0 { get; set; } = string.Empty;
    [JsonPropertyName("maxPriceToken1PerToken0")] public string MaxPriceToken1PerToken0 { get; set; } = string.Empty;
    [JsonPropertyName("currentPriceToken1PerToken0")] public string CurrentPriceToken1PerToken0 { get; set; } = string.Empty;

    [JsonPropertyName("rawTokensOwed0")] public string RawTokensOwed0 { get; set; } = string.Empty;
    [JsonPropertyName("rawTokensOwed1")] public string RawTokensOwed1 { get; set; } = string.Empty;
    [JsonPropertyName("estimatedUncollectedToken0")] public string EstimatedUncollectedToken0 { get; set; } = string.Empty;
    [JsonPropertyName("estimatedUncollectedToken1")] public string EstimatedUncollectedToken1 { get; set; } = string.Empty;

    [JsonPropertyName("token0")] public UniswapV3Token Token0 { get; set; } = new();
    [JsonPropertyName("token1")] public UniswapV3Token Token1 { get; set; } = new();
    [JsonPropertyName("pool")] public UniswapV3Pool Pool { get; set; } = new();
}

public class UniswapV3Pool
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("feeTier")] public string FeeTier { get; set; } = string.Empty;
    [JsonPropertyName("liquidity")] public string Liquidity { get; set; } = string.Empty;
    [JsonPropertyName("feeGrowthGlobal0X128")] public string FeeGrowthGlobal0X128 { get; set; } = string.Empty;
    [JsonPropertyName("feeGrowthGlobal1X128")] public string FeeGrowthGlobal1X128 { get; set; } = string.Empty;
    [JsonPropertyName("tick")] public string Tick { get; set; } = string.Empty;
    [JsonPropertyName("tickSpacing")] public string TickSpacing { get; set; } = string.Empty;
    [JsonPropertyName("sqrtPriceX96")] public string SqrtPriceX96 { get; set; } = string.Empty;
    [JsonPropertyName("createdAtUnix")] public string CreatedAtUnix { get; set; } = string.Empty;
}

public class UniswapV3Token
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("symbol")] public string Symbol { get; set; } = string.Empty;
    [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
    [JsonPropertyName("decimals")] public string Decimals { get; set; } = string.Empty;
    [JsonPropertyName("tokenAddress")] public string TokenAddress { get; set; } = string.Empty;
    [JsonPropertyName("derivedNative")] public string DerivedNative { get; set; } = string.Empty;
    [JsonPropertyName("feesUSD")] public string FeesUSD { get; set; } = string.Empty;
}