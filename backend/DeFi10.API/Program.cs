using DeFi10.API.Extensions;
using DeFi10.API.Services.Helpers;
using DeFi10.API.Migration;

#if DEBUG
// Load .env file BEFORE creating builder (for local development)
var envPath = Path.Combine(Directory.GetCurrentDirectory(), "..", ".env");
if (File.Exists(envPath))
{
    foreach (var line in File.ReadAllLines(envPath))
    {
        var trimmedLine = line.Trim();
        if (string.IsNullOrWhiteSpace(trimmedLine) || trimmedLine.StartsWith("#"))
            continue;

        var parts = trimmedLine.Split('=', 2);
        if (parts.Length == 2)
        {
            var key = parts[0].Trim();
            var value = parts[1].Trim();
            Environment.SetEnvironmentVariable(key, value);
        }
    }
}
#endif

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT") ?? "10000";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Configure services
builder.Services.AddApplicationOptions(builder.Configuration);
builder.Services.AddOptionsValidation();
builder.Services.AddInfrastructureServices();
builder.Services.AddCacheServices(builder.Configuration);
builder.Services.AddApplicationServices();
builder.Services.AddProtocolServices();
builder.Services.AddMappers();
builder.Services.AddAggregationServices();
builder.Services.AddMessaging();

builder.AddCorsConfiguration();
builder.AddJwtAuthentication();
builder.AddControllersWithOptions();
builder.AddRateLimiting();
builder.AddHealthChecksConfiguration();

var app = builder.Build();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");

app.UseMiddlewarePipeline();
await app.ValidateStartupAsync();
app.ConfigureEndpoints();

// Seed data
using (var scope = app.Services.CreateScope())
{
    // Seed known token metadata
    var seeder = ActivatorUtilities.CreateInstance<KnownTokensSeeder>(scope.ServiceProvider);
    await seeder.SeedKnownTokensAsync();
}

logger.LogInformation("DeFi10 API starting env={Env} port={Port} cors={Cors}", 
    app.Environment.EnvironmentName, 
    port, 
    allowedOrigins.Length > 0 ? string.Join(',', allowedOrigins) : "(fallback localhost)");

app.Run();
