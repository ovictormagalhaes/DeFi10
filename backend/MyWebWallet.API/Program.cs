using MyWebWallet.API.Services;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Mappers;
using MyWebWallet.API.Services.Models;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// FORÇA HTTP-ONLY COMPLETAMENTE para produção
if (builder.Environment.IsProduction())
{
    // Limpa todas as configurações de URL
    builder.Configuration["Urls"] = null;
    builder.Configuration["ASPNETCORE_URLS"] = null;
    
    // Get the port from environment variable (Render sets PORT=10000)
    var renderPort = int.Parse(Environment.GetEnvironmentVariable("PORT") ?? "8080");
    
    // Usar CreateDefaultBuilder com configuração mínima
    builder.WebHost.UseKestrel(options =>
    {
        // Limpar todos os endpoints
        options.ListenAnyIP(renderPort);
    });
}

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "MyWebWallet API", Version = "v1" });
});

// Add CORS for production
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        // Allow frontend domain in production
        if (builder.Environment.IsProduction())
        {
            policy.WithOrigins(
                "https://mywebwallet-frontend.onrender.com"
            );
        }
        else
        {
            policy.WithOrigins(
                "http://localhost:10002",
                "https://localhost:10002"
            );
        }
        
        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Add health checks
builder.Services.AddHealthChecks();

// Configure Redis
builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var configuration = sp.GetRequiredService<IConfiguration>();
    var connectionString = configuration["Redis:ConnectionString"];
    var user = configuration["Redis:User"];
    var password = configuration["Redis:Password"];

    if (string.IsNullOrEmpty(connectionString))
    {
        throw new InvalidOperationException("Redis connection string is required");
    }

    var configurationOptions = ConfigurationOptions.Parse(connectionString);
    
    if (!string.IsNullOrEmpty(user))
        configurationOptions.User = user;
    
    if (!string.IsNullOrEmpty(password))
        configurationOptions.Password = password;

    configurationOptions.AbortOnConnectFail = false;
    configurationOptions.ConnectRetry = 5;
    configurationOptions.ConnectTimeout = 15000;
    configurationOptions.SyncTimeout = 15000;

    Console.WriteLine($"INFO: Redis: Connecting to Redis for production");

    return ConnectionMultiplexer.Connect(configurationOptions);
});

// Register cache services
builder.Services.AddScoped<ICacheService, RedisCacheService>();
builder.Services.AddSingleton<ITokenLogoService, TokenLogoService>();

// Register helper services
builder.Services.AddScoped<MyWebWallet.API.Services.Helpers.TokenHydrationHelper>();

// Register services
builder.Services.AddScoped<IWalletService, WalletService>();
builder.Services.AddScoped<IBlockchainService, EthereumService>();
builder.Services.AddScoped<IMoralisService, MoralisService>();
// Register AaveeService as IAaveeService
builder.Services.AddScoped<IAaveeService, AaveeService>();
builder.Services.AddScoped<IUniswapV3Service, UniswapV3Service>();
builder.Services.AddScoped<IUniswapV3OnChainService, UniswapV3OnChainService>();
builder.Services.AddScoped<IAlchemyNftService, AlchemyNftService>();

// Register wallet item mappers using Strategy Pattern
builder.Services.AddScoped<IWalletItemMapper<IEnumerable<TokenDetail>>, MoralisTokenMapper>();
builder.Services.AddScoped<IWalletItemMapper<AaveGetUserSuppliesResponse>, AaveSuppliesMapper>();
builder.Services.AddScoped<IWalletItemMapper<AaveGetUserBorrowsResponse>, AaveBorrowsMapper>();
builder.Services.AddScoped<IWalletItemMapper<UniswapV3GetActivePoolsResponse>, UniswapV3Mapper>();

// Register mapper factory
builder.Services.AddScoped<IWalletItemMapperFactory, WalletItemMapperFactory>();

// Add HTTP clients
builder.Services.AddHttpClient<EthereumService>();
builder.Services.AddHttpClient<MoralisService>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment() || app.Environment.IsProduction())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "MyWebWallet API v1");
        c.RoutePrefix = "swagger";
    });
}

// Test Redis connection on startup
try
{
    var redis = app.Services.GetRequiredService<IConnectionMultiplexer>();
    var database = redis.GetDatabase();
    await database.PingAsync();
    Console.WriteLine("SUCCESS: Redis connection established successfully");
}
catch (Exception ex)
{
    Console.WriteLine($"WARNING: Redis connection failed: {ex.Message}");
    Console.WriteLine("Application will continue without caching");
}

// Initialize Token Logo Service on startup
try
{
    var tokenLogoService = app.Services.GetRequiredService<ITokenLogoService>();
    await tokenLogoService.LoadAllTokensIntoMemoryAsync();
    
    var baseCount = await tokenLogoService.GetCachedTokenCountAsync(MyWebWallet.API.Models.Chain.Base);
    var bnbCount = await tokenLogoService.GetCachedTokenCountAsync(MyWebWallet.API.Models.Chain.BNB);
    
    Console.WriteLine($"SUCCESS: Token logos loaded - Base: {baseCount}, BNB: {bnbCount}");
}
catch (Exception ex)
{
    Console.WriteLine($"WARNING: Token logo service initialization failed: {ex.Message}");
}

// Add health check endpoint
app.MapHealthChecks("/health");

app.UseCors();
app.MapControllers();

// Log startup information
var environment = app.Environment.EnvironmentName;
var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
Console.WriteLine($"INFO: MyWebWallet API starting in {environment} environment on port {port} (HTTP-only)");

app.Run();
