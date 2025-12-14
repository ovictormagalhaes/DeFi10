using DeFi10.API.Configuration;
using Xunit;

namespace DeFi10.API.Tests.Configuration;

public class MoralisOptionsTests
{
    [Fact]
    public void Validate_WithValidOptions_ReturnsSuccess()
    {
        var options = new MoralisOptions
        {
            ApiKey = "test-api-key",
            BaseUrl = "https://api.moralis.io"
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithMissingApiKey_ReturnsFail()
    {
        var options = new MoralisOptions
        {
            ApiKey = "",
            BaseUrl = "https://api.moralis.io"
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("ApiKey is required", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithMissingBaseUrl_ReturnsFail()
    {
        var options = new MoralisOptions
        {
            ApiKey = "test-api-key",
            BaseUrl = ""
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("BaseUrl is required", result.FailureMessage);
    }

    [Fact]
    public void DefaultValues_AreCorrect()
    {
        var options = new MoralisOptions();

        Assert.Equal(string.Empty, options.ApiKey);
        Assert.Equal(string.Empty, options.BaseUrl);
    }
}
