using DeFi10.API.Models;
using DeFi10.API.Services.Helpers;
using Xunit;

namespace DeFi10.API.Tests.Services.Helpers;

public class ProjectionCalculatorTests
{
    private readonly ProjectionCalculator _calculator;

    public ProjectionCalculatorTests()
    {
        _calculator = new ProjectionCalculator();
    }

    [Fact]
    public void CalculateAprProjection_WithValidInputs_ReturnsCorrectProjections()
    {
        // Arrange
        decimal currentValue = 10000m; // $10,000
        decimal apr = 10m; // 10% APR

        // Act
        var result = _calculator.CalculateAprProjection(currentValue, apr);

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.OneDay);
        Assert.NotNull(result.OneWeek);
        Assert.NotNull(result.OneMonth);
        Assert.NotNull(result.OneYear);

        // Expected: $10,000 * 10% = $1,000 per year
        // Daily: $1,000 / 365 ≈ $2.74
        // Weekly: $1,000 / 52 ≈ $19.23
        // Monthly: $1,000 / 12 ≈ $83.33
        Assert.InRange(result.OneDay.Value, 2.70m, 2.75m);
        Assert.InRange(result.OneWeek.Value, 19.20m, 19.25m);
        Assert.InRange(result.OneMonth.Value, 83.30m, 83.35m);
        Assert.Equal(1000m, result.OneYear.Value);
    }

    [Fact]
    public void CalculateAprProjection_WithNullValue_ReturnsNull()
    {
        // Act
        var result = _calculator.CalculateAprProjection(null, 10m);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void CalculateAprProjection_WithNullApr_ReturnsNull()
    {
        // Act
        var result = _calculator.CalculateAprProjection(10000m, null);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void CalculateAprProjection_WithZeroValue_ReturnsNull()
    {
        // Act
        var result = _calculator.CalculateAprProjection(0m, 10m);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void CalculateAprProjection_WithZeroApr_ReturnsZeroProjections()
    {
        // Act
        var result = _calculator.CalculateAprProjection(10000m, 0m);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(0m, result.OneDay);
        Assert.Equal(0m, result.OneWeek);
        Assert.Equal(0m, result.OneMonth);
        Assert.Equal(0m, result.OneYear);
    }

    [Fact]
    public void CalculateApyProjection_WithNegativeApy_ReturnsNegativeProjections()
    {
        // Arrange - For borrowed positions, APY is negative (cost)
        decimal currentValue = 10000m; // $10,000
        decimal apy = -5m; // -5% APY (borrowing cost)

        // Act
        var result = _calculator.CalculateApyProjection(currentValue, apy);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.OneDay < 0, "One day projection should be negative");
        Assert.True(result.OneWeek < 0, "One week projection should be negative");
        Assert.True(result.OneMonth < 0, "One month projection should be negative");
        Assert.True(result.OneYear < 0, "One year projection should be negative");
        
        // For -5% APY, yearly cost is -$500
        Assert.Equal(-500m, result.OneYear.Value);
    }

    [Fact]
    public void CalculateAprProjection_WithHighApr_ReturnsCorrectProjections()
    {
        // Arrange
        decimal currentValue = 1000m; // $1,000
        decimal apr = 50m; // 50% APR

        // Act
        var result = _calculator.CalculateAprProjection(currentValue, apr);

        // Assert
        Assert.NotNull(result);
        
        // Expected: $1,000 * 50% = $500 per year
        Assert.Equal(500m, result.OneYear.Value);
    }

    #region CreatedAt Projection Tests

    [Fact]
    public void CalculateCreatedAtProjection_WithValidData_ReturnsCorrectProjections()
    {
        // Arrange
        decimal totalFees = 100m; // $100 in fees generated
        // Position created 50 days ago
        long createdAt = DateTimeOffset.UtcNow.AddDays(-50).ToUnixTimeSeconds();
        long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // Act
        var result = _calculator.CalculateCreatedAtProjection(totalFees, createdAt, now);

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.OneDay);
        Assert.NotNull(result.OneWeek);
        Assert.NotNull(result.OneMonth);
        Assert.NotNull(result.OneYear);

        // Daily rate should be approximately $100 / 50 days = $2/day
        Assert.InRange(result.OneDay.Value, 1.9m, 2.1m);
        Assert.InRange(result.OneWeek.Value, 13m, 15m);
        Assert.InRange(result.OneMonth.Value, 57m, 63m);
        Assert.InRange(result.OneYear.Value, 700m, 770m);
    }

    [Fact]
    public void CalculateCreatedAtProjection_WithZeroFees_ReturnsNull()
    {
        // Arrange
        long createdAt = DateTimeOffset.UtcNow.AddDays(-10).ToUnixTimeSeconds();
        long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // Act
        var result = _calculator.CalculateCreatedAtProjection(0m, createdAt, now);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void CalculateCreatedAtProjection_WithNegativeFees_ReturnsNull()
    {
        // Arrange
        long createdAt = DateTimeOffset.UtcNow.AddDays(-10).ToUnixTimeSeconds();
        long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // Act
        var result = _calculator.CalculateCreatedAtProjection(-50m, createdAt, now);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void CalculateCreatedAtProjection_WithRecentPosition_ReturnsNull()
    {
        // Arrange - Position created 1 hour ago (too recent)
        decimal totalFees = 10m;
        long createdAt = DateTimeOffset.UtcNow.AddHours(-1).ToUnixTimeSeconds();
        long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // Act
        var result = _calculator.CalculateCreatedAtProjection(totalFees, createdAt, now);

        // Assert
        Assert.Null(result); // Too recent, less than 2.4 hours
    }

    [Fact]
    public void CalculateCreatedAtProjection_WithFutureTimestamp_ReturnsNull()
    {
        // Arrange
        decimal totalFees = 50m;
        long createdAt = DateTimeOffset.UtcNow.AddDays(1).ToUnixTimeSeconds(); // Future date
        long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // Act
        var result = _calculator.CalculateCreatedAtProjection(totalFees, createdAt, now);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void CalculateCreatedAtProjection_WithInvalidTimestamp_ReturnsNull()
    {
        // Arrange
        decimal totalFees = 50m;
        long createdAt = -1; // Invalid timestamp
        long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // Act
        var result = _calculator.CalculateCreatedAtProjection(totalFees, createdAt, now);

        // Assert
        Assert.Null(result);
    }

    #endregion

    #region AprHistorical Projection Tests

    [Fact]
    public void CalculateAprHistoricalProjection_WithValidData_ReturnsCorrectProjections()
    {
        // Arrange
        decimal totalFees = 100m; // $100 in fees generated
        decimal currentValueUsd = 1000m; // $1,000 current position value
        // Position created 50 days ago
        long createdAt = DateTimeOffset.UtcNow.AddDays(-50).ToUnixTimeSeconds();
        long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // Act
        var (projection, aprHistorical) = _calculator.CalculateAprHistoricalProjection(
            totalFees, currentValueUsd, createdAt, now);

        // Assert
        Assert.NotNull(projection);
        Assert.NotNull(aprHistorical);
        Assert.NotNull(projection.OneDay);
        Assert.NotNull(projection.OneWeek);
        Assert.NotNull(projection.OneMonth);
        Assert.NotNull(projection.OneYear);

        // Daily rate should be approximately $100 / 50 days = $2/day
        Assert.InRange(projection.OneDay.Value, 1.9m, 2.1m);
        Assert.InRange(projection.OneWeek.Value, 13m, 15m);
        Assert.InRange(projection.OneMonth.Value, 57m, 63m);
        Assert.InRange(projection.OneYear.Value, 700m, 770m);

        // Historical APR: ($100 / $1,000) * (365 / 50) * 100 = 10% * 7.3 = 73%
        Assert.InRange(aprHistorical.Value, 70m, 75m);
    }

    [Fact]
    public void CalculateAprHistoricalProjection_WithZeroFees_ReturnsNull()
    {
        // Arrange
        decimal currentValueUsd = 1000m;
        long createdAt = DateTimeOffset.UtcNow.AddDays(-10).ToUnixTimeSeconds();
        long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // Act
        var (projection, aprHistorical) = _calculator.CalculateAprHistoricalProjection(
            0m, currentValueUsd, createdAt, now);

        // Assert
        Assert.Null(projection);
        Assert.Null(aprHistorical);
    }

    [Fact]
    public void CalculateAprHistoricalProjection_WithZeroValue_ReturnsNull()
    {
        // Arrange
        decimal totalFees = 100m;
        long createdAt = DateTimeOffset.UtcNow.AddDays(-10).ToUnixTimeSeconds();
        long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // Act
        var (projection, aprHistorical) = _calculator.CalculateAprHistoricalProjection(
            totalFees, 0m, createdAt, now);

        // Assert
        Assert.Null(projection);
        Assert.Null(aprHistorical);
    }

    [Fact]
    public void CalculateAprHistoricalProjection_WithRecentPosition_ReturnsNull()
    {
        // Arrange - Position created 1 hour ago (too recent)
        decimal totalFees = 10m;
        decimal currentValueUsd = 1000m;
        long createdAt = DateTimeOffset.UtcNow.AddHours(-1).ToUnixTimeSeconds();
        long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // Act
        var (projection, aprHistorical) = _calculator.CalculateAprHistoricalProjection(
            totalFees, currentValueUsd, createdAt, now);

        // Assert
        Assert.Null(projection); // Too recent, less than 2.4 hours
        Assert.Null(aprHistorical);
    }

    #endregion

    #region Fees24h Projection Tests

    [Fact]
    public void CalculateFees24hProjection_WithValidFees_ReturnsCorrectProjections()
    {
        // Arrange
        decimal fees24h = 10m; // $10 in 24h

        // Act
        var result = _calculator.CalculateFees24hProjection(fees24h);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(10m, result.OneDay.Value);
        Assert.Equal(70m, result.OneWeek.Value);
        Assert.Equal(300m, result.OneMonth.Value);
        Assert.Equal(3650m, result.OneYear.Value);
    }

    [Fact]
    public void CalculateFees24hProjection_WithZeroFees_ReturnsNull()
    {
        // Act
        var result = _calculator.CalculateFees24hProjection(0m);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void CalculateFees24hProjection_WithNegativeFees_ReturnsNull()
    {
        // Act
        var result = _calculator.CalculateFees24hProjection(-5m);

        // Assert
        Assert.Null(result);
    }

    #endregion

    #region CreateProjectionData Tests

    [Fact]
    public void CreateProjectionData_WithAllParameters_ReturnsCompleteObject()
    {
        // Arrange
        var projection = new Projection
        {
            OneDay = 1m,
            OneWeek = 7m,
            OneMonth = 30m,
            OneYear = 365m
        };
        var metadata = new ProjectionMetadata
        {
            Apr = 10m,
            CreatedAt = 1704067200
        };

        // Act
        var result = _calculator.CreateProjectionData("apr", projection, metadata);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("apr", result.Type);
        Assert.Equal(projection, result.Projection);
        Assert.Equal(metadata, result.Metadata);
    }

    [Fact]
    public void CreateProjectionData_WithoutMetadata_ReturnsObjectWithNullMetadata()
    {
        // Arrange
        var projection = new Projection { OneDay = 1m };

        // Act
        var result = _calculator.CreateProjectionData("createdAt", projection);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("createdAt", result.Type);
        Assert.Equal(projection, result.Projection);
        Assert.Null(result.Metadata);
    }

    #endregion
}
