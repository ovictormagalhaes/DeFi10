using System.Text.Json.Serialization;

namespace MyWebWallet.API.Services.Models;

public class UniswapV3GetActivePoolsResponseOld
{
    [JsonPropertyName("data")]
    public UniswapV3PositionsData Data { get; set; } = new();
}

public class UniswapV3PositionsDataOld
{
    [JsonPropertyName("bundles")]
    public List<UniswapV3Bundle> Bundles { get; set; } = new();

    [JsonPropertyName("positions")]
    public List<UniswapV3Position> Positions { get; set; } = new();
}

public class UniswapV3BundleOld
{
    [JsonPropertyName("nativePriceUSD")]
    public string NativePriceUSD { get; set; } = string.Empty;
}

public class UniswapV3PositionOld
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("liquidity")]
    public string Liquidity { get; set; } = string.Empty;

    [JsonPropertyName("depositedToken0")]
    public string DepositedToken0 { get; set; } = string.Empty;

    [JsonPropertyName("depositedToken1")]
    public string DepositedToken1 { get; set; } = string.Empty;

    [JsonPropertyName("withdrawnToken0")]
    public string WithdrawnToken0 { get; set; } = string.Empty;

    [JsonPropertyName("withdrawnToken1")]
    public string WithdrawnToken1 { get; set; } = string.Empty;

    [JsonPropertyName("collectedFeesToken0")]
    public string CollectedFeesToken0 { get; set; } = string.Empty;

    [JsonPropertyName("collectedFeesToken1")]
    public string CollectedFeesToken1 { get; set; } = string.Empty;

    [JsonPropertyName("feeGrowthInside0LastX128")]
    public string FeeGrowthInside0LastX128 { get; set; } = string.Empty;

    [JsonPropertyName("feeGrowthInside1LastX128")]
    public string FeeGrowthInside1LastX128 { get; set; } = string.Empty;

    [JsonPropertyName("tickLower")]
    public long TickLower { get; set; } = 0;

    [JsonPropertyName("tickUpper")]
    public long TickUpper { get; set; } = 0;

    [JsonPropertyName("token0")]
    public UniswapV3Token Token0 { get; set; } = new();

    [JsonPropertyName("token1")]
    public UniswapV3Token Token1 { get; set; } = new();

    [JsonPropertyName("pool")]
    public UniswapV3Pool Pool { get; set; } = new();
}

public class UniswapV3PoolOld
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("feeTier")]
    public string FeeTier { get; set; } = string.Empty;

    [JsonPropertyName("liquidity")]
    public string Liquidity { get; set; } = string.Empty;

    [JsonPropertyName("feeGrowthGlobal0X128")]
    public string FeeGrowthGlobal0X128 { get; set; } = string.Empty;

    [JsonPropertyName("feeGrowthGlobal1X128")]
    public string FeeGrowthGlobal1X128 { get; set; } = string.Empty;

    [JsonPropertyName("tick")]
    public string Tick { get; set; } = string.Empty;
}

public class UniswapV3TokenOld
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("symbol")]
    public string Symbol { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("decimals")]
    public string Decimals { get; set; } = string.Empty;

    [JsonPropertyName("tokenAddress")]
    public string TokenAddress { get; set; } = string.Empty;

    [JsonPropertyName("derivedNative")]
    public string DerivedNative { get; set; } = string.Empty;

    [JsonPropertyName("feesUSD")]
    public string FeesUSD { get; set; } = string.Empty;
}