using DeFi10.API.Configuration;
using Xunit;

namespace DeFi10.API.Tests.Configuration;

public class ProofOfWorkOptionsTests
{
    [Fact]
    public void Validate_WithValidOptions_ReturnsSuccess()
    {
        var options = new ProofOfWorkOptions
        {
            Difficulty = 5,
            ChallengeTTLMinutes = 10
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validate_WithDifficultyTooLow_ReturnsFail()
    {
        var options = new ProofOfWorkOptions
        {
            Difficulty = 0,
            ChallengeTTLMinutes = 10
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("Difficulty must be between 1 and 10", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithDifficultyTooHigh_ReturnsFail()
    {
        var options = new ProofOfWorkOptions
        {
            Difficulty = 11,
            ChallengeTTLMinutes = 10
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("Difficulty must be between 1 and 10", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithChallengeTTLTooLow_ReturnsFail()
    {
        var options = new ProofOfWorkOptions
        {
            Difficulty = 5,
            ChallengeTTLMinutes = 0
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("ChallengeTTLMinutes must be between 1 and 30", result.FailureMessage);
    }

    [Fact]
    public void Validate_WithChallengeTTLTooHigh_ReturnsFail()
    {
        var options = new ProofOfWorkOptions
        {
            Difficulty = 5,
            ChallengeTTLMinutes = 31
        };

        var result = options.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("ChallengeTTLMinutes must be between 1 and 30", result.FailureMessage);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    [InlineData(10)]
    public void Validate_WithValidDifficultyBoundaries_ReturnsSuccess(int difficulty)
    {
        var options = new ProofOfWorkOptions
        {
            Difficulty = difficulty,
            ChallengeTTLMinutes = 10
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(15)]
    [InlineData(30)]
    public void Validate_WithValidChallengeTTLBoundaries_ReturnsSuccess(int ttl)
    {
        var options = new ProofOfWorkOptions
        {
            Difficulty = 5,
            ChallengeTTLMinutes = ttl
        };

        var result = options.Validate(null, options);

        Assert.True(result.Succeeded);
    }
}
