namespace DeFi10.API.Configuration;

public sealed class TokenCacheOptions
{
    public int PriceUpdateIntervalMinutes { get; set; } = 60;
    
    public bool EnableAutoPriceUpdate { get; set; } = true;
    
    public int BatchSize { get; set; } = 50;
    
    public int WorkerProcessIntervalSeconds { get; set; } = 30;
}
