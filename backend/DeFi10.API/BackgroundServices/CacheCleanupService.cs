using DeFi10.API.Repositories.Interfaces;
using Microsoft.Extensions.Options;

namespace DeFi10.API.BackgroundServices
{
    /// <summary>
    /// Background service para limpeza automática do cache de protocolos
    /// Remove:
    /// - Caches expirados (TTL)
    /// - Caches não acessados recentemente (LRU)
    /// </summary>
    public class CacheCleanupService : BackgroundService
    {
        private readonly ILogger<CacheCleanupService> _logger;
        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly bool _enableAutoCleanup;
        private readonly int _cleanupIntervalHours;
        private readonly int _deleteStaleCachesAfterDays;

        public CacheCleanupService(
            ILogger<CacheCleanupService> logger,
            IServiceScopeFactory serviceScopeFactory,
            IConfiguration configuration)
        {
            _logger = logger;
            _serviceScopeFactory = serviceScopeFactory;

            var config = configuration.GetSection("MongoDB:ProtocolCache:Cleanup");
            _enableAutoCleanup = config.GetValue<bool>("EnableAutoCleanup", true);
            _cleanupIntervalHours = config.GetValue<int>("CleanupIntervalHours", 6);
            _deleteStaleCachesAfterDays = config.GetValue<int>("DeleteStaleCachesAfterDays", 7);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_enableAutoCleanup)
            {
                _logger.LogInformation("CacheCleanupService: Auto cleanup is disabled");
                return;
            }

            _logger.LogInformation(
                "CacheCleanupService: Starting - Interval: {Interval}h, Delete stale after: {Days} days",
                _cleanupIntervalHours, _deleteStaleCachesAfterDays);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Aguarda o intervalo antes da primeira execução
                    await Task.Delay(TimeSpan.FromHours(_cleanupIntervalHours), stoppingToken);

                    _logger.LogInformation("CacheCleanupService: Starting cleanup cycle");

                    using var scope = _serviceScopeFactory.CreateScope();
                    var repository = scope.ServiceProvider.GetService<IProtocolCacheRepository>();

                    if (repository == null)
                    {
                        _logger.LogWarning("CacheCleanupService: IProtocolCacheRepository not registered, skipping cleanup");
                        continue;
                    }

                    // 1. Limpar caches expirados (TTL)
                    var expiredCount = await repository.CleanupExpiredCachesAsync();
                    if (expiredCount > 0)
                    {
                        _logger.LogInformation("CacheCleanupService: Removed {Count} expired caches", expiredCount);
                    }

                    // 2. Limpar caches não acessados recentemente (LRU)
                    var staleCount = await repository.CleanupStaleCachesAsync(_deleteStaleCachesAfterDays);
                    if (staleCount > 0)
                    {
                        _logger.LogInformation("CacheCleanupService: Removed {Count} stale caches (>{Days} days without access)",
                            staleCount, _deleteStaleCachesAfterDays);
                    }

                    // 3. Estatísticas gerais
                    var stats = await repository.GetCacheStatsAsync();
                    if (stats.Any())
                    {
                        _logger.LogInformation("CacheCleanupService: Cache stats after cleanup:");
                        foreach (var stat in stats)
                        {
                            _logger.LogInformation(
                                "  - {Protocol}: {Count} caches, {Valid} valid, {Invalid} invalid",
                                stat.Key, stat.Value.TotalCaches, stat.Value.ValidCaches, stat.Value.InvalidCaches);
                        }
                    }

                    _logger.LogInformation("CacheCleanupService: Cleanup cycle completed");
                }
                catch (OperationCanceledException)
                {
                    // Expected when stopping the service
                    _logger.LogInformation("CacheCleanupService: Stopping...");
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "CacheCleanupService: Error during cleanup cycle");
                    // Continue mesmo com erro - próximo ciclo tentará novamente
                }
            }

            _logger.LogInformation("CacheCleanupService: Stopped");
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("CacheCleanupService: Stop requested");
            await base.StopAsync(cancellationToken);
        }
    }
}
