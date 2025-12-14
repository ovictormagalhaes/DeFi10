using DeFi10.API.Configuration;
using Xunit;

namespace DeFi10.API.Tests.Configuration;

public class MongoDBOptionsTests
{
    [Fact]
    public void Validate_WithValidOptions_ReturnsSuccess()
    {
        var options = new MongoDBOptions
        {
            ConnectionString = "mongodb://localhost:27017",
            DatabaseName = "defi10",
            Collections = new MongoDBOptions.CollectionNames
            {
                WalletGroups = "wallet-groups",
                Strategies = "strategies"
            }
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithMissingConnectionString_ReturnsFail()
    {
        var options = new MongoDBOptions
        {
            ConnectionString = "",
            DatabaseName = "defi10",
            Collections = new MongoDBOptions.CollectionNames
            {
                WalletGroups = "wallet-groups",
                Strategies = "strategies"
            }
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("ConnectionString is required", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithMissingDatabaseName_ReturnsFail()
    {
        var options = new MongoDBOptions
        {
            ConnectionString = "mongodb://localhost:27017",
            DatabaseName = "",
            Collections = new MongoDBOptions.CollectionNames
            {
                WalletGroups = "wallet-groups",
                Strategies = "strategies"
            }
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("DatabaseName is required", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithMissingWalletGroupsCollection_ReturnsFail()
    {
        var options = new MongoDBOptions
        {
            ConnectionString = "mongodb://localhost:27017",
            DatabaseName = "defi10",
            Collections = new MongoDBOptions.CollectionNames
            {
                WalletGroups = "",
                Strategies = "strategies"
            }
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("WalletGroups is required", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithMissingStrategiesCollection_ReturnsFail()
    {
        var options = new MongoDBOptions
        {
            ConnectionString = "mongodb://localhost:27017",
            DatabaseName = "defi10",
            Collections = new MongoDBOptions.CollectionNames
            {
                WalletGroups = "wallet-groups",
                Strategies = ""
            }
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("Strategies is required", result.FailureMessage);
    }

    [Fact]
    public void DefaultCollectionNames_AreCorrect()
    {
        var collections = new MongoDBOptions.CollectionNames();

        Assert.Equal("wallet_groups", collections.WalletGroups);
        Assert.Equal("strategies", collections.Strategies);
    }
}
