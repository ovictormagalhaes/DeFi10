using DeFi10.API.Services.Helpers;

namespace DeFi10.API.Services.HostedServices;

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
            using var scope = _serviceProvider.CreateScope();
            var metadataService = scope.ServiceProvider.GetRequiredService<ITokenMetadataService>();
            
            // Load all token metadata from MongoDB into memory
            await metadataService.LoadAllMetadataIntoMemoryAsync();
            
            _logger.LogInformation("[TokenMetadataCacheWarmup] SUCCESS: Token metadata cache warmup completed!");
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
