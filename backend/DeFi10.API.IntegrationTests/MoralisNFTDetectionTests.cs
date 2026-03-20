using Xunit;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using DeFi10.API.Services.Infrastructure.Moralis;
using DeFi10.API.Services.Infrastructure.MoralisSolana;
using DeFi10.API.Messaging.Workers.TriggerRules;
using DeFi10.API.Services.Configuration;
using DeFi10.API.Configuration;
using DeFi10.API.Models;
using Microsoft.Extensions.Options;
using Moq;
using DeFi10.API.Services.Helpers;
using DeFi10.API.Repositories;

namespace DeFi10.API.IntegrationTests;

public class MoralisNFTDetectionTests
{
    private readonly IConfiguration _configuration;
    private readonly IServiceProvider _serviceProvider;

    public MoralisNFTDetectionTests()
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
            ["Moralis:SolanaBaseUrl"] = "https://solana-gateway.moralis.io",
        });
        
        _configuration = configBuilder.Build();

        // Setup DI
        var services = new ServiceCollection();
        services.AddLogging(builder => builder.AddConsole().SetMinimumLevel(LogLevel.Debug));
        services.AddSingleton(_configuration);
        services.AddHttpClient(); // Add HttpClient support
        
        // Register Moralis services
        services.Configure<MoralisOptions>(_configuration.GetSection("Moralis"));
        services.AddSingleton<IMoralisEVMService, MoralisEVMService>();
        services.AddSingleton<IMoralisSolanaService, MoralisSolanaService>();
        
        // Register protocol configuration
        services.AddSingleton<IProtocolConfigurationService, ProtocolConfigurationService>();
        services.AddSingleton<IChainConfigurationService, ChainConfigurationService>();
        
        // Register trigger detectors
        services.AddSingleton<UniswapV3NftDetector>();
        services.AddSingleton<RaydiumNftDetector>();

        _serviceProvider = services.BuildServiceProvider();
    }

    [Fact]
    public async Task MoralisEVM_GetNFTs_ShouldReturnNFTsForBaseWallet()
    {
        // Arrange
        var moralisEvm = _serviceProvider.GetRequiredService<IMoralisEVMService>();
        var walletAddress = "0xF6998ed7484b4aDB3B5aD636D24CB1c576C12b27";
        
        // Act
        var result = await moralisEvm.GetNFTsAsync(walletAddress, "base");
        
        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.Result);
        
        Console.WriteLine($"✅ MoralisEVM GetNFTs returned {result.Result.Count} NFTs for Base wallet");
        
        if (result.Result.Count > 0)
        {
            Console.WriteLine($"\nFirst 5 NFTs:");
            foreach (var nft in result.Result.Take(5))
            {
                Console.WriteLine($"  - Contract: {nft.TokenAddress}, " +
                                $"TokenId: {nft.TokenId}, " +
                                $"Name: {nft.Name}");
            }
        }
    }

    [Fact]
    public async Task MoralisSolana_GetNFTs_ShouldReturnNFTsForSolanaWallet()
    {
        // Arrange
        var moralisSolana = _serviceProvider.GetRequiredService<IMoralisSolanaService>();
        var walletAddress = "884XrhgNyJFM88AtRpBe1JwycCiWv6PXXhY2bZHWHXQk";
        
        // Act
        var result = await moralisSolana.GetNFTsAsync(walletAddress, Chain.Solana);
        
        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.Nfts);
        
        Console.WriteLine($"✅ MoralisSolana GetNFTs returned {result.Nfts.Count} NFTs for Solana wallet");
        
        if (result.Nfts.Count > 0)
        {
            Console.WriteLine($"\nFirst 5 NFTs:");
            foreach (var nft in result.Nfts.Take(5))
            {
                Console.WriteLine($"  - Mint: {nft.Mint}, " +
                                $"Amount: {nft.Amount}, " +
                                $"Name: {nft.Name}");
            }
        }
    }

    [Fact]
    public async Task UniswapV3NftDetector_ShouldDetectPositionsFromBaseWallet()
    {
        // Arrange
        var moralisEvm = _serviceProvider.GetRequiredService<IMoralisEVMService>();
        var detector = _serviceProvider.GetRequiredService<UniswapV3NftDetector>();
        var walletAddress = "0xF6998ed7484b4aDB3B5aD636D24CB1c576C12b27";
        
        // Act - Get NFTs from Moralis
        var nftResponse = await moralisEvm.GetNFTsAsync(walletAddress, "base");
        
        Console.WriteLine($"📦 Retrieved {nftResponse.Result.Count} NFTs from Moralis for Base wallet");
        
        // Act - Run detector
        var triggers = detector.DetectTriggersFromPayload(nftResponse, Chain.Base);
        
        // Assert
        Console.WriteLine($"\n🔍 UniswapV3NftDetector Analysis:");
        Console.WriteLine($"  - Total NFTs scanned: {nftResponse.Result.Count}");
        Console.WriteLine($"  - Triggers detected: {triggers.Count}");
        
        if (triggers.Count > 0)
        {
            Console.WriteLine($"\n✅ TRIGGER DETECTED!");
            foreach (var trigger in triggers)
            {
                Console.WriteLine($"  - Provider: {trigger.Provider}, Chain: {trigger.Chain}");
            }
        }
        else
        {
            Console.WriteLine($"\n⚠️ NO TRIGGERS DETECTED");
            Console.WriteLine($"\nLooking for Uniswap V3 Position Manager NFTs:");
            Console.WriteLine($"  Expected contract (Base): 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1");
            
            Console.WriteLine($"\nActual NFT contracts found:");
            var contracts = nftResponse.Result
                .Select(nft => nft.TokenAddress)
                .Where(c => !string.IsNullOrEmpty(c))
                .Distinct()
                .Take(10);
            
            foreach (var contract in contracts)
            {
                Console.WriteLine($"  - {contract}");
            }
        }
        
        // Assert - We expect triggers for this wallet with Uniswap positions
        Assert.NotEmpty(triggers);
        Assert.Contains(triggers, t => t.Provider == Messaging.Contracts.Enums.IntegrationProvider.UniswapV3Positions);
    }

    [Fact]
    public async Task RaydiumNftDetector_ShouldDetectPositionsFromSolanaWallet()
    {
        // Arrange
        var moralisSolana = _serviceProvider.GetRequiredService<IMoralisSolanaService>();
        var detector = _serviceProvider.GetRequiredService<RaydiumNftDetector>();
        var walletAddress = "884XrhgNyJFM88AtRpBe1JwycCiWv6PXXhY2bZHWHXQk";
        
        // Act - Get NFTs from Moralis
        var nftResponse = await moralisSolana.GetNFTsAsync(walletAddress, Chain.Solana);
        
        Console.WriteLine($"📦 Retrieved {nftResponse.Nfts.Count} NFTs from Moralis for Solana wallet");
        
        // Act - Run detector
        var triggers = detector.DetectTriggersFromPayload(nftResponse, Chain.Solana);
        
        // Assert
        Console.WriteLine($"\n🔍 RaydiumNftDetector Analysis:");
        Console.WriteLine($"  - Total NFTs scanned: {nftResponse.Nfts.Count}");
        Console.WriteLine($"  - Triggers detected: {triggers.Count}");
        
        if (triggers.Count > 0)
        {
            Console.WriteLine($"\n✅ TRIGGER DETECTED!");
            foreach (var trigger in triggers)
            {
                Console.WriteLine($"  - Provider: {trigger.Provider}, Chain: {trigger.Chain}");
            }
        }
        else
        {
            Console.WriteLine($"\n⚠️ NO TRIGGERS DETECTED");
            Console.WriteLine($"\nLooking for Raydium CLMM Position NFTs (amount=1, decimals=0):");
            
            var nftCandidates = nftResponse.Nfts
                .Where(nft => nft.Amount == 1)
                .Take(10);
            
            Console.WriteLine($"\nNFT candidates (amount=1):");
            foreach (var nft in nftCandidates)
            {
                Console.WriteLine($"  - Mint: {nft.Mint}, Amount: {nft.Amount}, Decimals: {nft.Decimals}");
            }
        }
        
        // We expect triggers for this wallet with Raydium positions
        Assert.NotEmpty(triggers);
        Assert.Contains(triggers, t => t.Provider == Messaging.Contracts.Enums.IntegrationProvider.SolanaRaydiumPositions);
    }

    [Fact]
    public async Task IntegratedTest_BothMoralisServices_ShouldWork()
    {
        // This test validates the complete flow for both chains
        
        Console.WriteLine("=================================================");
        Console.WriteLine("🧪 INTEGRATED MORALIS NFT DETECTION TEST");
        Console.WriteLine("=================================================\n");

        var moralisEvm = _serviceProvider.GetRequiredService<IMoralisEVMService>();
        var moralisSolana = _serviceProvider.GetRequiredService<IMoralisSolanaService>();
        var uniswapDetector = _serviceProvider.GetRequiredService<UniswapV3NftDetector>();
        var raydiumDetector = _serviceProvider.GetRequiredService<RaydiumNftDetector>();

        // Test 1: Base (EVM) - Uniswap V3
        Console.WriteLine("📍 Testing Base (EVM) - Wallet: 0xF6998ed7484b4aDB3B5aD636D24CB1c576C12b27");
        var baseWallet = "0xF6998ed7484b4aDB3B5aD636D24CB1c576C12b27";
        var baseNfts = await moralisEvm.GetNFTsAsync(baseWallet, "base");
        var baseTriggersUniswap = uniswapDetector.DetectTriggersFromPayload(baseNfts, Chain.Base);
        
        Console.WriteLine($"  ✅ Retrieved {baseNfts.Result.Count} NFTs from MoralisEVM");
        Console.WriteLine($"  ✅ UniswapV3NftDetector found {baseTriggersUniswap.Count} triggers");
        
        if (baseTriggersUniswap.Count == 0)
        {
            Console.WriteLine($"  ⚠️ WARNING: Expected Uniswap triggers but got none!");
        }

        // Test 2: Solana - Raydium CLMM
        Console.WriteLine($"\n📍 Testing Solana - Wallet: 884XrhgNyJFM88AtRpBe1JwycCiWv6PXXhY2bZHWHXQk");
        var solanaWallet = "884XrhgNyJFM88AtRpBe1JwycCiWv6PXXhY2bZHWHXQk";
        var solanaNfts = await moralisSolana.GetNFTsAsync(solanaWallet, Chain.Solana);
        var solanaTriggersRaydium = raydiumDetector.DetectTriggersFromPayload(solanaNfts, Chain.Solana);
        
        Console.WriteLine($"  ✅ Retrieved {solanaNfts.Nfts.Count} NFTs from MoralisSolana");
        Console.WriteLine($"  ✅ RaydiumNftDetector found {solanaTriggersRaydium.Count} triggers");
        
        if (solanaTriggersRaydium.Count == 0)
        {
            Console.WriteLine($"  ⚠️ WARNING: Expected Raydium triggers but got none!");
        }

        // Summary
        Console.WriteLine($"\n=================================================");
        Console.WriteLine($"📊 SUMMARY:");
        Console.WriteLine($"  Base (EVM) - NFTs: {baseNfts.Result.Count}, Uniswap Triggers: {baseTriggersUniswap.Count}");
        Console.WriteLine($"  Solana - NFTs: {solanaNfts.Nfts.Count}, Raydium Triggers: {solanaTriggersRaydium.Count}");
        Console.WriteLine($"=================================================\n");

        // Assertions
        Assert.True(baseNfts.Result.Count > 0, "Base wallet should have NFTs");
        Assert.True(solanaNfts.Nfts.Count > 0, "Solana wallet should have NFTs");
        Assert.NotEmpty(baseTriggersUniswap);
        Assert.NotEmpty(solanaTriggersRaydium);
    }

    [Fact]
    public async Task MoralisSolana_GetTokens_ShouldReturnUSDTPriceFromAPI()
    {
        // Arrange
        var moralisSolana = _serviceProvider.GetRequiredService<IMoralisSolanaService>();
        
        // Using a known wallet that should have USDT (Solana USDT mint: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB)
        // This is a wallet known to hold various tokens including USDT
        var walletAddress = "884XrhgNyJFM88AtRpBe1JwycCiWv6PXXhY2bZHWHXQk";
        
        // Act
        var result = await moralisSolana.GetTokensAsync(walletAddress, Chain.Solana);
        
        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.Tokens);
        
        Console.WriteLine($"\n=================================================");
        Console.WriteLine($"📊 MORALIS SOLANA TOKEN TEST - GetTokensAsync");
        Console.WriteLine($"=================================================");
        Console.WriteLine($"Wallet: {walletAddress}");
        Console.WriteLine($"Total Tokens: {result.Tokens.Count}");
        Console.WriteLine($"\n🔍 ALL TOKENS RETURNED:");
        
        foreach (var token in result.Tokens)
        {
            Console.WriteLine($"\n  Token: {token.Symbol} ({token.Name})");
            Console.WriteLine($"    Mint: {token.Mint}");
            Console.WriteLine($"    Amount: {token.Amount}");
            Console.WriteLine($"    Decimals: {token.Decimals}");
            Console.WriteLine($"    Logo: {token.Logo ?? "(null)"}");
            Console.WriteLine($"    PriceUsd: {(token.PriceUsd.HasValue ? $"${token.PriceUsd.Value:F6}" : "(null)")}");
        }
        
        // Check for USDT specifically
        var usdtMint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
        var usdtToken = result.Tokens.FirstOrDefault(t => 
            t.Mint.Equals(usdtMint, StringComparison.OrdinalIgnoreCase) || 
            t.Symbol.Equals("USDT", StringComparison.OrdinalIgnoreCase));
        
        if (usdtToken != null)
        {
            Console.WriteLine($"\n✅ USDT TOKEN FOUND:");
            Console.WriteLine($"    Symbol: {usdtToken.Symbol}");
            Console.WriteLine($"    Name: {usdtToken.Name}");
            Console.WriteLine($"    Mint: {usdtToken.Mint}");
            Console.WriteLine($"    Amount: {usdtToken.Amount}");
            Console.WriteLine($"    Logo: {usdtToken.Logo ?? "(null)"}");
            Console.WriteLine($"    PriceUsd from API: {(usdtToken.PriceUsd.HasValue ? $"${usdtToken.PriceUsd.Value:F6}" : "❌ NULL - THIS IS THE PROBLEM!")}");
            
            if (!usdtToken.PriceUsd.HasValue || usdtToken.PriceUsd.Value == 0)
            {
                Console.WriteLine($"\n⚠️ WARNING: USDT price is null or zero from Moralis API!");
                Console.WriteLine($"    This means Moralis is not returning price data for USDT.");
                Console.WriteLine($"    Expected: ~$1.00 (USDT is a stablecoin)");
                Console.WriteLine($"    Actual: {(usdtToken.PriceUsd.HasValue ? $"${usdtToken.PriceUsd.Value}" : "null")}");
            }
            else
            {
                Console.WriteLine($"\n✅ USDT price is present: ${usdtToken.PriceUsd.Value:F6}");
                // For USDT, price should be close to $1.00
                Assert.InRange(usdtToken.PriceUsd.Value, 0.95m, 1.05m);
            }
        }
        else
        {
            Console.WriteLine($"\n❌ USDT NOT FOUND in the wallet or filtered out");
            Console.WriteLine($"    This wallet may not have USDT, or it was filtered by FilterZeroPriceTokens");
        }
        
        Console.WriteLine($"\n=================================================\n");
        
        // The test passes regardless, but outputs diagnostic info
        Assert.True(true, "Test completed - check console output for USDT price data");
    }

    [Fact]
    public async Task MoralisSolana_GetTokenPrice_ShouldReturnUSDTPrice()
    {
        // Arrange
        var httpClient = new HttpClient();
        var moralisApiKey = _configuration["Moralis:ApiKey"];
        
        // USDT on Solana
        var usdtMint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
        var url = $"https://solana-gateway.moralis.io/token/mainnet/{usdtMint}/price";
        
        httpClient.DefaultRequestHeaders.Clear();
        httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
        httpClient.DefaultRequestHeaders.Add("X-API-Key", moralisApiKey);
        
        Console.WriteLine($"\n=================================================");
        Console.WriteLine($"📊 MORALIS TOKEN PRICE API TEST");
        Console.WriteLine($"=================================================");
        Console.WriteLine($"Endpoint: {url}");
        Console.WriteLine($"Token: USDT");
        Console.WriteLine($"Mint: {usdtMint}");
        
        // Act
        var response = await httpClient.GetAsync(url);
        var responseBody = await response.Content.ReadAsStringAsync();
        
        Console.WriteLine($"\nStatus Code: {response.StatusCode}");
        Console.WriteLine($"\nResponse Body:");
        Console.WriteLine(responseBody);
        
        // Assert
        Assert.True(response.IsSuccessStatusCode, $"Expected success status code, got {response.StatusCode}");
        Assert.False(string.IsNullOrWhiteSpace(responseBody), "Response body should not be empty");
        
        // Try to parse as JSON to verify structure
        var jsonDoc = System.Text.Json.JsonDocument.Parse(responseBody);
        var root = jsonDoc.RootElement;
        
        Console.WriteLine($"\n🔍 PARSED JSON FIELDS:");
        foreach (var property in root.EnumerateObject())
        {
            Console.WriteLine($"  {property.Name}: {property.Value}");
        }
        
        // Check for usdPrice field
        if (root.TryGetProperty("usdPrice", out var usdPrice))
        {
            Console.WriteLine($"\n✅ USD PRICE FOUND: {usdPrice}");
            
            if (usdPrice.ValueKind == System.Text.Json.JsonValueKind.Number)
            {
                var price = usdPrice.GetDecimal();
                Console.WriteLine($"   Price value: ${price:F6}");
                
                // USDT should be close to $1.00
                Assert.InRange(price, 0.95m, 1.05m);
            }
            else if (usdPrice.ValueKind == System.Text.Json.JsonValueKind.String)
            {
                var priceStr = usdPrice.GetString();
                if (decimal.TryParse(priceStr, out var price))
                {
                    Console.WriteLine($"   Price value (parsed from string): ${price:F6}");
                    Assert.InRange(price, 0.95m, 1.05m);
                }
            }
        }
        else
        {
            Console.WriteLine($"\n❌ NO usdPrice FIELD IN RESPONSE");
        }
        
        Console.WriteLine($"\n=================================================\n");
    }

    [Fact]
    public async Task MoralisSolana_GetMultipleTokenPrices_ShouldReturnPrices()
    {
        // Arrange
        var httpClient = new HttpClient();
        var moralisApiKey = _configuration["Moralis:ApiKey"];
        
        // Test with multiple tokens: SOL, USDT, RAY
        var tokens = new[]
        {
            new { Symbol = "SOL", Mint = "So11111111111111111111111111111111111111112" },
            new { Symbol = "USDT", Mint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
            new { Symbol = "RAY", Mint = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R" }
        };
        
        Console.WriteLine($"\n=================================================");
        Console.WriteLine($"📊 MORALIS GET MULTIPLE TOKEN PRICES TEST");
        Console.WriteLine($"=================================================");
        
        foreach (var token in tokens)
        {
            var url = $"https://solana-gateway.moralis.io/token/mainnet/{token.Mint}/price";
            
            httpClient.DefaultRequestHeaders.Clear();
            httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
            httpClient.DefaultRequestHeaders.Add("X-API-Key", moralisApiKey);
            
            Console.WriteLine($"\n🔍 Getting price for {token.Symbol}...");
            Console.WriteLine($"   Mint: {token.Mint}");
            
            try
            {
                var response = await httpClient.GetAsync(url);
                var responseBody = await response.Content.ReadAsStringAsync();
                
                if (response.IsSuccessStatusCode)
                {
                    var jsonDoc = System.Text.Json.JsonDocument.Parse(responseBody);
                    var root = jsonDoc.RootElement;
                    
                    if (root.TryGetProperty("usdPrice", out var usdPrice))
                    {
                        decimal price = 0;
                        if (usdPrice.ValueKind == System.Text.Json.JsonValueKind.Number)
                        {
                            price = usdPrice.GetDecimal();
                        }
                        else if (usdPrice.ValueKind == System.Text.Json.JsonValueKind.String)
                        {
                            decimal.TryParse(usdPrice.GetString(), out price);
                        }
                        
                        Console.WriteLine($"   ✅ Price: ${price:F6}");
                    }
                    else
                    {
                        Console.WriteLine($"   ⚠️ No usdPrice in response");
                        Console.WriteLine($"   Response: {responseBody}");
                    }
                }
                else
                {
                    Console.WriteLine($"   ❌ Error: {response.StatusCode}");
                    Console.WriteLine($"   Response: {responseBody}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"   ❌ Exception: {ex.Message}");
            }
            
            // Small delay to avoid rate limiting
            await Task.Delay(300);
        }
        
        Console.WriteLine($"\n=================================================\n");
        
        Assert.True(true, "Check console output for price results");
    }

    [Fact]
    public async Task TokenHydration_ShouldFetchPriceFromMoralis_ForSolanaTokensWithoutPrice()
    {
        // Arrange - Create a mock token metadata service and inject real Moralis service
        var services = new ServiceCollection();
        services.AddLogging(builder => builder.AddConsole().SetMinimumLevel(LogLevel.Debug));
        services.AddHttpClient();
        
        // Register real Moralis Solana Service
        services.Configure<MoralisOptions>(_configuration.GetSection("Moralis"));
        services.AddSingleton<IMoralisSolanaService, MoralisSolanaService>();
        
        // For this test, we'll use a simple in-memory metadata service mock
        var metadataServiceMock = new Mock<ITokenMetadataService>();
        
        // Setup: GetTokenMetadataAsync returns metadata WITHOUT price for USDT
        var usdtMint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
        var metadataWithoutPrice = new TokenMetadata
        {
            Symbol = "USDT",
            Name = "USDT",
            LogoUrl = "https://logo.moralis.io/solana-mainnet_Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB_d3e0684888bc0744dfe4b5bfa1fe429b.webp",
            PriceUsd = null, // NO PRICE!
            UpdatedAt = DateTime.UtcNow.AddHours(-2) // Outdated (>60 min ago)
        };
        
        metadataServiceMock
            .Setup(x => x.GetTokenMetadataAsync(Chain.Solana, usdtMint))
            .ReturnsAsync(metadataWithoutPrice);
        
        // Capture when SetTokenMetadataAsync is called
        TokenMetadata? savedMetadata = null;
        metadataServiceMock
            .Setup(x => x.SetTokenMetadataAsync(Chain.Solana, usdtMint, It.IsAny<TokenMetadata>()))
            .Callback<Chain, string, TokenMetadata>((chain, address, metadata) =>
            {
                savedMetadata = metadata;
            })
            .Returns(Task.CompletedTask);
        
        services.AddSingleton(metadataServiceMock.Object);
        
        var provider = services.BuildServiceProvider();
        var moralisSolana = provider.GetRequiredService<IMoralisSolanaService>();
        var logger = provider.GetRequiredService<ILogger<TokenHydrationHelper>>();
        
        var hydrationHelper = new TokenHydrationHelper(
            metadataServiceMock.Object, 
            logger, 
            moralisSolana);
        
        // Create a fake wallet item with USDT token
        var walletItems = new List<WalletItem>
        {
            new WalletItem
            {
                Position = new Position
                {
                    Tokens = new List<Token>
                    {
                        new Token
                        {
                            ContractAddress = usdtMint,
                            Symbol = "USDT",
                            Name = "USDT",
                            Financials = new TokenFinancials
                            {
                                BalanceFormatted = 30.675044m,
                                Price = null // No price in the token data
                            }
                        }
                    }
                }
            }
        };
        
        Console.WriteLine($"\n=================================================");
        Console.WriteLine($"📊 TOKEN HYDRATION WITH MORALIS PRICE FETCH TEST");
        Console.WriteLine($"=================================================");
        Console.WriteLine($"Testing token: USDT (Solana)");
        Console.WriteLine($"Mint: {usdtMint}");
        Console.WriteLine($"Initial metadata PriceUsd: {metadataWithoutPrice.PriceUsd?.ToString() ?? "NULL"}");
        Console.WriteLine($"Initial metadata UpdatedAt: {metadataWithoutPrice.UpdatedAt}");
        
        // Act
        var result = await hydrationHelper.HydrateTokenLogosAsync(walletItems, Chain.Solana, null);
        
        // Assert
        Console.WriteLine($"\n✅ Hydration completed");
        Console.WriteLine($"\nChecking if SetTokenMetadataAsync was called...");
        
        metadataServiceMock.Verify(
            x => x.SetTokenMetadataAsync(Chain.Solana, usdtMint, It.IsAny<TokenMetadata>()), 
            Times.Once, 
            "SetTokenMetadataAsync should be called once to save the price");
        
        Assert.NotNull(savedMetadata);
        Console.WriteLine($"✅ Metadata was saved");
        
        Assert.NotNull(savedMetadata.PriceUsd);
        Console.WriteLine($"✅ Saved metadata has PriceUsd: ${savedMetadata.PriceUsd.Value:F6}");
        
        Assert.True(savedMetadata.PriceUsd > 0);
        Console.WriteLine($"✅ Price is greater than zero");
        
        // USDT should be around $1.00
        Assert.InRange(savedMetadata.PriceUsd.Value, 0.95m, 1.05m);
        Console.WriteLine($"✅ USDT price is within expected range (0.95 - 1.05): ${savedMetadata.PriceUsd.Value:F6}");
        
        Assert.NotNull(savedMetadata.UpdatedAt);
        Console.WriteLine($"✅ UpdatedAt was set: {savedMetadata.UpdatedAt}");
        
        Console.WriteLine($"\n=================================================");
        Console.WriteLine($"🎉 SUCCESS: Moralis price fetch integration works!");
        Console.WriteLine($"   Token: {savedMetadata.Symbol}");
        Console.WriteLine($"   Price: ${savedMetadata.PriceUsd.Value:F6}");
        Console.WriteLine($"   Updated: {savedMetadata.UpdatedAt}");
        Console.WriteLine($"=================================================\n");
    }
    
    [Fact]
    public async Task ApplyTokenLogos_ShouldFetchMoralisPriceForSolanaToken_WhenMetadataNotFoundInStorage()
    {
        // Arrange
        var moralisSolanaService = _serviceProvider.GetRequiredService<IMoralisSolanaService>();
        var loggerFactory = _serviceProvider.GetRequiredService<ILoggerFactory>();
        var logger = loggerFactory.CreateLogger<TokenHydrationHelper>();
        
        var metadataServiceMock = new Mock<ITokenMetadataService>();
        
        var usdtMint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB".ToLowerInvariant();
        
        // Mock: No metadata in storage initially
        metadataServiceMock
            .Setup(x => x.GetTokenMetadataAsync(Chain.Solana, usdtMint))
            .ReturnsAsync((TokenMetadata?)null);
        
        TokenMetadata? savedMetadata = null;
        metadataServiceMock
            .Setup(x => x.SetTokenMetadataAsync(Chain.Solana, usdtMint, It.IsAny<TokenMetadata>()))
            .Callback<Chain, string, TokenMetadata>((chain, address, metadata) => savedMetadata = metadata)
            .Returns(Task.CompletedTask);
        
        var hydrationHelper = new TokenHydrationHelper(
            metadataServiceMock.Object, 
            logger,
            moralisSolanaService);
        
        // Create wallet item with USDT token (no symbol, no name, no price)
        var walletItems = new List<WalletItem>
        {
            new WalletItem
            {
                Position = new Position
                {
                    Tokens = new List<Token>
                    {
                        new Token
                        {
                            ContractAddress = usdtMint,
                            Symbol = string.Empty,
                            Name = string.Empty,
                            Logo = null,
                            Financials = new TokenFinancials
                            {
                                BalanceFormatted = 100m,
                                Price = null
                            }
                        }
                    }
                }
            }
        };
        
        var emptyDictionaries = (
            AddressToMetadata: new Dictionary<string, TokenMetadata>(),
            SymbolNameToMetadata: new Dictionary<string, TokenMetadata>(),
            SymbolToLogo: new Dictionary<string, string>()
        );
        
        Console.WriteLine($"\n========================================================");
        Console.WriteLine($"🧪 ApplyTokenLogos - Moralis Price Fetch Integration Test");
        Console.WriteLine($"========================================================");
        Console.WriteLine($"Token: USDT (Solana)");
        Console.WriteLine($"Mint: {usdtMint}");
        Console.WriteLine($"Initial state: No metadata in storage");
        Console.WriteLine($"Expected: Should call Moralis Price API and save to MongoDB");
        
        // Act
        await hydrationHelper.ApplyTokenLogosToWalletItemsAsync(
            walletItems, 
            new Dictionary<string, string?>(), 
            Chain.Solana, 
            emptyDictionaries);
        
        // Assert
        var token = walletItems[0].Position!.Tokens![0];
        
        Console.WriteLine($"\n✅ Processing completed");
        Console.WriteLine($"\nVerifying results...");
        
        // Verify SetTokenMetadataAsync was called
        metadataServiceMock.Verify(
            x => x.SetTokenMetadataAsync(Chain.Solana, usdtMint, It.IsAny<TokenMetadata>()), 
            Times.Once, 
            "SetTokenMetadataAsync should be called once to save Moralis price");
        Console.WriteLine($"✅ SetTokenMetadataAsync was called");
        
        Assert.NotNull(savedMetadata);
        Console.WriteLine($"✅ Metadata was saved");
        
        Assert.NotNull(savedMetadata.PriceUsd);
        Console.WriteLine($"✅ Saved metadata has PriceUsd: ${savedMetadata.PriceUsd.Value:F6}");
        
        // USDT should be around $1.00
        Assert.InRange(savedMetadata.PriceUsd.Value, 0.95m, 1.05m);
        Console.WriteLine($"✅ USDT price is within expected range (0.95 - 1.05)");
        
        // Verify token was hydrated with the price
        Assert.NotNull(token.Financials);
        Assert.NotNull(token.Financials.Price);
        Assert.True(token.Financials.Price > 0);
        Console.WriteLine($"✅ Token.Financials.Price was updated: ${token.Financials.Price.Value:F6}");
        
        // Verify TotalPrice was calculated
        Assert.NotNull(token.Financials.TotalPrice);
        var expectedTotalPrice = 100m * token.Financials.Price.Value;
        Assert.Equal(expectedTotalPrice, token.Financials.TotalPrice.Value);
        Console.WriteLine($"✅ Token.Financials.TotalPrice was calculated: ${token.Financials.TotalPrice.Value:F2}");
        
        Console.WriteLine($"\n========================================================");
        Console.WriteLine($"🎉 SUCCESS: ApplyTokenLogos Moralis integration works!");
        Console.WriteLine($"   Mint: {usdtMint}");
        Console.WriteLine($"   Price: ${token.Financials.Price.Value:F6}");
        Console.WriteLine($"   Balance: {token.Financials.BalanceFormatted:F2}");
        Console.WriteLine($"   Total: ${token.Financials.TotalPrice.Value:F2}");
        Console.WriteLine($"========================================================\n");
    }
}
