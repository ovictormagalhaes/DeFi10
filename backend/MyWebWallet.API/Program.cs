using MyWebWallet.API.Services;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Mappers;
using MyWebWallet.API.Services.Models;
using StackExchange.Redis;

// Definir portas/URLs ANTES de criar o builder para impedir que Kestrel leia HTTPS pré-configurado
var detectedPort = Environment.GetEnvironmentVariable("PORT") ?? "10000"; // Render normalmente usa 10000
// Remover possíveis variáveis de HTTPS herdadas do container base
Environment.SetEnvironmentVariable("HTTPS_PORTS", null);
Environment.SetEnvironmentVariable("ASPNETCORE_HTTPS_PORTS", null);
Environment.SetEnvironmentVariable("ASPNETCORE_HTTPS_PORT", null);
// Definir somente HTTP
Environment.SetEnvironmentVariable("HTTP_PORTS", detectedPort);
Environment.SetEnvironmentVariable("ASPNETCORE_URLS", $"http://0.0.0.0:{detectedPort}");

Environment.SetEnvironmentVariable("DOTNET_USE_POLLING_FILE_WATCHER", "0");
Environment.SetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER", "true");
Environment.SetEnvironmentVariable("ASPNETCORE_Kestrel__Endpoints__Https__Url", "");

// Agora criar o builder (Kestrel já verá apenas HTTP)
var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsProduction())
{
    builder.WebHost.ConfigureKestrel(o =>
    {
        o.ListenAnyIP(int.Parse(detectedPort)); // só HTTP
        o.ConfigureEndpointDefaults(lo => lo.UseHttps(httpsOptions => { }));
    });
}

// Services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => c.SwaggerDoc("v1", new() { Title = "MyWebWallet API", Version = "v1" }));

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (builder.Environment.IsProduction())
            policy.WithOrigins("http://mywebwallet-frontend.onrender.com");
        else
            policy.WithOrigins("http://localhost:10002");
        policy.AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    });
});

builder.Services.AddHealthChecks();

builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    var cs = cfg["Redis:ConnectionString"];
    var user = cfg["Redis:User"]; var pwd = cfg["Redis:Password"];
    if (string.IsNullOrEmpty(cs)) throw new InvalidOperationException("Redis connection string is required");
    var opt = ConfigurationOptions.Parse(cs);
    if (!string.IsNullOrEmpty(user)) opt.User = user;
    if (!string.IsNullOrEmpty(pwd)) opt.Password = pwd;
    opt.AbortOnConnectFail = false; opt.ConnectRetry = 5; opt.ConnectTimeout = 15000; opt.SyncTimeout = 15000;
    Console.WriteLine("INFO: Redis: Connecting to Redis for production");
    return ConnectionMultiplexer.Connect(opt);
});

builder.Services.AddScoped<ICacheService, RedisCacheService>();
builder.Services.AddSingleton<ITokenLogoService, TokenLogoService>();
builder.Services.AddScoped<MyWebWallet.API.Services.Helpers.TokenHydrationHelper>();

builder.Services.AddScoped<IWalletService, WalletService>();
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

var app = builder.Build();

// NÃO usar app.UseHttpsRedirection();
if (app.Environment.IsDevelopment() || app.Environment.IsProduction())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "MyWebWallet API v1");
        c.RoutePrefix = "swagger";
    });
}

try
{
    var redis = app.Services.GetRequiredService<IConnectionMultiplexer>();
    await redis.GetDatabase().PingAsync();
    Console.WriteLine("SUCCESS: Redis connection established successfully");
}
catch (Exception ex)
{
    Console.WriteLine($"WARNING: Redis connection failed: {ex.Message}");
}

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

app.MapHealthChecks("/health");
app.UseCors();
app.MapControllers();

Console.WriteLine($"INFO: MyWebWallet API starting in {app.Environment.EnvironmentName} environment on port {detectedPort} (HTTP-only, HTTPS disabled at source)");

app.Run();
