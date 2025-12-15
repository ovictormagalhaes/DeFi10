using DeFi10.API.Configuration;
using Xunit;

namespace DeFi10.API.Tests.Configuration;

public class SolanaOptionsTests
{
    [Fact]
    public void Validate_WithValidRpcUrl_ReturnsSuccess()
    {
        var options = new SolanaOptions
        {
            RpcUrl = "https://api.mainnet-beta.solana.com",
            RequestTimeoutSeconds = 30
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithFallbackRpcUrlsOnly_ReturnsSuccess()
    {
        var options = new SolanaOptions
        {
            RpcUrl = "",
            FallbackRpcUrls = new List<string> { "https://api.mainnet-beta.solana.com" },
            RequestTimeoutSeconds = 30
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithoutAnyRpcUrl_ReturnsFail()
    {
        var options = new SolanaOptions
        {
            RpcUrl = "",
            FallbackRpcUrls = new List<string>(),
            RequestTimeoutSeconds = 30
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("RpcUrl is required", result.FailureMessage);
    }

    [Theory]
    [InlineData("not-a-url")]
    [InlineData("just text")]
    public void Validate_WithInvalidRpcUrlFormat_ReturnsFail(string invalidUrl)
    {
        var options = new SolanaOptions
        {
            RpcUrl = invalidUrl,
            RequestTimeoutSeconds = 30
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("must be a valid URL", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithNegativeRateLimitDelay_ReturnsFail()
    {
        var options = new SolanaOptions
        {
            RpcUrl = "https://api.mainnet-beta.solana.com",
            RateLimitDelayMs = -1,
            RequestTimeoutSeconds = 30
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("RateLimitDelayMs must be >= 0", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithZeroRequestTimeout_ReturnsFail()
    {
        var options = new SolanaOptions
        {
            RpcUrl = "https://api.mainnet-beta.solana.com",
            RequestTimeoutSeconds = 0
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("RequestTimeoutSeconds must be > 0", result.FailureMessage);
    }

    [Fact]
    public void GetRpcUrl_WithDirectUrl_ReturnsDirectUrl()
    {
        var options = new SolanaOptions
        {
            RpcUrl = "https://my-custom-rpc.com"
        };

        var result = options.GetRpcUrl();

        Assert.Equal("https://my-custom-rpc.com", result);
    }

    [Fact]
    public void GetRpcUrl_WithMultipleFallbackUrls_ReturnsFirstNonEmpty()
    {
        var options = new SolanaOptions
        {
            RpcUrl = "",
            FallbackRpcUrls = new List<string>
            {
                "https://api.mainnet-beta.solana.com",
                "https://backup-rpc.solana.com"
            }
        };

        var result = options.GetRpcUrl();

        Assert.Equal("https://api.mainnet-beta.solana.com", result);
    }

    [Fact]
    public void GetRpcUrl_PrioritizesDirectUrlOverFallbacks()
    {
        var options = new SolanaOptions
        {
            RpcUrl = "https://my-custom-rpc.com",
            FallbackRpcUrls = new List<string> { "https://fallback.com" }
        };

        var result = options.GetRpcUrl();

        Assert.Equal("https://my-custom-rpc.com", result);
    }

    [Fact]
    public void GetRpcUrl_WithNoOptions_ReturnsEmptyString()
    {
        var options = new SolanaOptions
        {
            RpcUrl = "",
            FallbackRpcUrls = new List<string>()
        };

        var result = options.GetRpcUrl();

        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void DefaultValues_AreCorrect()
    {
        var options = new SolanaOptions();

        Assert.Equal(string.Empty, options.RpcUrl);
        Assert.NotNull(options.FallbackRpcUrls);
        Assert.Empty(options.FallbackRpcUrls);
        Assert.True(options.UseFallbackOnRateLimit);
        Assert.Equal(1000, options.RateLimitDelayMs);
        Assert.Equal(30, options.RequestTimeoutSeconds);
        Assert.Equal(0, options.MaxRetries);
    }

    [Fact]
    public void RateLimitDelayMs_CanBeSetToZero()
    {
        var options = new SolanaOptions
        {
            RpcUrl = "https://api.mainnet-beta.solana.com",
            RateLimitDelayMs = 0,
            RequestTimeoutSeconds = 30
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }
}
