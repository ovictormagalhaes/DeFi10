using MyWebWallet.API.Aggregation;
using MyWebWallet.API.Configuration;
using MyWebWallet.API.Infrastructure;
using MyWebWallet.API.Infrastructure.Redis;
using MyWebWallet.API.Messaging;
using MyWebWallet.API.Messaging.Rabbit;
using MyWebWallet.API.Messaging.Workers;
using MyWebWallet.API.Services;
using MyWebWallet.API.Services.Helpers;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Mappers;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Solana;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);
var port = Environment.GetEnvironmentVariable("PORT") ?? "10000";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Options binding
builder.Services.Configure<CoinMarketCapOptions>(builder.Configuration.GetSection("CoinMarketCap"));
builder.Services.Configure<RedisOptions>(builder.Configuration.GetSection("Redis"));
builder.Services.Configure<AggregationOptions>(builder.Configuration.GetSection("Aggregation"));
builder.Services.Configure<UniswapV3WorkerOptions>(builder.Configuration.GetSection("UniswapV3Workers"));
builder.Services.Configure<ProtocolConfigurationOptions>(builder.Configuration.GetSection("ProtocolConfiguration"));

builder.Services.Configure<ChainConfiguration>(builder.Configuration.GetSection("ChainConfiguration"));

builder.Services.AddSingleton<IChainConfigurationService, ChainConfigurationService>();

builder.Services.AddSingleton<IProtocolConfigurationService, ProtocolConfigurationService>();

builder.Services.AddSingleton<IProtocolPluginRegistry, ProtocolPluginRegistry>();

// Core services
builder.Services.AddSingleton<ISystemClock, SystemClock>();
builder.Services.AddSingleton<IRedisDatabase, RedisDatabaseWrapper>();

// Read allowed origins from configuration (env or appsettings) e.g. Cors:AllowedOrigins:0
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

// Bind RabbitMQ options
builder.Services.Configure<RabbitMqOptions>(builder.Configuration.GetSection("RabbitMQ"));

// Services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddSwaggerGen(c => c.SwaggerDoc("v1", new() { Title = "MyWebWallet API", Version = "v1" }));
}

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins.Length > 0)
            policy.WithOrigins(allowedOrigins);
        else
        {
            // fallback: allow localhost dev
            policy.WithOrigins("http://localhost:10002", "https://localhost:10002");
        }
        policy.AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    });
});

builder.Services.AddHealthChecks();

builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    var optCfg = sp.GetRequiredService<IOptions<RedisOptions>>().Value;
    var cs = optCfg.ConnectionString ?? cfg["Redis:ConnectionString"]; // fallback
    if (string.IsNullOrEmpty(cs)) throw new InvalidOperationException("Redis connection string is required");
    var opt = ConfigurationOptions.Parse(cs);
    if (!string.IsNullOrEmpty(optCfg.User)) opt.User = optCfg.User;
    if (!string.IsNullOrEmpty(optCfg.Password)) opt.Password = optCfg.Password;
    opt.AbortOnConnectFail = false; opt.ConnectRetry = optCfg.ConnectRetry; opt.ConnectTimeout = optCfg.ConnectTimeoutMs; opt.SyncTimeout = optCfg.SyncTimeoutMs;
    return ConnectionMultiplexer.Connect(opt);
});

builder.Services.AddScoped<ICacheService, RedisCacheService>();
builder.Services.AddSingleton<ITokenLogoService, TokenLogoService>();
builder.Services.AddScoped<MyWebWallet.API.Services.Helpers.TokenHydrationHelper>();

// Blockchain / protocol services
builder.Services.AddScoped<IBlockchainService, EthereumService>();
builder.Services.AddScoped<IMoralisService, MoralisEVMService>();  // EVM chains (Ethereum, Base, Arbitrum, BNB)
builder.Services.AddScoped<IAaveeService, AaveeService>();
builder.Services.AddScoped<IUniswapV3Service, UniswapV3Service>();
builder.Services.AddSingleton<IUniswapV3OnChainService, UniswapV3OnChainService>();
builder.Services.AddScoped<IAlchemyNftService, AlchemyNftService>();
// Pendle
builder.Services.AddScoped<IPendleService, PendleService>();
// Solana - dedicated Moralis Solana API service
// Using Kamino REST API for better reliability and no RPC rate limits
builder.Services.AddScoped<ISolanaService, KaminoService>();
builder.Services.AddScoped<IMoralisSolanaService, MoralisSolanaService>();

builder.Services.AddHttpClient<KaminoService>();
builder.Services.AddHttpClient<MoralisSolanaService>();
builder.Services.AddHttpClient<EthereumService>();
builder.Services.AddHttpClient<MoralisEVMService>();
builder.Services.AddHttpClient<ICoinMarketCapService, CoinMarketCapService>();
builder.Services.AddHttpClient<PendleService>();
builder.Services.AddHttpClient<UniswapV3OnChainService>();

builder.Services.AddScoped<IWalletItemMapper<IEnumerable<TokenDetail>>, MoralisTokenMapper>();
builder.Services.AddScoped<IWalletItemMapper<AaveGetUserSuppliesResponse>, AaveSuppliesMapper>();
builder.Services.AddScoped<IWalletItemMapper<AaveGetUserBorrowsResponse>, AaveBorrowsMapper>();
builder.Services.AddScoped<IWalletItemMapper<UniswapV3GetActivePoolsResponse>, UniswapV3Mapper>();
// Pendle mappers
builder.Services.AddScoped<IWalletItemMapper<PendleVePositionsResponse>, PendleVeMapper>();
builder.Services.AddScoped<IWalletItemMapper<PendleDepositsResponse>, PendleDepositsMapper>();
// Solana mappers
builder.Services.AddScoped<IWalletItemMapper<SolanaTokenResponse>, SolanaTokenMapper>();
builder.Services.AddScoped<IWalletItemMapper<IEnumerable<KaminoPosition>>, SolanaKaminoMapper>();
builder.Services.AddScoped<IWalletItemMapper<IEnumerable<RaydiumPosition>>, SolanaRaydiumMapper>();

builder.Services.AddScoped<IWalletItemMapperFactory, WalletItemMapperFactory>();

// Rebalance service
builder.Services.AddScoped<IRebalanceService, RebalanceService>();

// Aggregation orchestration additions
builder.Services.AddSingleton<IAggregationJobStore, AggregationJobStore>();
builder.Services.AddSingleton<ITokenFactory, TokenFactory>();
builder.Services.AddScoped<IPriceService, PriceService>();

// RabbitMQ infrastructure
builder.Services.AddSingleton<IRabbitMqConnectionFactory, RabbitMqConnectionFactory>();
builder.Services.AddSingleton<IMessagePublisher, RabbitMqPublisher>();

// Messaging workers - single enhanced worker with granular logic
builder.Services.AddHostedService<IntegrationRequestWorker>();
builder.Services.AddHostedService<IntegrationResultAggregatorWorker>();
builder.Services.AddHostedService<AggregationTimeoutMonitorWorker>(); // timeout monitor

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "MyWebWallet API v1");
        c.RoutePrefix = "swagger";
    });
}

var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");

try
{
    var redis = app.Services.GetRequiredService<IConnectionMultiplexer>();
    await redis.GetDatabase().PingAsync();
    logger.LogInformation("Redis connection established successfully");
}
catch (Exception ex)
{
    logger.LogWarning(ex, "Redis connection failed");
}

try
{
    var tokenLogoService = app.Services.GetRequiredService<ITokenLogoService>();
    await tokenLogoService.LoadAllTokensIntoMemoryAsync();
    var baseCount = await tokenLogoService.GetCachedTokenCountAsync(MyWebWallet.API.Models.Chain.Base);
    var bnbCount = await tokenLogoService.GetCachedTokenCountAsync(MyWebWallet.API.Models.Chain.BNB);
    logger.LogInformation("Token logos loaded - Base: {Base}, BNB: {BNB}", baseCount, bnbCount);
}
catch (Exception ex)
{
    logger.LogWarning(ex, "Token logo service initialization failed");
}

// Initialize Plugin System
try
{
    var pluginRegistry = app.Services.GetRequiredService<IProtocolPluginRegistry>();
    var pluginCount = await pluginRegistry.DiscoverAndRegisterPluginsAsync();
    logger.LogInformation("Protocol plugin system initialized - Discovered {Count} plugins", pluginCount);

    var healthResults = await pluginRegistry.CheckPluginHealthAsync();
    var healthyPlugins = healthResults.Count(kvp => kvp.Value.IsHealthy);
    logger.LogInformation("Plugin health check - {Healthy}/{Total} plugins are healthy", healthyPlugins, healthResults.Count);

    foreach (var (pluginId, health) in healthResults)
    {
        if (health.IsHealthy)
        {
            logger.LogDebug("Plugin {PluginId} is healthy - Status: {Status}, Response time: {ResponseTime}ms", pluginId, health.Status, health.ResponseTime.TotalMilliseconds);
        }
        else
        {
            logger.LogWarning("Plugin {PluginId} is unhealthy - Status: {Status}, Errors: {Errors}", pluginId, health.Status, string.Join(", ", health.Errors));
        }
    }
}
catch (Exception ex)
{
    logger.LogError(ex, "Failed to initialize protocol plugin system");
}

// Validate Chain Configuration
try
{
    var chainConfigService = app.Services.GetRequiredService<IChainConfigurationService>();
    var enabledChains = chainConfigService.GetEnabledChains().ToList();
    logger.LogInformation("Chain configuration loaded - {Count} enabled chains: {Chains}", enabledChains.Count, string.Join(", ", enabledChains));

    foreach (var chain in enabledChains)
    {
        var validation = chainConfigService.ValidateChainConfig(chain);
        if (validation.IsValid)
        {
            logger.LogDebug("Chain {Chain} configuration is valid", chain);
        }
        else
        {
            logger.LogWarning("Chain {Chain} configuration has issues - Errors: {Errors}, Warnings: {Warnings}", chain, string.Join(", ", validation.Errors), string.Join(", ", validation.Warnings));
        }
    }
}
catch (Exception ex)
{
    logger.LogError(ex, "Failed to validate chain configurations");
}

var uniV3Options = builder.Configuration.GetSection("UniswapV3Workers").Get<UniswapV3WorkerOptions>();
if (uniV3Options != null)
{
    logger.LogInformation("Uniswap V3 granular processing configured - Enabled: {Enabled}, Timeout: {Timeout}s, MaxRetry: {MaxRetry}, MinSuccess: {MinSuccess}%", uniV3Options.EnableGranularProcessing, uniV3Options.GranularOperationTimeout.TotalSeconds, uniV3Options.MaxRetryAttempts, uniV3Options.MinSuccessRate * 100);
}

app.MapHealthChecks("/health");
app.UseCors();
app.MapControllers();

logger.LogInformation("MyWebWallet API starting env={Env} port={Port} cors={Cors}", app.Environment.EnvironmentName, port, allowedOrigins.Length > 0 ? string.Join(',', allowedOrigins) : "(fallback localhost)");

app.Run();
