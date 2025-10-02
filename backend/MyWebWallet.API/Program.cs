using MyWebWallet.API.Services;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Mappers;
using MyWebWallet.API.Services.Models;
using StackExchange.Redis;
using MyWebWallet.API.Messaging.Workers; // added
using MyWebWallet.API.Messaging.Rabbit; // added
using Microsoft.Extensions.Options;
using MyWebWallet.API.Configuration;
using MyWebWallet.API.Infrastructure;
using MyWebWallet.API.Infrastructure.Redis;
using MyWebWallet.API.Aggregation;

var builder = WebApplication.CreateBuilder(args);
var port = Environment.GetEnvironmentVariable("PORT") ?? "10000";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Options binding
builder.Services.Configure<CoinMarketCapOptions>(builder.Configuration.GetSection("CoinMarketCap"));
builder.Services.Configure<RedisOptions>(builder.Configuration.GetSection("Redis"));
builder.Services.Configure<AggregationOptions>(builder.Configuration.GetSection("Aggregation"));

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

// Removed WalletService/IWalletService registration (commented implementations)

builder.Services.AddScoped<IBlockchainService, EthereumService>();
builder.Services.AddScoped<IMoralisService, MoralisService>();
builder.Services.AddScoped<IAaveeService, AaveeService>();
builder.Services.AddScoped<IUniswapV3Service, UniswapV3Service>();
builder.Services.AddScoped<IUniswapV3OnChainService, UniswapV3OnChainService>();
builder.Services.AddScoped<IAlchemyNftService, AlchemyNftService>();

builder.Services.AddScoped<IWalletItemMapper<IEnumerable<TokenDetail>>, MoralisTokenMapper>();
builder.Services.AddScoped<IWalletItemMapper<AaveGetUserSuppliesResponse>, AaveSuppliesMapper>();
builder.Services.AddScoped<IWalletItemMapper<AaveGetUserBorrowsResponse>, AaveBorrowsMapper>();
builder.Services.AddScoped<IWalletItemMapper<UniswapV3GetActivePoolsResponse>, UniswapV3Mapper>();

builder.Services.AddScoped<IWalletItemMapperFactory, WalletItemMapperFactory>();

builder.Services.AddHttpClient<EthereumService>();
builder.Services.AddHttpClient<MoralisService>();
builder.Services.AddHttpClient<ICoinMarketCapService, CoinMarketCapService>();

builder.Services.AddScoped<IRebalanceService, RebalanceService>();

// Aggregation orchestration additions
builder.Services.AddSingleton<IAggregationJobStore, AggregationJobStore>();
builder.Services.AddSingleton<ITokenFactory, TokenFactory>();

// Fees 24h heuristic service (to be replaced by precise on-chain variant)
builder.Services.AddSingleton<IUniswapV3FeesService, UniswapV3FeesService>();

// RabbitMQ infrastructure
builder.Services.AddSingleton<IRabbitMqConnectionFactory, RabbitMqConnectionFactory>();
builder.Services.AddSingleton<IMessagePublisher, RabbitMqPublisher>();

// Messaging workers
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

app.MapHealthChecks("/health");
app.UseCors();
app.MapControllers();

logger.LogInformation("MyWebWallet API starting env={Env} port={Port} cors={Cors}", app.Environment.EnvironmentName, port, allowedOrigins.Length > 0 ? string.Join(',', allowedOrigins) : "(fallback localhost)");

app.Run();
