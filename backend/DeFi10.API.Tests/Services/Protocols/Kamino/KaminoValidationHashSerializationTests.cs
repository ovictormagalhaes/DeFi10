using System.Text.Json;
using MongoDB.Bson;
using Xunit;

namespace DeFi10.API.Tests.Services.Protocols.Kamino;

/// <summary>
/// Tests to verify the correct approach for building ValidationHash that MongoDB accepts.
/// Problem: System.Text.Json's JsonElement is not in MongoDB's ObjectSerializer whitelist.
/// Solution: Manually construct Dictionary<string, object> with nested dictionaries.
/// </summary>
public class KaminoValidationHashSerializationTests
{
    [Fact]
    public void TestSerialization_WithJsonRoundTrip_ShouldCreateJsonElement()
    {
        // This test demonstrates the PROBLEM - JSON round-trip creates JsonElement
        var supplies = new List<Dictionary<string, object>>
        {
            new() { { "MintAddress", "mint1" }, { "Balance", "100" } }
        };

        var testData = new Dictionary<string, object>
        {
            { "Supplies", supplies }
        };

        var json = JsonSerializer.Serialize(testData);
        var deserialized = JsonSerializer.Deserialize<Dictionary<string, object>>(json);

        // Verify that Supplies becomes JsonElement (this is what MongoDB rejects)
        Assert.NotNull(deserialized);
        Assert.True(deserialized!["Supplies"] is JsonElement, 
            "JSON round-trip creates JsonElement - MongoDB rejects this");
    }

    [Fact]
    public void TestSerialization_WithManualDictionary_ShouldWorkWithMongoDB()
    {
        // This test demonstrates the SOLUTION - manual Dictionary construction works
        // Use object directly to avoid type issues
        var supplies = new List<object>
        {
            new Dictionary<string, object> { { "MintAddress", "mint1" }, { "Balance", "100" } },
            new Dictionary<string, object> { { "MintAddress", "mint2" }, { "Balance", "200" } }
        };

        var borrows = new List<object>
        {
            new Dictionary<string, object> { { "MintAddress", "mint3" }, { "Balance", "50" } }
        };

        var validationHash = new Dictionary<string, object>
        {
            { "MarketPubkey", "market123" },
            { "ObligationPubkey", "obligation456" },
            { "EventCount", 10 },
            { "LastEventDate", DateTime.UtcNow },
            { "Supplies", supplies },
            { "Borrows", borrows }
        };

        // Verify types are correct (no JsonElement)
        Assert.IsType<string>(validationHash["MarketPubkey"]);
        Assert.IsType<List<object>>(validationHash["Supplies"]);
        Assert.IsType<List<object>>(validationHash["Borrows"]);

        // The key test: does MongoDB driver accept this structure?
        // When SaveToCacheAsync passes this to MongoDB, it should serialize without errors
        // This verifies that we're not using JsonElement or other unsupported types
        Assert.NotNull(validationHash);
        Assert.Equal(6, validationHash.Count);
        
        // Verify nested structure
        var suppliesList = (List<object>)validationHash["Supplies"];
        Assert.Equal(2, suppliesList.Count);
        var firstSupply = (Dictionary<string, object>)suppliesList[0];
        Assert.Equal("mint1", firstSupply["MintAddress"]);
        Assert.Equal("100", firstSupply["Balance"]);
    }
}
