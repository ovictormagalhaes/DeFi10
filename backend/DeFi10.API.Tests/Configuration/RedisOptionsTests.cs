using DeFi10.API.Configuration;
using Xunit;

namespace DeFi10.API.Tests.Configuration;

public class RedisOptionsTests
{
    [Fact]
    public void Validate_WithValidOptions_ReturnsSuccess()
    {
        var options = new RedisOptions
        {
            ConnectionString = "localhost:6379",
            ConnectTimeoutMs = 5000,
            SyncTimeoutMs = 10000
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithMissingConnectionString_ReturnsFail()
    {
        var options = new RedisOptions
        {
            ConnectionString = "",
            ConnectTimeoutMs = 5000,
            SyncTimeoutMs = 10000
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("ConnectionString is required", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithInvalidConnectTimeout_ReturnsFail()
    {
        var options = new RedisOptions
        {
            ConnectionString = "localhost:6379",
            ConnectTimeoutMs = 0,
            SyncTimeoutMs = 10000
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("ConnectTimeoutMs must be > 0", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithInvalidSyncTimeout_ReturnsFail()
    {
        var options = new RedisOptions
        {
            ConnectionString = "localhost:6379",
            ConnectTimeoutMs = 5000,
            SyncTimeoutMs = -1
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("SyncTimeoutMs must be > 0", result.FailureMessage);
    }

    [Fact]
    public void Constants_HaveExpectedValues()
    {
        Assert.Equal("wallet:", RedisOptions.WalletCacheKeyPrefix);
        Assert.Equal("token_logo:", RedisOptions.TokenLogoKeyPrefix);
    }

    [Fact]
    public void DefaultExpiration_IsCorrect()
    {
        var options = new RedisOptions();

        Assert.Equal(TimeSpan.FromHours(1), options.DefaultExpiration);
        Assert.Equal(TimeSpan.MaxValue, options.TokenLogoExpiration);
    }
}
