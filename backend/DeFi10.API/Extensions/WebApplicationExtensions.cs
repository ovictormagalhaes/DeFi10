using DeFi10.API.Configuration;
using DeFi10.API.Middleware;
using DeFi10.API.Services.Interfaces;
using StackExchange.Redis;

namespace DeFi10.API.Extensions;

public static class WebApplicationExtensions
{
    public static WebApplication UseMiddlewarePipeline(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI(c =>
            {
                c.SwaggerEndpoint("/swagger/v1/swagger.json", "DeFi10 API v1");
                c.RoutePrefix = "swagger";
            });
        }

        app.UseCorrelationId();
        app.UseGlobalExceptionHandler();
        app.UseRateLimiting();

        return app;
    }

    public static async Task<WebApplication> ValidateStartupAsync(this WebApplication app)
    {
        var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");

        // Validate Redis connection
        try
        {
            var redis = app.Services.GetRequiredService<IConnectionMultiplexer>();
            await redis.GetDatabase().PingAsync();
            logger.LogDebug("Redis connection established successfully");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis connection failed");
        }

        // Validate Chain Configuration
        try
        {
            var chainConfigService = app.Services.GetRequiredService<IChainConfigurationService>();
            var enabledChains = chainConfigService.GetEnabledChains().ToList();
            logger.LogDebug("Chain configuration loaded - {Count} enabled chains: {Chains}", 
                enabledChains.Count, string.Join(", ", enabledChains));

            foreach (var chain in enabledChains)
            {
                var validation = chainConfigService.ValidateChainConfig(chain);
                if (validation.IsValid)
                {
                    logger.LogDebug("Chain {Chain} configuration is valid", chain);
                }
                else
                {
                    logger.LogWarning("Chain {Chain} configuration has issues - Errors: {Errors}, Warnings: {Warnings}", 
                        chain, string.Join(", ", validation.Errors), string.Join(", ", validation.Warnings));
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to validate chain configurations");
        }

        // Log Uniswap V3 Configuration
        var uniV3Options = app.Configuration.GetSection("UniswapV3Workers").Get<UniswapV3WorkerOptions>();
        if (uniV3Options != null)
        {
            logger.LogDebug("Uniswap V3 granular processing configured - Enabled: {Enabled}, Timeout: {Timeout}s, MaxRetry: {MaxRetry}, MinSuccess: {MinSuccess}%", 
                uniV3Options.EnableGranularProcessing, 
                uniV3Options.GranularOperationTimeout.TotalSeconds, 
                uniV3Options.MaxRetryAttempts, 
                uniV3Options.MinSuccessRate * 100);
        }

        return app;
    }

    public static WebApplication ConfigureEndpoints(this WebApplication app)
    {
        app.MapHealthChecks("/health");
        app.UseCors();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();

        return app;
    }
}
