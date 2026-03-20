using Xunit;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using DeFi10.API.Services.Infrastructure.Moralis;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Configuration;
using Microsoft.Extensions.Options;

namespace DeFi10.API.IntegrationTests;

public class MoralisDeFiPositionsTests
{
    private readonly IConfiguration _configuration;
    private readonly IServiceProvider _serviceProvider;
    private const string TEST_WALLET = "0xF6998ed7484b4aDB3B5aD636D24CB1c576C12b27";

    public MoralisDeFiPositionsTests()
    {
        // Load configuration from .env file
        var envPath = Path.Combine("..", "..", "..", "..", ".env");
        var envVars = new Dictionary<string, string?>();

        if (File.Exists(envPath))
        {
            foreach (var line in File.ReadAllLines(envPath))
            {
                if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#"))
                    continue;

                var parts = line.Split('=', 2);
                if (parts.Length == 2)
                {
                    var key = parts[0].Trim();
                    var value = parts[1].Trim();
                    envVars[key] = value;
                }
            }
        }

        // Load configuration
        var appsettingsPath = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "DeFi10.API", "appsettings.json");
        
        var configBuilder = new ConfigurationBuilder();
        
        if (File.Exists(appsettingsPath))
        {
            configBuilder.AddJsonFile(appsettingsPath, optional: false);
        }
        
        configBuilder.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Moralis:ApiKey"] = envVars.GetValueOrDefault("MORALIS_API_KEY") ?? envVars.GetValueOrDefault("Moralis__ApiKey"),
            ["Moralis:BaseUrl"] = "https://deep-index.moralis.io/api/v2.2",
        });
        
        _configuration = configBuilder.Build();

        // Setup DI
        var services = new ServiceCollection();
        services.AddLogging(builder => builder.AddConsole().SetMinimumLevel(LogLevel.Debug));
        services.AddSingleton(_configuration);
        services.AddHttpClient();
        
        services.Configure<MoralisOptions>(_configuration.GetSection("Moralis"));
        
        // Register protocol configuration service
        services.AddSingleton<IProtocolConfigurationService, ProtocolConfigurationService>();
        services.AddSingleton<IChainConfigurationService, ChainConfigurationService>();
        
        services.AddSingleton<IMoralisEVMService, MoralisEVMService>();

        _serviceProvider = services.BuildServiceProvider();
    }

    [Fact]
    public async Task Moralis_GetDeFiPositions_Base_ShouldReturnPositions()
    {
        // Arrange
        var moralisService = _serviceProvider.GetRequiredService<IMoralisEVMService>();
        var chain = "base";

        Console.WriteLine($"🔍 Testing Moralis DeFi Positions API");
        Console.WriteLine($"📍 Wallet: {TEST_WALLET}");
        Console.WriteLine($"🔗 Chain: {chain}");
        Console.WriteLine();

        // Act
        var response = await moralisService.GetDeFiPositionsAsync(TEST_WALLET, chain);

        // Assert
        Assert.NotNull(response);
        
        Console.WriteLine($"✅ Response received!");
        Console.WriteLine($"📊 Total positions: {response.Count}");
        Console.WriteLine();

        if (response.Count == 0)
        {
            Console.WriteLine("⚠️  No DeFi positions found for this wallet on Base chain");
            return;
        }

        // Print detailed information about each position
        for (int i = 0; i < response.Count; i++)
        {
            var position = response[i];
            
            Console.WriteLine($"═══════════════════════════════════════════════════════");
            Console.WriteLine($"Position #{i + 1}");
            Console.WriteLine($"═══════════════════════════════════════════════════════");
            Console.WriteLine($"🏛️  Protocol: {position.ProtocolName} ({position.ProtocolId})");
            Console.WriteLine($"🔗 URL: {position.ProtocolUrl}");
            Console.WriteLine($"🖼️  Logo: {position.ProtocolLogo}");
            Console.WriteLine();

            // Position details
            Console.WriteLine($"📍 Position Label: {position.Position.Label}");
            Console.WriteLine($"💰 Balance USD: ${position.Position.BalanceUsd}");
            Console.WriteLine($"💵 Unclaimed USD: ${position.Position.TotalUnclaimedUsdValue}");
            Console.WriteLine();

            // Tokens in position
            Console.WriteLine($"🪙  Tokens ({position.Position.Tokens.Count}):");
            foreach (var token in position.Position.Tokens)
            {
                Console.WriteLine($"   ┌─────────────────────────────────────────");
                Console.WriteLine($"   │ Type: {token.TokenType}");
                Console.WriteLine($"   │ Symbol: {token.Symbol}");
                Console.WriteLine($"   │ Name: {token.Name}");
                Console.WriteLine($"   │ Address: {token.ContractAddress}");
                Console.WriteLine($"   │ Decimals: {token.Decimals}");
                Console.WriteLine($"   │ Balance: {token.Balance}");
                Console.WriteLine($"   │ Balance Formatted: {token.BalanceFormatted}");
                Console.WriteLine($"   │ USD Price: ${token.UsdPrice}");
                Console.WriteLine($"   │ USD Value: ${token.UsdValue}");
                Console.WriteLine($"   │ Logo: {(string.IsNullOrEmpty(token.Logo) ? "❌ NULL" : "✅ " + token.Logo)}");
                Console.WriteLine($"   │ Thumbnail: {(string.IsNullOrEmpty(token.Thumbnail) ? "❌ NULL" : "✅ " + token.Thumbnail)}");
                Console.WriteLine($"   └─────────────────────────────────────────");
            }
            Console.WriteLine();
        }

        Console.WriteLine($"═══════════════════════════════════════════════════════");
        Console.WriteLine($"📋 SUMMARY");
        Console.WriteLine($"═══════════════════════════════════════════════════════");
        Console.WriteLine($"Total Positions: {response.Count}");
        
        var totalTokens = response.Sum(p => p.Position.Tokens.Count);
        var tokensWithLogo = response.SelectMany(p => p.Position.Tokens).Count(t => !string.IsNullOrEmpty(t.Logo));
        var tokensWithoutLogo = totalTokens - tokensWithLogo;
        
        Console.WriteLine($"Total Tokens: {totalTokens}");
        Console.WriteLine($"Tokens WITH logo: {tokensWithLogo} ({(totalTokens > 0 ? (tokensWithLogo * 100.0 / totalTokens).ToString("F1") : "0")}%)");
        Console.WriteLine($"Tokens WITHOUT logo: {tokensWithoutLogo} ({(totalTokens > 0 ? (tokensWithoutLogo * 100.0 / totalTokens).ToString("F1") : "0")}%)");
        Console.WriteLine();

        // List tokens without logos
        if (tokensWithoutLogo > 0)
        {
            Console.WriteLine($"⚠️  TOKENS WITHOUT LOGO:");
            var tokensNoLogo = response
                .SelectMany(p => p.Position.Tokens)
                .Where(t => string.IsNullOrEmpty(t.Logo))
                .ToList();

            foreach (var token in tokensNoLogo)
            {
                Console.WriteLine($"   - {token.Symbol} ({token.Name}) @ {token.ContractAddress}");
            }
        }

        Console.WriteLine($"═══════════════════════════════════════════════════════");
    }

    [Fact]
    public async Task Moralis_GetDeFiPositions_Ethereum_ShouldReturnPositions()
    {
        // Arrange
        var moralisService = _serviceProvider.GetRequiredService<IMoralisEVMService>();
        var chain = "eth";

        Console.WriteLine($"🔍 Testing Moralis DeFi Positions API - Ethereum");
        Console.WriteLine($"📍 Wallet: {TEST_WALLET}");
        Console.WriteLine($"🔗 Chain: {chain}");
        Console.WriteLine();

        // Act
        var response = await moralisService.GetDeFiPositionsAsync(TEST_WALLET, chain);

        // Assert
        Assert.NotNull(response);
        
        Console.WriteLine($"✅ Response received!");
        Console.WriteLine($"📊 Total positions: {response.Count}");
        
        if (response.Count > 0)
        {
            foreach (var position in response)
            {
                Console.WriteLine($"  - {position.ProtocolName}: {position.Position.Tokens.Count} tokens");
            }
        }
    }

    [Fact]
    public async Task Moralis_GetDeFiPositions_CheckLogoFields()
    {
        // Arrange
        var moralisService = _serviceProvider.GetRequiredService<IMoralisEVMService>();
        var chain = "base";

        Console.WriteLine($"🔍 Checking Logo Fields in Moralis API Response");
        Console.WriteLine($"📍 Wallet: {TEST_WALLET}");
        Console.WriteLine();

        // Act
        var response = await moralisService.GetDeFiPositionsAsync(TEST_WALLET, chain);

        // Assert
        Assert.NotNull(response);

        if (response.Count == 0)
        {
            Console.WriteLine("⚠️  No positions found");
            return;
        }

        Console.WriteLine($"📊 Analyzing {response.Count} positions...");
        Console.WriteLine();

        var allTokens = response.SelectMany(p => p.Position.Tokens).ToList();
        
        Console.WriteLine($"🪙  Total Tokens: {allTokens.Count}");
        Console.WriteLine();
        Console.WriteLine($"Logo Field Analysis:");
        Console.WriteLine($"  ✅ Tokens with Logo: {allTokens.Count(t => !string.IsNullOrEmpty(t.Logo))}");
        Console.WriteLine($"  ❌ Tokens without Logo: {allTokens.Count(t => string.IsNullOrEmpty(t.Logo))}");
        Console.WriteLine($"  ✅ Tokens with Thumbnail: {allTokens.Count(t => !string.IsNullOrEmpty(t.Thumbnail))}");
        Console.WriteLine($"  ❌ Tokens without Thumbnail: {allTokens.Count(t => string.IsNullOrEmpty(t.Thumbnail))}");
        Console.WriteLine();

        // Print tokens by logo availability
        var groupedByLogo = allTokens.GroupBy(t => !string.IsNullOrEmpty(t.Logo));
        
        foreach (var group in groupedByLogo)
        {
            var hasLogo = group.Key;
            Console.WriteLine($"{(hasLogo ? "✅" : "❌")} Tokens {(hasLogo ? "WITH" : "WITHOUT")} logo ({group.Count()}):");
            
            foreach (var token in group.Take(10)) // Show first 10
            {
                Console.WriteLine($"   • {token.Symbol} ({token.Name})");
                Console.WriteLine($"     Address: {token.ContractAddress}");
                Console.WriteLine($"     Value: ${token.UsdValue}");
                if (!hasLogo && !string.IsNullOrEmpty(token.Thumbnail))
                {
                    Console.WriteLine($"     Has Thumbnail: ✅ {token.Thumbnail}");
                }
                Console.WriteLine();
            }
            
            if (group.Count() > 10)
            {
                Console.WriteLine($"   ... and {group.Count() - 10} more");
            }
            Console.WriteLine();
        }
    }
}
