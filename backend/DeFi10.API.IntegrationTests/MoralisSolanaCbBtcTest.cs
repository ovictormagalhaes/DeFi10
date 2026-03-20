using System.Text.Json;
using Xunit;
using Xunit.Abstractions;
using Microsoft.Extensions.Configuration;

namespace DeFi10.API.IntegrationTests;

/// <summary>
/// Test to verify if Moralis Solana API returns logo for cbBTC token
/// </summary>
public class MoralisSolanaCbBtcTest
{
    private readonly ITestOutputHelper _output;
    private readonly string? _moralisApiKey;
    
    // Correct cbBTC mint address from Kamino API
    private const string CBBTC_MINT = "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij";
    
    // Test wallet that has cbBTC
    private const string TEST_WALLET = "884XrhgNyJFM88AtRpBe1JwycCiWv6PXXhY2bZHWHXQk";

    public MoralisSolanaCbBtcTest(ITestOutputHelper output)
    {
        _output = output;
        
        // Load .env file manually
        LoadDotEnv();
        
        _output.WriteLine($"Current Directory: {Directory.GetCurrentDirectory()}");
        
        // Try to load from environment variables first (from .env or system)
        _moralisApiKey = Environment.GetEnvironmentVariable("Moralis__ApiKey");
        
        // If not found, try from appsettings.json
        if (string.IsNullOrEmpty(_moralisApiKey) || _moralisApiKey.StartsWith("${"))
        {
            var config = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: true)
                .AddEnvironmentVariables()
                .Build();
            
            _moralisApiKey = config["Moralis:ApiKey"];
        }
        
        _output.WriteLine($"API Key loaded: {(!string.IsNullOrEmpty(_moralisApiKey) && !_moralisApiKey.StartsWith("${") ? "Yes" : "No")}");
    }

    private static void LoadDotEnv()
    {
        // Look for .env file - start from current directory and go up
        var currentDir = Directory.GetCurrentDirectory();
        string? envPath = null;
        
        // Try current directory and up to 6 parent directories (to reach backend folder from bin/Debug/net9.0)
        for (int i = 0; i < 7; i++)
        {
            var testPath = Path.Combine(currentDir, ".env");
            if (File.Exists(testPath))
            {
                envPath = testPath;
                break;
            }
            
            var parentDir = Directory.GetParent(currentDir);
            if (parentDir == null) break;
            currentDir = parentDir.FullName;
        }
        
        if (envPath == null)
        {
            // Last resort: try hardcoded path relative to solution
            var solutionDir = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "..", "..", "backend");
            var hardcodedPath = Path.Combine(solutionDir, ".env");
            if (File.Exists(hardcodedPath))
            {
                envPath = hardcodedPath;
            }
        }
        
        if (envPath == null) return;
        
        foreach (var line in File.ReadAllLines(envPath))
        {
            if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#")) continue;
            
            var parts = line.Split('=', 2);
            if (parts.Length == 2)
            {
                var key = parts[0].Trim();
                var value = parts[1].Trim();
                Environment.SetEnvironmentVariable(key, value);
            }
        }
    }

    [Fact]
    public async Task MoralisSolana_ShouldReturnLogoForCbBtc()
    {
        // Skip test if no API key
        if (string.IsNullOrEmpty(_moralisApiKey) || _moralisApiKey.StartsWith("${"))
        {
            _output.WriteLine("⚠️  Moralis API key not configured, skipping test");
            return;
        }

        // Arrange
        using var client = new HttpClient();
        var url = $"https://solana-gateway.moralis.io/account/mainnet/{TEST_WALLET}/portfolio?nftMetadata=false&mediaItems=false";
        
        client.DefaultRequestHeaders.Add("Accept", "application/json");
        client.DefaultRequestHeaders.Add("X-API-Key", _moralisApiKey);

        // Act
        _output.WriteLine($"Fetching Solana portfolio from Moralis API:");
        _output.WriteLine(url);
        _output.WriteLine("");

        var response = await client.GetAsync(url);
        
        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            _output.WriteLine($"❌ API returned {response.StatusCode}");
            _output.WriteLine($"Error: {errorContent}");
            Assert.Fail($"Moralis API error: {response.StatusCode}");
            return;
        }

        var content = await response.Content.ReadAsStringAsync();
        
        // Parse response
        using var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;

        // Get tokens array
        if (!root.TryGetProperty("tokens", out var tokensArray))
        {
            _output.WriteLine("❌ No 'tokens' property in response");
            _output.WriteLine($"Response: {content.Substring(0, Math.Min(500, content.Length))}");
            Assert.Fail("No tokens array in response");
            return;
        }

        _output.WriteLine($"✅ Total tokens in portfolio: {tokensArray.GetArrayLength()}");
        _output.WriteLine("");

        // Search for cbBTC
        JsonElement? cbBtcElement = null;
        
        foreach (var token in tokensArray.EnumerateArray())
        {
            if (token.TryGetProperty("mint", out var mintProp))
            {
                var mint = mintProp.GetString();
                if (mint?.Equals(CBBTC_MINT, StringComparison.OrdinalIgnoreCase) == true)
                {
                    cbBtcElement = token;
                    break;
                }
            }
        }

        if (cbBtcElement.HasValue)
        {
            var cbBtc = cbBtcElement.Value;
            
            _output.WriteLine("✅ cbBTC FOUND in Moralis Solana portfolio!");
            _output.WriteLine("");
            _output.WriteLine("═══════════════════════════════════════════════════════");
            _output.WriteLine("          cbBTC TOKEN FROM MORALIS SOLANA API");
            _output.WriteLine("═══════════════════════════════════════════════════════");
            
            // Print all properties
            foreach (var prop in cbBtc.EnumerateObject())
            {
                var value = prop.Value.ValueKind == JsonValueKind.String 
                    ? prop.Value.GetString() 
                    : prop.Value.ToString();
                _output.WriteLine($"{prop.Name,-20}: {value}");
            }
            
            _output.WriteLine("═══════════════════════════════════════════════════════");
            _output.WriteLine("");
            
            // Extract key fields
            var symbol = cbBtc.TryGetProperty("symbol", out var symProp) ? symProp.GetString() : null;
            var name = cbBtc.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
            var mint = cbBtc.TryGetProperty("mint", out var mintProp2) ? mintProp2.GetString() : null;
            var logo = cbBtc.TryGetProperty("logo", out var logoProp) ? logoProp.GetString() : null;
            var amount = cbBtc.TryGetProperty("amount", out var amountProp) ? amountProp.GetString() : null;
            var usdPrice = cbBtc.TryGetProperty("usdPrice", out var priceProp) ? priceProp.GetDouble() : (double?)null;
            
            _output.WriteLine("KEY INFORMATION:");
            _output.WriteLine($"  Symbol:     {symbol ?? "NULL"}");
            _output.WriteLine($"  Name:       {name ?? "NULL"}");
            _output.WriteLine($"  Mint:       {mint ?? "NULL"}");
            _output.WriteLine($"  Amount:     {amount ?? "NULL"}");
            _output.WriteLine($"  Price USD:  ${usdPrice?.ToString("F2") ?? "NULL"}");
            _output.WriteLine($"  Logo URL:   {logo ?? "NULL"}");
            _output.WriteLine("");
            
            // Verify logo
            if (!string.IsNullOrEmpty(logo))
            {
                _output.WriteLine($"✅ SUCCESS: Logo URL is present!");
                _output.WriteLine($"   {logo}");
                _output.WriteLine("");
                
                // Try to verify logo is accessible
                try
                {
                    using var logoClient = new HttpClient();
                    logoClient.Timeout = TimeSpan.FromSeconds(5);
                    var logoResponse = await logoClient.GetAsync(logo);
                    
                    if (logoResponse.IsSuccessStatusCode)
                    {
                        _output.WriteLine($"✅ Logo URL is accessible (HTTP {logoResponse.StatusCode})");
                        _output.WriteLine($"   Content-Type: {logoResponse.Content.Headers.ContentType}");
                    }
                    else
                    {
                        _output.WriteLine($"⚠️  Logo URL returned HTTP {logoResponse.StatusCode}");
                    }
                }
                catch (Exception ex)
                {
                    _output.WriteLine($"⚠️  Could not verify logo accessibility: {ex.Message}");
                }
            }
            else
            {
                _output.WriteLine("❌ Logo URL is NULL or empty in Moralis response");
                Assert.Fail("Moralis did not return logo for cbBTC");
            }
        }
        else
        {
            _output.WriteLine("❌ cbBTC NOT FOUND in Moralis portfolio");
            _output.WriteLine("");
            _output.WriteLine("Available tokens (first 5):");
            var count = 0;
            foreach (var token in tokensArray.EnumerateArray())
            {
                if (count++ >= 5) break;
                
                var symbol = token.TryGetProperty("symbol", out var symProp) ? symProp.GetString() : "?";
                var mint = token.TryGetProperty("mint", out var mintProp2) ? mintProp2.GetString() : "?";
                var logo = token.TryGetProperty("logo", out var logoProp) ? (logoProp.GetString() ?? "NULL") : "NULL";
                
                _output.WriteLine($"  - {symbol} (Mint: {mint}, Logo: {logo})");
            }
            
            Assert.Fail("cbBTC not found in Moralis portfolio");
        }
    }

    [Fact]
    public async Task MoralisSolana_GetTokenPrice_ForCbBtc()
    {
        // Skip test if no API key
        if (string.IsNullOrEmpty(_moralisApiKey) || _moralisApiKey.StartsWith("${"))
        {
            _output.WriteLine("⚠️  Moralis API key not configured, skipping test");
            return;
        }

        // Arrange
        using var client = new HttpClient();
        var url = $"https://solana-gateway.moralis.io/token/mainnet/{CBBTC_MINT}/price";
        
        client.DefaultRequestHeaders.Add("Accept", "application/json");
        client.DefaultRequestHeaders.Add("X-API-Key", _moralisApiKey);

        // Act
        _output.WriteLine($"Fetching cbBTC price from Moralis API:");
        _output.WriteLine(url);
        _output.WriteLine("");

        var response = await client.GetAsync(url);
        var content = await response.Content.ReadAsStringAsync();
        
        _output.WriteLine($"Response Status: {response.StatusCode}");
        _output.WriteLine($"Response: {content}");
        _output.WriteLine("");

        if (response.IsSuccessStatusCode)
        {
            using var doc = JsonDocument.Parse(content);
            var root = doc.RootElement;
            
            if (root.TryGetProperty("usdPrice", out var priceProp))
            {
                var price = priceProp.GetDouble();
                _output.WriteLine($"✅ Price found: ${price:F2}");
            }
            else
            {
                _output.WriteLine("⚠️  No 'usdPrice' in response");
            }
        }
        else
        {
            _output.WriteLine($"❌ API returned error: {response.StatusCode}");
        }
    }
}
