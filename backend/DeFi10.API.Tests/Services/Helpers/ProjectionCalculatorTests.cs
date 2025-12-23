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
    public void CalculateApyProjection_WithValidInputs_ReturnsCorrectProjections()
    {
        // Arrange
        decimal currentValue = 10000m; // $10,000
        decimal apy = 10m; // 10% APY

        // Act
        var result = _calculator.CalculateApyProjection(currentValue, apy);

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.OneDay);
        Assert.NotNull(result.OneWeek);
        Assert.NotNull(result.OneMonth);
        Assert.NotNull(result.OneYear);

        // APY includes compounding, so daily gains are slightly less than linear APR
        // For 10% APY, daily rate = (1.10)^(1/365) - 1 ≈ 0.026%
        // Daily: $10,000 * 0.026% ≈ $2.60
        Assert.InRange(result.OneDay.Value, 2.55m, 2.65m);
        
        // For one year with APY, it's exactly the APY percentage
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
    public void CalculateAprProjection_WithZeroApr_ReturnsNull()
    {
        // Act
        var result = _calculator.CalculateAprProjection(10000m, 0m);

        // Assert
        Assert.Null(result);
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
}
