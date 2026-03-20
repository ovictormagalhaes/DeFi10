using DeFi10.API.Services.Protocols.Kamino.Models;
using System.Text.Json;
using Xunit;
using Xunit.Abstractions;

namespace DeFi10.API.IntegrationTests;

/// <summary>
/// Integration tests for Kamino reserves API to ensure we can dynamically fetch reserve metadata
/// </summary>
public class KaminoReservesApiTests
{
    private readonly ITestOutputHelper _output;
    private const string KaminoApiUrl = "https://api.kamino.finance";
    private const string MainMarketPubkey = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";

    public KaminoReservesApiTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    public async Task GetReservesMetrics_ShouldReturnValidData()
    {
        // Arrange
        using var httpClient = new HttpClient();
        httpClient.BaseAddress = new Uri(KaminoApiUrl);
        httpClient.Timeout = TimeSpan.FromSeconds(30);

        var endpoint = $"kamino-market/{MainMarketPubkey}/reserves/metrics?env=mainnet-beta";

        // Act
        var response = await httpClient.GetAsync(endpoint);

        // Assert
        Assert.True(response.IsSuccessStatusCode, $"API returned {response.StatusCode}");

        var content = await response.Content.ReadAsStringAsync();
        Assert.NotEmpty(content);

        var reserves = JsonSerializer.Deserialize<List<KaminoReserveDto>>(content, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        Assert.NotNull(reserves);
        Assert.NotEmpty(reserves);

        _output.WriteLine($"Total reserves returned: {reserves.Count}");

        // Verify that at least one reserve has all required fields
        var validReserves = reserves.Where(r => 
            !string.IsNullOrEmpty(r.Address) && 
            !string.IsNullOrEmpty(r.Symbol) && 
            !string.IsNullOrEmpty(r.MintAddress)).ToList();

        Assert.NotEmpty(validReserves);

        _output.WriteLine($"Reserves with all required fields: {validReserves.Count}");
    }

    [Fact]
    public async Task GetReservesMetrics_ShouldContainCbBTC()
    {
        // Arrange
        using var httpClient = new HttpClient();
        httpClient.BaseAddress = new Uri(KaminoApiUrl);
        httpClient.Timeout = TimeSpan.FromSeconds(30);

        var endpoint = $"kamino-market/{MainMarketPubkey}/reserves/metrics?env=mainnet-beta";
        var expectedReserveAddress = "37Jk2zkz23vkAYBT66HM2gaqJuNg2nYLsCreQAVt5MWK";

        // Act
        var response = await httpClient.GetAsync(endpoint);
        var content = await response.Content.ReadAsStringAsync();
        var reserves = JsonSerializer.Deserialize<List<KaminoReserveDto>>(content, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        // Assert
        Assert.NotNull(reserves);
        
        var cbBtcReserve = reserves.FirstOrDefault(r => r.Address == expectedReserveAddress);
        Assert.NotNull(cbBtcReserve);

        _output.WriteLine($"cbBTC Reserve found:");
        _output.WriteLine($"  Address: {cbBtcReserve.Address}");
        _output.WriteLine($"  Symbol: {cbBtcReserve.Symbol}");
        _output.WriteLine($"  Mint: {cbBtcReserve.MintAddress}");
        _output.WriteLine($"  Decimals (computed): {cbBtcReserve.Decimals}");
        _output.WriteLine($"  Supply APY: {cbBtcReserve.SupplyApy * 100:F4}%");
        _output.WriteLine($"  Borrow APY: {cbBtcReserve.BorrowApy * 100:F4}%");

        Assert.Equal("cbBTC", cbBtcReserve.Symbol, ignoreCase: true);
        Assert.Equal(8, cbBtcReserve.Decimals); // cbBTC should have 8 decimals
    }

    [Fact]
    public async Task GetReservesMetrics_ShouldContainCommonTokens()
    {
        // Arrange
        using var httpClient = new HttpClient();
        httpClient.BaseAddress = new Uri(KaminoApiUrl);
        httpClient.Timeout = TimeSpan.FromSeconds(30);

        var endpoint = $"kamino-market/{MainMarketPubkey}/reserves/metrics?env=mainnet-beta";
        var expectedTokens = new[] { "SOL", "USDC", "USDT", "cbBTC" };

        // Act
        var response = await httpClient.GetAsync(endpoint);
        var content = await response.Content.ReadAsStringAsync();
        var reserves = JsonSerializer.Deserialize<List<KaminoReserveDto>>(content, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        // Assert
        Assert.NotNull(reserves);

        _output.WriteLine($"\nSearching for common tokens in {reserves.Count} reserves:");

        foreach (var expectedToken in expectedTokens)
        {
            var reserve = reserves.FirstOrDefault(r => 
                string.Equals(r.Symbol, expectedToken, StringComparison.OrdinalIgnoreCase));

            if (reserve != null)
            {
                _output.WriteLine($"✓ {expectedToken} found:");
                _output.WriteLine($"    Address: {reserve.Address}");
                _output.WriteLine($"    Mint: {reserve.MintAddress}");
                _output.WriteLine($"    Decimals: {reserve.Decimals}");
                _output.WriteLine($"    Supply APY: {reserve.SupplyApy * 100:F4}%");
            }
            else
            {
                _output.WriteLine($"✗ {expectedToken} NOT FOUND");
            }

            Assert.NotNull(reserve);
        }
    }

    [Fact]
    public async Task GetReservesMetrics_DecimalsShouldMatchTokenStandards()
    {
        // Arrange
        using var httpClient = new HttpClient();
        httpClient.BaseAddress = new Uri(KaminoApiUrl);
        httpClient.Timeout = TimeSpan.FromSeconds(30);

        var endpoint = $"kamino-market/{MainMarketPubkey}/reserves/metrics?env=mainnet-beta";

        // Act
        var response = await httpClient.GetAsync(endpoint);
        var content = await response.Content.ReadAsStringAsync();
        var reserves = JsonSerializer.Deserialize<List<KaminoReserveDto>>(content, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        // Assert
        Assert.NotNull(reserves);

        var expectedDecimals = new Dictionary<string, int>
        {
            ["USDC"] = 6,
            ["USDT"] = 6,
            ["USDS"] = 6,
            ["JLP"] = 6,
            ["CBBTC"] = 8,
            ["WBTC"] = 8,
            ["SOL"] = 9,
            ["JITOSOL"] = 9,
            ["MSOL"] = 9,
            ["BSOL"] = 9
        };

        _output.WriteLine("\nVerifying decimal precision for tokens:");

        foreach (var (symbol, expectedDecimal) in expectedDecimals)
        {
            var reserve = reserves.FirstOrDefault(r => 
                string.Equals(r.Symbol, symbol, StringComparison.OrdinalIgnoreCase));

            if (reserve != null)
            {
                var actualDecimal = reserve.Decimals;
                _output.WriteLine($"{symbol}: Expected={expectedDecimal}, Actual={actualDecimal} {(actualDecimal == expectedDecimal ? "✓" : "✗")}");
                Assert.Equal(expectedDecimal, actualDecimal);
            }
            else
            {
                _output.WriteLine($"{symbol}: Not found in API response (might not be listed in Main Market)");
            }
        }
    }

    [Fact]
    public async Task GetReservesMetrics_ShouldHaveAPYData()
    {
        // Arrange
        using var httpClient = new HttpClient();
        httpClient.BaseAddress = new Uri(KaminoApiUrl);
        httpClient.Timeout = TimeSpan.FromSeconds(30);

        var endpoint = $"kamino-market/{MainMarketPubkey}/reserves/metrics?env=mainnet-beta";

        // Act
        var response = await httpClient.GetAsync(endpoint);
        var content = await response.Content.ReadAsStringAsync();
        var reserves = JsonSerializer.Deserialize<List<KaminoReserveDto>>(content, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        // Assert
        Assert.NotNull(reserves);

        var reservesWithApy = reserves.Where(r => r.SupplyApy > 0 || r.BorrowApy > 0).ToList();
        
        _output.WriteLine($"\nTotal reserves: {reserves.Count}");
        _output.WriteLine($"Reserves with APY data: {reservesWithApy.Count}");
        _output.WriteLine($"Percentage with APY: {(double)reservesWithApy.Count / reserves.Count * 100:F1}%");

        // Most reserves should have APY data
        Assert.True(reservesWithApy.Count > reserves.Count * 0.5, 
            $"Expected majority of reserves to have APY data, but only {reservesWithApy.Count}/{reserves.Count} had it");

        // Show top 5 by supply APY
        _output.WriteLine("\nTop 5 reserves by Supply APY:");
        foreach (var reserve in reservesWithApy.OrderByDescending(r => r.SupplyApy).Take(5))
        {
            _output.WriteLine($"  {reserve.Symbol}: {reserve.SupplyApy * 100:F2}% supply, {reserve.BorrowApy * 100:F2}% borrow");
        }
    }
}
