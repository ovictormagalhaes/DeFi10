using DeFi10.API.Configuration;
using Xunit;

namespace DeFi10.API.Tests.Configuration;

public class JwtOptionsTests
{
    [Fact]
    public void Validate_WithValidOptions_ReturnsSuccess()
    {
        var options = new JwtOptions
        {
            Secret = "this-is-a-very-long-secret-key-with-at-least-32-characters",
            Issuer = "DeFi10",
            Audience = "DeFi10.API",
            ExpirationMinutes = 60
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithMissingSecret_ReturnsFail()
    {
        var options = new JwtOptions
        {
            Secret = "",
            Issuer = "DeFi10",
            Audience = "DeFi10.API",
            ExpirationMinutes = 60
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("Secret is required", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithSecretTooShort_ReturnsFail()
    {
        var options = new JwtOptions
        {
            Secret = "short-secret",
            Issuer = "DeFi10",
            Audience = "DeFi10.API",
            ExpirationMinutes = 60
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("Secret must be at least 32 characters", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithMissingIssuer_ReturnsFail()
    {
        var options = new JwtOptions
        {
            Secret = "this-is-a-very-long-secret-key-with-at-least-32-characters",
            Issuer = "",
            Audience = "DeFi10.API",
            ExpirationMinutes = 60
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("Issuer is required", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithMissingAudience_ReturnsFail()
    {
        var options = new JwtOptions
        {
            Secret = "this-is-a-very-long-secret-key-with-at-least-32-characters",
            Issuer = "DeFi10",
            Audience = "",
            ExpirationMinutes = 60
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("Audience is required", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithExpirationTooLow_ReturnsFail()
    {
        var options = new JwtOptions
        {
            Secret = "this-is-a-very-long-secret-key-with-at-least-32-characters",
            Issuer = "DeFi10",
            Audience = "DeFi10.API",
            ExpirationMinutes = 4
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("ExpirationMinutes must be between 5 and 10080", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithExpirationTooHigh_ReturnsFail()
    {
        var options = new JwtOptions
        {
            Secret = "this-is-a-very-long-secret-key-with-at-least-32-characters",
            Issuer = "DeFi10",
            Audience = "DeFi10.API",
            ExpirationMinutes = 10081
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("ExpirationMinutes must be between 5 and 10080", result.FailureMessage);
    }

    [Theory]
    [InlineData(5)]
    [InlineData(60)]
    [InlineData(1440)]
    [InlineData(10080)]
    public void Validate_WithValidExpirationBoundaries_ReturnsSuccess(int minutes)
    {
        var options = new JwtOptions
        {
            Secret = "this-is-a-very-long-secret-key-with-at-least-32-characters",
            Issuer = "DeFi10",
            Audience = "DeFi10.API",
            ExpirationMinutes = minutes
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithExactly32CharacterSecret_ReturnsSuccess()
    {
        var options = new JwtOptions
        {
            Secret = "12345678901234567890123456789012",
            Issuer = "DeFi10",
            Audience = "DeFi10.API",
            ExpirationMinutes = 60
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void DefaultValues_AreCorrect()
    {
        var options = new JwtOptions();

        Assert.Equal(string.Empty, options.Secret);
        Assert.Equal(string.Empty, options.Issuer);
        Assert.Equal(string.Empty, options.Audience);
        Assert.Equal(60, options.ExpirationMinutes);
    }
}
