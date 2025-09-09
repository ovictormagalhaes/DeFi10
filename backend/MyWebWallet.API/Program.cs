using MyWebWallet.API.Services;
using MyWebWallet.API.Services.Interfaces;

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

// Register services
builder.Services.AddScoped<IWalletService, WalletService>();
builder.Services.AddScoped<IBlockchainService, EthereumService>();
builder.Services.AddScoped<IMoralisService, MoralisService>();
// Register AlchemyService
builder.Services.AddScoped<IAlchemyService, AlchemyService>();
// Add HTTP clients
builder.Services.AddHttpClient<EthereumService>();
builder.Services.AddHttpClient<MoralisService>();
builder.Services.AddHttpClient<AlchemyService>();

var app = builder.Build();

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
