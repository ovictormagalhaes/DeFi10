using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Xunit;
using Xunit.Abstractions;

namespace DeFi10.API.Tests;

public class RaydiumActualTickDataTests
{
    private readonly ITestOutputHelper _output;
    private const string RPC_URL = "https://api.mainnet-beta.solana.com";

    public RaydiumActualTickDataTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Fetch_Actual_Tick_Array_Lower()
    {
        // Tick array for tick -19663 (starts at -19680)
        var tickArrayPDA = "8XQ6kdfTWN96HMNAQyRWyoxPBJrev4vYnpqQcBCmXMRK";
        
        var accountInfo = await GetAccountInfo(tickArrayPDA);
        
        _output.WriteLine($"=== Tick Array Lower (PDA: {tickArrayPDA}) ===");
        _output.WriteLine($"Data length: {accountInfo?.data?.Length ?? 0}");
        
        if (accountInfo?.data != null && accountInfo.data.Length > 0)
        {
            var data = Convert.FromBase64String(accountInfo.data[0]);
            _output.WriteLine($"Decoded data length: {data.Length} bytes");
            
            // Parse tick at offset 17 (for tick -19663)
            // Tick structure: 73 bytes each
            // Offset in array: (tickIndex - startIndex) / spacing = (-19663 - -19680) / 1 = 17
            int tickOffset = 17;
            int tickStartByte = 104 + (tickOffset * 73); // 104 = header size
            
            if (tickStartByte + 73 <= data.Length)
            {
                var tickData = data.AsSpan(tickStartByte, 73);
                
                // Parse tick structure
                var tick = BitConverter.ToInt32(tickData.Slice(0, 4));
                var liquidityGross = ReadU128(tickData.Slice(8, 16));
                var feeGrowthOutside0 = ReadU128(tickData.Slice(32, 16));
                var feeGrowthOutside1 = ReadU128(tickData.Slice(48, 16));
                
                _output.WriteLine($"Tick at offset {tickOffset}:");
                _output.WriteLine($"  Index: {tick}");
                _output.WriteLine($"  LiquidityGross: {liquidityGross}");
                _output.WriteLine($"  FeeGrowthOutside0: {feeGrowthOutside0}");
                _output.WriteLine($"  FeeGrowthOutside1: {feeGrowthOutside1}");
                
                Assert.Equal(-19663, tick);
            }
        }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Fetch_Actual_Tick_Array_Upper()
    {
        // Tick array for tick -18327 (starts at -18360)
        var tickArrayPDA = "45GxDE7aUZxXots2J1CxZzU5dyFtxvWcVzauvu1GSPQB";
        
        var accountInfo = await GetAccountInfo(tickArrayPDA);
        
        _output.WriteLine($"=== Tick Array Upper (PDA: {tickArrayPDA}) ===");
        _output.WriteLine($"Data length: {accountInfo?.data?.Length ?? 0}");
        
        if (accountInfo?.data != null && accountInfo.data.Length > 0)
        {
            var data = Convert.FromBase64String(accountInfo.data[0]);
            _output.WriteLine($"Decoded data length: {data.Length} bytes");
            
            // Parse tick at offset 33 (for tick -18327)
            // Offset in array: (tickIndex - startIndex) / spacing = (-18327 - -18360) / 1 = 33
            int tickOffset = 33;
            int tickStartByte = 104 + (tickOffset * 73);
            
            if (tickStartByte + 73 <= data.Length)
            {
                var tickData = data.AsSpan(tickStartByte, 73);
                
                var tick = BitConverter.ToInt32(tickData.Slice(0, 4));
                var liquidityGross = ReadU128(tickData.Slice(8, 16));
                var feeGrowthOutside0 = ReadU128(tickData.Slice(32, 16));
                var feeGrowthOutside1 = ReadU128(tickData.Slice(48, 16));
                
                _output.WriteLine($"Tick at offset {tickOffset}:");
                _output.WriteLine($"  Index: {tick}");
                _output.WriteLine($"  LiquidityGross: {liquidityGross}");
                _output.WriteLine($"  FeeGrowthOutside0: {feeGrowthOutside0}");
                _output.WriteLine($"  FeeGrowthOutside1: {feeGrowthOutside1}");
                
                Assert.Equal(-18327, tick);
            }
        }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Analyze_Why_SDK_Works()
    {
        _output.WriteLine("=== Analysis: Why SDK calculation works ===");
        _output.WriteLine("");
        _output.WriteLine("The SDK must be:");
        _output.WriteLine("1. Using ACTUAL tick data from blockchain (not assuming 0)");
        _output.WriteLine("2. OR handling uninitialized ticks differently");
        _output.WriteLine("3. OR using a different data source (API/indexer)");
        _output.WriteLine("");
        _output.WriteLine("We need to check ACTUAL fee_growth_outside values from blockchain");
        _output.WriteLine("to see if they are really 0 or have some other values.");
    }

    private async Task<SolanaAccountInfo?> GetAccountInfo(string address)
    {
        using var client = new HttpClient();
        
        var request = new
        {
            jsonrpc = "2.0",
            id = 1,
            method = "getAccountInfo",
            @params = new object[]
            {
                address,
                new { encoding = "base64" }
            }
        };
        
        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        
        try
        {
            var response = await client.PostAsync(RPC_URL, content);
            var responseJson = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<SolanaRpcResponse>(responseJson);
            
            return result?.result?.value;
        }
        catch (Exception ex)
        {
            _output.WriteLine($"Error fetching account: {ex.Message}");
            return null;
        }
    }

    private System.Numerics.BigInteger ReadU128(ReadOnlySpan<byte> bytes)
    {
        var value = System.Numerics.BigInteger.Zero;
        for (int i = bytes.Length - 1; i >= 0; i--)
        {
            value = (value << 8) | bytes[i];
        }
        return value;
    }

    private class SolanaRpcResponse
    {
        public SolanaRpcResult? result { get; set; }
    }

    private class SolanaRpcResult
    {
        public SolanaAccountInfo? value { get; set; }
    }

    private class SolanaAccountInfo
    {
        public string[]? data { get; set; }
        public long lamports { get; set; }
        public string? owner { get; set; }
    }
}
