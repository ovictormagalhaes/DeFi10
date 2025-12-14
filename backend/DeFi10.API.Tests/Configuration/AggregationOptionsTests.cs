using DeFi10.API.Configuration;
using Microsoft.Extensions.Options;
using Xunit;

namespace DeFi10.API.Tests.Configuration;

public class AggregationOptionsTests
{
    #region Validate Success Tests

    [Fact]
    public void Validate_WithValidOptions_ReturnsSuccess()
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 300,
            TimeoutScanSeconds = 60,
            JobTimeoutSeconds = 180,
            WalletCacheTtlMinutes = 5,
            EnableCoinMarketCapLookup = true
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithMinimumValidValues_ReturnsSuccess()
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 1,
            TimeoutScanSeconds = 5,
            JobTimeoutSeconds = 30,
            WalletCacheTtlMinutes = 1,
            EnableCoinMarketCapLookup = false
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithMaximumValidValues_ReturnsSuccess()
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = int.MaxValue,
            TimeoutScanSeconds = 300,
            JobTimeoutSeconds = 3600,
            WalletCacheTtlMinutes = 60,
            EnableCoinMarketCapLookup = true
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    #endregion

    #region JobTtlSeconds Validation Tests

    [Fact]
    public void Validate_WithZeroJobTtlSeconds_ReturnsFail()
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 0,
            TimeoutScanSeconds = 60,
            JobTimeoutSeconds = 180,
            WalletCacheTtlMinutes = 5
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("JobTtlSeconds must be > 0", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithNegativeJobTtlSeconds_ReturnsFail()
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = -1,
            TimeoutScanSeconds = 60,
            JobTimeoutSeconds = 180,
            WalletCacheTtlMinutes = 5
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("JobTtlSeconds must be > 0", result.FailureMessage);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(100)]
    [InlineData(1000)]
    [InlineData(10000)]
    public void Validate_WithPositiveJobTtlSeconds_ReturnsSuccess(int seconds)
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = seconds,
            TimeoutScanSeconds = 60,
            JobTimeoutSeconds = 180,
            WalletCacheTtlMinutes = 5
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    #endregion

    #region TimeoutScanSeconds Validation Tests

    [Theory]
    [InlineData(4)]
    [InlineData(0)]
    [InlineData(-1)]
    public void Validate_WithTimeoutScanSecondsBelowMinimum_ReturnsFail(int seconds)
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 300,
            TimeoutScanSeconds = seconds,
            JobTimeoutSeconds = 180,
            WalletCacheTtlMinutes = 5
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("TimeoutScanSeconds must be between 5 and 300", result.FailureMessage);
    }

    [Theory]
    [InlineData(301)]
    [InlineData(500)]
    [InlineData(1000)]
    public void Validate_WithTimeoutScanSecondsAboveMaximum_ReturnsFail(int seconds)
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 300,
            TimeoutScanSeconds = seconds,
            JobTimeoutSeconds = 180,
            WalletCacheTtlMinutes = 5
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("TimeoutScanSeconds must be between 5 and 300", result.FailureMessage);
    }

    [Theory]
    [InlineData(5)]
    [InlineData(60)]
    [InlineData(150)]
    [InlineData(300)]
    public void Validate_WithValidTimeoutScanSeconds_ReturnsSuccess(int seconds)
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 300,
            TimeoutScanSeconds = seconds,
            JobTimeoutSeconds = 180,
            WalletCacheTtlMinutes = 5
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    #endregion

    #region JobTimeoutSeconds Validation Tests

    [Theory]
    [InlineData(29)]
    [InlineData(0)]
    [InlineData(-1)]
    public void Validate_WithJobTimeoutSecondsBelowMinimum_ReturnsFail(int seconds)
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 300,
            TimeoutScanSeconds = 60,
            JobTimeoutSeconds = seconds,
            WalletCacheTtlMinutes = 5
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("JobTimeoutSeconds must be between 30 and 3600", result.FailureMessage);
    }

    [Theory]
    [InlineData(3601)]
    [InlineData(5000)]
    [InlineData(10000)]
    public void Validate_WithJobTimeoutSecondsAboveMaximum_ReturnsFail(int seconds)
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 300,
            TimeoutScanSeconds = 60,
            JobTimeoutSeconds = seconds,
            WalletCacheTtlMinutes = 5
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("JobTimeoutSeconds must be between 30 and 3600", result.FailureMessage);
    }

    [Theory]
    [InlineData(30)]
    [InlineData(180)]
    [InlineData(1800)]
    [InlineData(3600)]
    public void Validate_WithValidJobTimeoutSeconds_ReturnsSuccess(int seconds)
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 300,
            TimeoutScanSeconds = 60,
            JobTimeoutSeconds = seconds,
            WalletCacheTtlMinutes = 5
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    #endregion

    #region WalletCacheTtlMinutes Validation Tests

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-10)]
    public void Validate_WithWalletCacheTtlMinutesBelowMinimum_ReturnsFail(int minutes)
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 300,
            TimeoutScanSeconds = 60,
            JobTimeoutSeconds = 180,
            WalletCacheTtlMinutes = minutes
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("WalletCacheTtlMinutes must be between 1 and 60", result.FailureMessage);
    }

    [Theory]
    [InlineData(61)]
    [InlineData(100)]
    [InlineData(500)]
    public void Validate_WithWalletCacheTtlMinutesAboveMaximum_ReturnsFail(int minutes)
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 300,
            TimeoutScanSeconds = 60,
            JobTimeoutSeconds = 180,
            WalletCacheTtlMinutes = minutes
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("WalletCacheTtlMinutes must be between 1 and 60", result.FailureMessage);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    [InlineData(30)]
    [InlineData(60)]
    public void Validate_WithValidWalletCacheTtlMinutes_ReturnsSuccess(int minutes)
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 300,
            TimeoutScanSeconds = 60,
            JobTimeoutSeconds = 180,
            WalletCacheTtlMinutes = minutes
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    #endregion

    #region EnableCoinMarketCapLookup Tests

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Validate_WithAnyEnableCoinMarketCapLookupValue_ReturnsSuccess(bool enabled)
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 300,
            TimeoutScanSeconds = 60,
            JobTimeoutSeconds = 180,
            WalletCacheTtlMinutes = 5,
            EnableCoinMarketCapLookup = enabled
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    #endregion

    #region Default Values Tests

    [Fact]
    public void Constructor_SetsDefaultValues()
    {
        var options = new AggregationOptions();

        Assert.Equal(300, options.JobTtlSeconds);
        Assert.Equal(60, options.TimeoutScanSeconds);
        Assert.Equal(180, options.JobTimeoutSeconds);
        Assert.Equal(5, options.WalletCacheTtlMinutes);
        Assert.True(options.EnableCoinMarketCapLookup);
    }

    [Fact]
    public void DefaultValues_PassValidation()
    {
        var options = new AggregationOptions();

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    #endregion

    #region Multiple Failures Tests

    [Fact]
    public void Validate_WithMultipleInvalidValues_ReturnsFirstFailure()
    {
        var options = new AggregationOptions
        {
            JobTtlSeconds = 0,
            TimeoutScanSeconds = 3,
            JobTimeoutSeconds = 20,
            WalletCacheTtlMinutes = 0
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("JobTtlSeconds", result.FailureMessage);
    }

    #endregion
}
