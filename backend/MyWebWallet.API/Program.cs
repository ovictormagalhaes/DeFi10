using MyWebWallet.API.Services;
using MyWebWallet.API.Services.Helpers;
using MyWebWallet.API.Services.Interfaces;
using MyWebWallet.API.Services.Mappers;
using MyWebWallet.API.Services.Models;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "MyWebWallet API", Version = "v1" });
});

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:10002") // Updated frontend port
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Configure Redis
builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var configuration = sp.GetRequiredService<IConfiguration>();
    var connectionString = configuration["Redis:ConnectionString"];
    var user = configuration["Redis:User"];
    var password = configuration["Redis:Password"];

    var configurationOptions = ConfigurationOptions.Parse(connectionString!);
    
    if (!string.IsNullOrEmpty(user))
        configurationOptions.User = user;
    
    if (!string.IsNullOrEmpty(password))
        configurationOptions.Password = password;

    configurationOptions.AbortOnConnectFail = false;
    configurationOptions.ConnectRetry = 3;
    configurationOptions.ConnectTimeout = 10000;
    configurationOptions.SyncTimeout = 10000;

    Console.WriteLine($"DEBUG: Redis: Connecting to {connectionString} with user: {user ?? "none"}");

    return ConnectionMultiplexer.Connect(configurationOptions);
});

// Register cache services
builder.Services.AddScoped<ICacheService, RedisCacheService>();
builder.Services.AddSingleton<ITokenLogoService, TokenLogoService>();

// Register helper services
builder.Services.AddScoped<TokenHydrationHelper>();

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

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors();
app.MapControllers();

app.Run();
