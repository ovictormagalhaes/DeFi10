using System.Text.Json;
using Xunit;
using Xunit.Abstractions;

namespace DeFi10.API.IntegrationTests;

/// <summary>
/// Test to fetch cbBTC metadata from Kamino API
/// </summary>
public class KaminoCbBtcMetadataTest
{
    private readonly ITestOutputHelper _output;
    private const string MainMarketPubkey = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
    private const string KaminoReserveAddress = "37Jk2zkz23vkAYBT66HM2gaqJuNg2nYLsCreQAVt5MWK";

    public KaminoCbBtcMetadataTest(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    public async Task GetKaminoReserves_ShouldShowCbBtcMintAddress()
    {
        // Arrange
        using var client = new HttpClient();
        var url = $"https://api.kamino.finance/kamino-market/{MainMarketPubkey}/reserves/metrics?env=mainnet-beta";

        // Act
        _output.WriteLine($"Fetching reserves from Kamino API:");
        _output.WriteLine(url);
        _output.WriteLine("");

        var response = await client.GetAsync(url);
        var content = await response.Content.ReadAsStringAsync();

        Assert.True(response.IsSuccessStatusCode, $"API returned {response.StatusCode}");

        // Show raw JSON sample
        var preview = content.Length > 2000 ? content.Substring(0, 2000) : content;
        _output.WriteLine("Raw JSON preview (first 2000 chars):");
        _output.WriteLine(preview);
        _output.WriteLine("");

        // Parse as dynamic to see structure
        using var doc = JsonDocument.Parse(content);
        var root = doc.RootElement;
        
        _output.WriteLine($"Root element type: {root.ValueKind}");
        
        if (root.ValueKind == JsonValueKind.Array)
        {
            _output.WriteLine($"✅ Total reserves: {root.GetArrayLength()}");
            
            // Search for cbBTC
            JsonElement? cbBtcElement = null;
            
            foreach (var element in root.EnumerateArray())
            {
                // Check if it has the reserve address we're looking for
                if (element.TryGetProperty("reserve", out var addrProp))
                {
                    var addr = addrProp.GetString();
                    if (addr?.Equals(KaminoReserveAddress, StringComparison.OrdinalIgnoreCase) == true)
                    {
                        cbBtcElement = element;
                        break;
                    }
                }
            }
            
            if (cbBtcElement.HasValue)
            {
                var cbBtc = cbBtcElement.Value;
                
                _output.WriteLine("✅ cbBTC FOUND in Kamino reserves!");
                _output.WriteLine("");
                _output.WriteLine("═══════════════════════════════════════════════════════");
                _output.WriteLine("               cbBTC TOKEN INFORMATION");
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
                var symbol = cbBtc.TryGetProperty("liquidityToken", out var symProp) ? symProp.GetString() : null;
                var mintAddress = cbBtc.TryGetProperty("liquidityTokenMint", out var mintProp) ? mintProp.GetString() : null;
                var logoUrl = cbBtc.TryGetProperty("tokenLogoUrl", out var logoProp) ? logoProp.GetString() : null;
                
                _output.WriteLine($"✅ Symbol: {symbol ?? "NULL"}");
                _output.WriteLine($"✅ Mint Address: {mintAddress ?? "NULL"}");
                _output.WriteLine($"✅ Logo URL: {logoUrl ?? "NULL"}");
                
                Assert.NotNull(mintAddress);
                Assert.NotEmpty(mintAddress);
            }
            else
            {
                _output.WriteLine("❌ cbBTC NOT FOUND in Kamino reserves");
                _output.WriteLine("");
                _output.WriteLine("First reserve structure:");
                if (root.GetArrayLength() > 0)
                {
                    var first = root[0];
                    foreach (var prop in first.EnumerateObject())
                    {
                        var value = prop.Value.ValueKind == JsonValueKind.String 
                            ? prop.Value.GetString() 
                            : prop.Value.ToString();
                        _output.WriteLine($"  {prop.Name}: {value}");
                    }
                }
                
                Assert.Fail("cbBTC not found in reserves");
            }
        }
        else
        {
            _output.WriteLine($"❌ Unexpected JSON structure: {root.ValueKind}");
            Assert.Fail($"Expected array but got {root.ValueKind}");
        }
    }

    [Fact]
    public async Task VerifyMoralisSolanaApiForCbBtc()
    {
        // Use the mint address we know from Kamino
        // This is just to show what Moralis needs
        
        _output.WriteLine("To fetch token info from Moralis Solana API, use:");
        _output.WriteLine("URL: https://solana-gateway.moralis.io/token/mainnet/{MINT_ADDRESS}/price");
        _output.WriteLine("");
        _output.WriteLine("Where {MINT_ADDRESS} should be the value from 'mintAddress' field in Kamino API");
        _output.WriteLine("");
        _output.WriteLine("The Moralis portfolio endpoint returns logo in the response:");
        _output.WriteLine("URL: https://solana-gateway.moralis.io/account/mainnet/{WALLET}/portfolio");
    }

    // DTO for parsing Kamino API response
    private class KaminoReserveInfo
    {
        public string? Address { get; set; }
        public string? Symbol { get; set; }
        public string? MintAddress { get; set; }
        public string? TokenLogoUrl { get; set; }
        public string? SupplyApy { get; set; }
        public string? BorrowApy { get; set; }
    }
}
