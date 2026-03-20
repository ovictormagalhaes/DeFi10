using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;
using Xunit.Abstractions;
using DeFi10.API.Configuration;
using DeFi10.API.Services.Infrastructure.MoralisSolana;

namespace DeFi10.API.IntegrationTests;

/// <summary>
/// Test to verify if Moralis API provides logo for Solana cbBTC token
/// </summary>
public class MoralisCbBtcLogoTest : IDisposable
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ITestOutputHelper _output;
    
    // cbBTC mint address on Solana
    private const string CBBTC_MINT = "cbbtcf3aa214zxhbiazqwf4122fbybrandfqgw4imij"; // From MongoDB

    public MoralisCbBtcLogoTest(ITestOutputHelper output)
    {
        _output = output;
        
        var config = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false)
            .Build();

        var services = new ServiceCollection();
        
        services.AddLogging(builder =>
        {
            builder.AddConsole();
            builder.SetMinimumLevel(LogLevel.Debug);
        });

        // Configure Moralis
        services.Configure<MoralisOptions>(config.GetSection("Moralis"));
        services.AddHttpClient<IMoralisSolanaService, MoralisSolanaService>()
            .ConfigureHttpClient((sp, client) =>
            {
                var moralisOptions = sp.GetRequiredService<IOptions<MoralisOptions>>().Value;
                client.BaseAddress = new Uri(moralisOptions.SolanaBaseUrl ?? "https://solana-gateway.moralis.io");
            });

        _serviceProvider = services.BuildServiceProvider();
    }

    [Fact]
    public async Task GetSolanaTokens_ShouldReturnCbBtcWithLogo()
    {
        // Arrange
        var moralisService = _serviceProvider.GetRequiredService<IMoralisSolanaService>();
        
        // Using a wallet that has cbBTC (the test wallet from Kamino)
        const string testWallet = "884XrhgNyJFM88AtRpBe1JwycCiWv6PXXhY2bZHWHXQk";

        // Act
        _output.WriteLine($"Fetching tokens from Moralis for wallet: {testWallet}");
        var response = await moralisService.GetTokensAsync(testWallet, Models.Chain.Solana);

        // Assert
        Assert.NotNull(response);
        Assert.NotNull(response.Tokens);
        
        _output.WriteLine($"Total tokens returned: {response.Tokens.Count}");
        
        // Find cbBTC in the response
        var cbBtcToken = response.Tokens.FirstOrDefault(t => 
            t.Symbol?.Equals("CBBTC", StringComparison.OrdinalIgnoreCase) == true ||
            t.Mint?.Equals(CBBTC_MINT, StringComparison.OrdinalIgnoreCase) == true);
        
        if (cbBtcToken != null)
        {
            _output.WriteLine("✅ cbBTC found in Moralis response!");
            _output.WriteLine($"  Mint: {cbBtcToken.Mint}");
            _output.WriteLine($"  Symbol: {cbBtcToken.Symbol}");
            _output.WriteLine($"  Name: {cbBtcToken.Name}");
            _output.WriteLine($"  Logo: {cbBtcToken.Logo ?? "NULL"}");
            _output.WriteLine($"  Amount: {cbBtcToken.Amount}");
            _output.WriteLine($"  Price: ${cbBtcToken.PriceUsd?.ToString("F2") ?? "NULL"}");
            
            // Verify logo exists
            Assert.NotNull(cbBtcToken.Logo);
            Assert.NotEmpty(cbBtcToken.Logo);
            _output.WriteLine($"✅ Logo URL is present: {cbBtcToken.Logo}");
        }
        else
        {
            _output.WriteLine("❌ cbBTC NOT found in Moralis response");
            _output.WriteLine("Available tokens:");
            foreach (var token in response.Tokens.Take(10))
            {
                _output.WriteLine($"  - {token.Symbol} ({token.Name}): Mint={token.Mint}, Logo={token.Logo ?? "NULL"}");
            }
        }
        
        Assert.NotNull(cbBtcToken);
    }

    [Fact]
    public async Task GetTokenPrice_ShouldReturnPriceForCbBtc()
    {
        // Arrange
        var moralisService = _serviceProvider.GetRequiredService<IMoralisSolanaService>();

        // Act
        _output.WriteLine($"Fetching price from Moralis for cbBTC mint: {CBBTC_MINT}");
        var price = await moralisService.GetTokenPriceAsync(CBBTC_MINT);

        // Assert
        if (price.HasValue)
        {
            _output.WriteLine($"✅ Price found: ${price.Value:F2}");
            Assert.True(price.Value > 0, "Price should be greater than 0");
        }
        else
        {
            _output.WriteLine("❌ No price returned from Moralis");
        }
        
        Assert.NotNull(price);
    }

    public void Dispose()
    {
        if (_serviceProvider is IDisposable disposable)
        {
            disposable.Dispose();
        }
    }
}
