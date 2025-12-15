using DeFi10.API.Configuration;
using Xunit;

namespace DeFi10.API.Tests.Configuration;

public class UniswapV3WorkerOptionsTests
{
    [Fact]
    public void Validate_WithValidOptions_ReturnsSuccess()
    {
        var options = new UniswapV3WorkerOptions
        {
            EnableGranularProcessing = true,
            GranularOperationTimeout = TimeSpan.FromSeconds(30),
            MaxRetryAttempts = 3,
            JobCompletionTimeout = TimeSpan.FromMinutes(5),
            MinSuccessRate = 0.9,
            MaxParallelOperations = 8
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithZeroGranularTimeout_ReturnsFail()
    {
        var options = new UniswapV3WorkerOptions
        {
            GranularOperationTimeout = TimeSpan.Zero
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("GranularOperationTimeout must be > 0", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithNegativeGranularTimeout_ReturnsFail()
    {
        var options = new UniswapV3WorkerOptions
        {
            GranularOperationTimeout = TimeSpan.FromSeconds(-1)
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("GranularOperationTimeout must be > 0", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithNegativeMaxRetryAttempts_ReturnsFail()
    {
        var options = new UniswapV3WorkerOptions
        {
            MaxRetryAttempts = -1
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("MaxRetryAttempts must be >= 0", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithZeroMaxRetryAttempts_ReturnsSuccess()
    {
        var options = new UniswapV3WorkerOptions
        {
            MaxRetryAttempts = 0
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithZeroJobCompletionTimeout_ReturnsFail()
    {
        var options = new UniswapV3WorkerOptions
        {
            JobCompletionTimeout = TimeSpan.Zero
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("JobCompletionTimeout must be > 0", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithMinSuccessRateBelowZero_ReturnsFail()
    {
        var options = new UniswapV3WorkerOptions
        {
            MinSuccessRate = -0.1
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("MinSuccessRate must be between 0 and 1", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithMinSuccessRateAboveOne_ReturnsFail()
    {
        var options = new UniswapV3WorkerOptions
        {
            MinSuccessRate = 1.1
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("MinSuccessRate must be between 0 and 1", result.FailureMessage);
    }

    [Theory]
    [InlineData(0.0)]
    [InlineData(0.5)]
    [InlineData(1.0)]
    public void Validate_WithValidMinSuccessRateBoundaries_ReturnsSuccess(double rate)
    {
        var options = new UniswapV3WorkerOptions
        {
            MinSuccessRate = rate
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithZeroMaxParallelOperations_ReturnsFail()
    {
        var options = new UniswapV3WorkerOptions
        {
            MaxParallelOperations = 0
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("MaxParallelOperations must be > 0", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithNegativeMaxParallelOperations_ReturnsFail()
    {
        var options = new UniswapV3WorkerOptions
        {
            MaxParallelOperations = -1
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("MaxParallelOperations must be > 0", result.FailureMessage);
    }

    [Fact]
    public void DefaultValues_AreCorrect()
    {
        var options = new UniswapV3WorkerOptions();

        Assert.True(options.EnableGranularProcessing);
        Assert.Equal(TimeSpan.FromSeconds(30), options.GranularOperationTimeout);
        Assert.Equal(3, options.MaxRetryAttempts);
        Assert.Equal(TimeSpan.FromMinutes(5), options.JobCompletionTimeout);
        Assert.Equal(0.9, options.MinSuccessRate);
        Assert.Equal(8, options.MaxParallelOperations);
    }
}
