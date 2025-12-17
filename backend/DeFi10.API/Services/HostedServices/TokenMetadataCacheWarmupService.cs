using DeFi10.API.Services.Helpers;

namespace DeFi10.API.Services.HostedServices;

/// <summary>
/// Background service that preloads all token metadata from Redis into memory on startup.
/// This improves performance by avoiding cold cache misses on first requests.
/// </summary>
public class TokenMetadataCacheWarmupService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<TokenMetadataCacheWarmupService> _logger;

    public TokenMetadataCacheWarmupService(
        IServiceProvider serviceProvider,
        ILogger<TokenMetadataCacheWarmupService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("[TokenMetadataCacheWarmup] Starting token metadata cache warmup...");
        
        try
        {
            // Create a scope to resolve scoped services
            using var scope = _serviceProvider.CreateScope();
            var metadataService = scope.ServiceProvider.GetRequiredService<ITokenMetadataService>();
            
            // Trigger the warmup (loads from Redis to in-memory dictionaries)
            await metadataService.LoadAllMetadataIntoMemoryAsync();
            
            // Get cache statistics
            var stats = metadataService.GetCacheStats();
            
            _logger.LogInformation(
                "[TokenMetadataCacheWarmup] SUCCESS: Token metadata cache warmup completed!\n" +
                "  Cache Statistics:\n" +
                "    - Addresses indexed: {AddressCount}\n" +
                "    - Symbols indexed: {SymbolCount}\n" +
                "    - Symbol+Name pairs: {SymbolNameCount}\n" +
                "    - Prices cached: {PriceCount}",
                stats.addresses, stats.symbols, stats.symbolNames, stats.prices);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[TokenMetadataCacheWarmup] ERROR: Failed to warm up token metadata cache");
            // Don't throw - allow the app to start even if warmup fails (data will be loaded lazily)
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("[TokenMetadataCacheWarmup] Stopping token metadata cache warmup service");
        return Task.CompletedTask;
    }
}
