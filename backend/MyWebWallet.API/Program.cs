using MyWebWallet.API.Aggregation;
using MyWebWallet.API.Configuration;
using MyWebWallet.API.Infrastructure;
using MyWebWallet.API.Infrastructure.Redis;
using MyWebWallet.API.Messaging.Rabbit;
using MyWebWallet.API.Messaging.Workers;
using MyWebWallet.API.Messaging.Workers.TriggerRules;
using MyWebWallet.API.Middleware;
using MyWebWallet.API.Services;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Mappers;
using MyWebWallet.API.Services.Models;
using MyWebWallet.API.Services.Models.Aave.Supplies;
using MyWebWallet.API.Services.Models.Solana.Common;
using MyWebWallet.API.Services.Models.Solana.Kamino;
using MyWebWallet.API.Services.Models.Solana.Raydium;
using MyWebWallet.API.Services.Solana;
using MyWebWallet.API.Services.Solana.Raydium;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;
using Solnet.Rpc;
using System.Text;
using System.IdentityModel.Tokens.Jwt;

var builder = WebApplication.CreateBuilder(args);
var port = Environment.GetEnvironmentVariable("PORT") ?? "10000";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

builder.Services.Configure<CoinMarketCapOptions>(builder.Configuration.GetSection("CoinMarketCap"));
builder.Services.Configure<RedisOptions>(builder.Configuration.GetSection("Redis"));
builder.Services.Configure<AggregationOptions>(builder.Configuration.GetSection("Aggregation"));
builder.Services.Configure<UniswapV3WorkerOptions>(builder.Configuration.GetSection("UniswapV3Workers"));
builder.Services.Configure<ProtocolConfigurationOptions>(builder.Configuration.GetSection("ProtocolConfiguration"));
builder.Services.Configure<ChainConfiguration>(builder.Configuration.GetSection("ChainConfiguration"));
builder.Services.Configure<RabbitMqOptions>(builder.Configuration.GetSection("RabbitMQ"));
builder.Services.Configure<RateLimitOptions>(builder.Configuration.GetSection("RateLimiting"));
builder.Services.Configure<MoralisOptions>(builder.Configuration.GetSection("Moralis"));
builder.Services.Configure<AaveOptions>(builder.Configuration.GetSection("Aave"));
builder.Services.Configure<PendleOptions>(builder.Configuration.GetSection("Pendle"));
builder.Services.Configure<KaminoOptions>(builder.Configuration.GetSection("Kamino"));
builder.Services.Configure<SolanaOptions>(builder.Configuration.GetSection("Solana"));
builder.Services.Configure<AlchemyOptions>(builder.Configuration.GetSection("Alchemy"));
builder.Services.Configure<ProofOfWorkOptions>(builder.Configuration.GetSection("ProofOfWork"));
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));

builder.Services.AddSingleton<IValidateOptions<MoralisOptions>, MoralisOptions>();
builder.Services.AddSingleton<IValidateOptions<RedisOptions>, RedisOptions>();
builder.Services.AddSingleton<IValidateOptions<AggregationOptions>, AggregationOptions>();
builder.Services.AddSingleton<IValidateOptions<AaveOptions>, AaveOptions>();
builder.Services.AddSingleton<IValidateOptions<SolanaOptions>, SolanaOptions>();
builder.Services.AddSingleton<IValidateOptions<AlchemyOptions>, AlchemyOptions>();
builder.Services.AddSingleton<IValidateOptions<ProofOfWorkOptions>, ProofOfWorkOptions>();
builder.Services.AddSingleton<IValidateOptions<JwtOptions>, JwtOptions>();

builder.Services.AddSingleton<IChainConfigurationService, ChainConfigurationService>();

builder.Services.AddSingleton<IProtocolConfigurationService, ProtocolConfigurationService>();

builder.Services.AddSingleton<ISystemClock, SystemClock>();
builder.Services.AddSingleton<IRedisDatabase, RedisDatabaseWrapper>();
builder.Services.AddScoped<IWalletGroupService, WalletGroupService>();
builder.Services.AddSingleton<IProofOfWorkService, ProofOfWorkService>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });
builder.Services.AddEndpointsApiExplorer();
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddSwaggerGen(c => c.SwaggerDoc("v1", new() { Title = "MyWebWallet API", Version = "v1" }));
}

var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>();
if (jwtOptions == null)
{
    throw new InvalidOperationException("JWT configuration is required");
}

JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtOptions.Issuer,
        ValidAudience = jwtOptions.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Secret)),
        ClockSkew = TimeSpan.Zero
    };

    // Adiciona eventos para debug
    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = context =>
        {
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
            logger.LogWarning("JWT Authentication failed: {Exception}", context.Exception.Message);
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();
            logger.LogInformation("JWT Token validated successfully for user {User}", context.Principal?.Identity?.Name);
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins.Length > 0)
            policy.WithOrigins(allowedOrigins);
        else
        {
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
    var cs = optCfg.ConnectionString ?? cfg["Redis:ConnectionString"];
    if (string.IsNullOrEmpty(cs)) throw new InvalidOperationException("Redis connection string is required");
    var opt = ConfigurationOptions.Parse(cs);
    if (!string.IsNullOrEmpty(optCfg.User)) opt.User = optCfg.User;
    if (!string.IsNullOrEmpty(optCfg.Password)) opt.Password = optCfg.Password;
    opt.AbortOnConnectFail = false; opt.ConnectRetry = optCfg.ConnectRetry; opt.ConnectTimeout = optCfg.ConnectTimeoutMs; opt.SyncTimeout = optCfg.SyncTimeoutMs;
    return ConnectionMultiplexer.Connect(opt);
});

builder.Services.AddScoped<ICacheService, RedisCacheService>();
builder.Services.AddScoped<MyWebWallet.API.Services.Helpers.TokenHydrationHelper>();

builder.Services.AddSingleton<IRpcClient>(sp =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    var rpcUrl = "https://api.mainnet-beta.solana.com";// cfg["Solana:RpcUrl"]

    var rpcClient = ClientFactory.GetClient(rpcUrl);
    return rpcClient;
});

builder.Services.AddScoped<IWalletAggregationService, WalletAggregationService>();
builder.Services.AddScoped<IMoralisService, MoralisEVMService>();
builder.Services.AddScoped<IAaveeService, AaveeService>();
builder.Services.AddScoped<IUniswapV3Service, UniswapV3Service>();
builder.Services.AddSingleton<IUniswapV3OnChainService, UniswapV3OnChainService>();
builder.Services.AddScoped<IAlchemyNftService, AlchemyNftService>();
builder.Services.AddScoped<IPendleService, PendleService>();
builder.Services.AddScoped<ISolanaService, KaminoService>();
builder.Services.AddScoped<IMoralisSolanaService, MoralisSolanaService>();
builder.Services.AddScoped<IRaydiumOnChainService, RaydiumOnChainService>();
builder.Services.AddScoped<ITokenMetadataService, TokenMetadataService>();
builder.Services.AddScoped<WalletItemLabelEnricher>();

builder.Services.AddHttpClient<KaminoService>();
builder.Services.AddHttpClient<MoralisSolanaService>();
builder.Services.AddHttpClient<WalletAggregationService>();
builder.Services.AddHttpClient<MoralisEVMService>();
builder.Services.AddHttpClient<ICoinMarketCapService, CoinMarketCapService>();
builder.Services.AddHttpClient<PendleService>();
builder.Services.AddHttpClient<UniswapV3OnChainService>();

builder.Services.AddScoped<IWalletItemMapper<IEnumerable<TokenDetail>>, MoralisTokenMapper>();
builder.Services.AddScoped<IWalletItemMapper<AaveGetUserSuppliesResponse>, AaveSuppliesMapper>();
builder.Services.AddScoped<IWalletItemMapper<AaveGetUserBorrowsResponse>, AaveBorrowsMapper>();
builder.Services.AddScoped<IWalletItemMapper<UniswapV3GetActivePoolsResponse>, UniswapV3Mapper>();
builder.Services.AddScoped<IWalletItemMapper<PendleVePositionsResponse>, PendleVeMapper>();
builder.Services.AddScoped<IWalletItemMapper<PendleDepositsResponse>, PendleDepositsMapper>();
builder.Services.AddScoped<IWalletItemMapper<SolanaTokenResponse>, SolanaTokenMapper>();
builder.Services.AddScoped<IWalletItemMapper<IEnumerable<KaminoPosition>>, SolanaKaminoMapper>();
builder.Services.AddScoped<IWalletItemMapper<IEnumerable<RaydiumPosition>>, SolanaRaydiumMapper>();

builder.Services.AddScoped<IWalletItemMapperFactory, WalletItemMapperFactory>();

builder.Services.AddScoped<IRebalanceService, RebalanceService>();

builder.Services.AddSingleton<IAggregationJobStore, AggregationJobStore>();
builder.Services.AddSingleton<ITokenFactory, TokenFactory>();
builder.Services.AddScoped<IPriceService, PriceService>();
builder.Services.AddScoped<IProtocolStatusService, ProtocolStatusService>();

builder.Services.AddSingleton<IRabbitMqConnectionFactory, RabbitMqConnectionFactory>();
builder.Services.AddSingleton<IMessagePublisher, RabbitMqPublisher>();

// Dynamic Job Expansion Services (for event-driven protocol triggering)
builder.Services.AddSingleton<JobExpansionService>();
builder.Services.AddSingleton<IProtocolTriggerDetector, UniswapV3NftDetector>();
builder.Services.AddSingleton<IProtocolTriggerDetector, RaydiumNftDetector>();

builder.Services.AddHostedService<IntegrationRequestWorker>();
builder.Services.AddHostedService<IntegrationResultAggregatorWorker>();
builder.Services.AddHostedService<AggregationTimeoutMonitorWorker>();

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

app.UseCorrelationId();
app.UseGlobalExceptionHandler();
app.UseRateLimiting();

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
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

logger.LogInformation("MyWebWallet API starting env={Env} port={Port} cors={Cors}", app.Environment.EnvironmentName, port, allowedOrigins.Length > 0 ? string.Join(',', allowedOrigins) : "(fallback localhost)");

app.Run();
