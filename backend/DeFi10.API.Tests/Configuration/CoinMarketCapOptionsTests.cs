using DeFi10.API.Services;
using Xunit;

namespace DeFi10.API.Tests.Configuration;

public class CoinMarketCapOptionsTests
{
    [Fact]
    public void Validate_WithValidOptions_ReturnsSuccess()
    {
        var options = new CoinMarketCapOptions
        {
            ApiKey = "test-api-key",
            BaseUrl = "https://pro-api.coinmarketcap.com/v1",
            Enabled = true,
            TimeoutMs = 5000
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WhenDisabledWithoutApiKey_ReturnsSuccess()
    {
        var options = new CoinMarketCapOptions
        {
            ApiKey = "",
            BaseUrl = "https://pro-api.coinmarketcap.com/v1",
            Enabled = false,
            TimeoutMs = 5000
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WhenEnabledWithoutApiKey_ReturnsFail()
    {
        var options = new CoinMarketCapOptions
        {
            ApiKey = "",
            BaseUrl = "https://pro-api.coinmarketcap.com/v1",
            Enabled = true,
            TimeoutMs = 5000
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("ApiKey is required when Enabled is true", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithMissingBaseUrl_ReturnsFail()
    {
        var options = new CoinMarketCapOptions
        {
            ApiKey = "test-key",
            BaseUrl = "",
            Enabled = true,
            TimeoutMs = 5000
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("BaseUrl is required", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithInvalidBaseUrl_ReturnsFail()
    {
        var options = new CoinMarketCapOptions
        {
            ApiKey = "test-key",
            BaseUrl = "not a url",
            Enabled = true,
            TimeoutMs = 5000
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("must be a valid URL", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithZeroTimeout_ReturnsFail()
    {
        var options = new CoinMarketCapOptions
        {
            ApiKey = "test-key",
            BaseUrl = "https://pro-api.coinmarketcap.com/v1",
            Enabled = true,
            TimeoutMs = 0
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("TimeoutMs must be > 0", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithNegativeTimeout_ReturnsFail()
    {
        var options = new CoinMarketCapOptions
        {
            ApiKey = "test-key",
            BaseUrl = "https://pro-api.coinmarketcap.com/v1",
            Enabled = true,
            TimeoutMs = -1
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("TimeoutMs must be > 0", result.FailureMessage);
    }

    [Fact]
    public void DefaultValues_AreCorrect()
    {
        var options = new CoinMarketCapOptions();

        Assert.Null(options.ApiKey);
        Assert.Equal("https://pro-api.coinmarketcap.com/v1", options.BaseUrl);
        Assert.True(options.Enabled);
        Assert.Equal(5000, options.TimeoutMs);
    }
}
