using DeFi10.API.Models;

namespace DeFi10.API.Services.Helpers;

public interface IProjectionCalculator
{
    /// <summary>
    /// Calculate projection based on APR (Annual Percentage Rate)
    /// </summary>
    Projection? CalculateAprProjection(decimal? currentValueUsd, decimal? aprPercentage);
    
    /// <summary>
    /// Calculate projection based on APY (Annual Percentage Yield) with compounding
    /// </summary>
    Projection? CalculateApyProjection(decimal? currentValueUsd, decimal? apyPercentage);
    
    /// <summary>
    /// Calculate projection based on actual fees generated since position creation
    /// Uses historical data to extrapolate future earnings
    /// </summary>
    Projection? CalculateCreatedAtProjection(
        decimal totalFeesGenerated,
        long createdAtTimestamp,
        long currentTimestamp);
    
    /// <summary>
    /// Calculate projection based on historical APR derived from actual fees since position creation
    /// Returns both the projection and the calculated historical APR percentage
    /// </summary>
    (Projection? projection, decimal? aprHistorical) CalculateAprHistoricalProjection(
        decimal totalFeesGenerated,
        decimal currentValueUsd,
        long createdAtTimestamp,
        long currentTimestamp);
    
    /// <summary>
    /// Calculate projection based on 24-hour fees
    /// Multiplies daily fees across different time ranges
    /// </summary>
    Projection? CalculateFees24hProjection(decimal fees24h);
    
    /// <summary>
    /// Create a ProjectionData object with type and metadata
    /// </summary>
    ProjectionData CreateProjectionData(
        string type,
        Projection projection,
        ProjectionMetadata? metadata = null);
}

public class ProjectionCalculator : IProjectionCalculator
{
    public Projection? CalculateAprProjection(decimal? currentValueUsd, decimal? aprPercentage)
    {
        if (!currentValueUsd.HasValue || !aprPercentage.HasValue || currentValueUsd.Value <= 0)
            return null;

        var apr = aprPercentage.Value / 100m;
        var principal = currentValueUsd.Value;

        return new Projection
        {
            OneDay = principal * apr / 365m,
            OneWeek = principal * apr / 52m,
            OneMonth = principal * apr / 12m,
            OneYear = principal * apr
        };
    }

    public Projection? CalculateApyProjection(decimal? currentValueUsd, decimal? apyPercentage)
    {
        if (!currentValueUsd.HasValue || !apyPercentage.HasValue || currentValueUsd.Value <= 0)
            return null;

        var apy = apyPercentage.Value / 100m;
        var principal = currentValueUsd.Value;

        var dailyRate = apy / 365m;
        var weeklyRate = apy / 52m;
        var monthlyRate = apy / 12m;

        return new Projection
        {
            OneDay = principal * dailyRate,
            OneWeek = principal * weeklyRate,
            OneMonth = principal * monthlyRate,
            OneYear = principal * apy
        };
    }

    public Projection? CalculateCreatedAtProjection(
        decimal totalFeesGenerated,
        long createdAtTimestamp,
        long currentTimestamp)
    {
        if (totalFeesGenerated <= 0 || createdAtTimestamp <= 0 || currentTimestamp <= createdAtTimestamp)
            return null;

        try
        {
            var createdAt = DateTimeOffset.FromUnixTimeSeconds(createdAtTimestamp);
            var now = DateTimeOffset.FromUnixTimeSeconds(currentTimestamp);
            var daysActive = (now - createdAt).TotalDays;

            // Position too recent (less than 2.4 hours) - not enough data for reliable projection
            if (daysActive < 0.1)
                return null;

            // Calculate daily rate based on actual historical performance
            var dailyRate = totalFeesGenerated / (decimal)daysActive;

            return new Projection
            {
                OneDay = dailyRate,
                OneWeek = dailyRate * 7m,
                OneMonth = dailyRate * 30m,
                OneYear = dailyRate * 365m
            };
        }
        catch (ArgumentOutOfRangeException)
        {
            // Invalid timestamp
            return null;
        }
    }

    public (Projection? projection, decimal? aprHistorical) CalculateAprHistoricalProjection(
        decimal totalFeesGenerated,
        decimal currentValueUsd,
        long createdAtTimestamp,
        long currentTimestamp)
    {
        if (totalFeesGenerated <= 0 || currentValueUsd <= 0 || 
            createdAtTimestamp <= 0 || currentTimestamp <= createdAtTimestamp)
            return (null, null);

        try
        {
            var createdAt = DateTimeOffset.FromUnixTimeSeconds(createdAtTimestamp);
            var now = DateTimeOffset.FromUnixTimeSeconds(currentTimestamp);
            var daysActive = (now - createdAt).TotalDays;

            // Position too recent (less than 2.4 hours) - not enough data for reliable projection
            if (daysActive < 0.1)
                return (null, null);

            // Calculate daily rate based on actual historical performance
            var dailyRate = totalFeesGenerated / (decimal)daysActive;

            // Calculate historical APR: (totalFees / currentValue) * (365 / daysActive) * 100
            var aprHistorical = (totalFeesGenerated / currentValueUsd) * (365m / (decimal)daysActive) * 100m;

            var projection = new Projection
            {
                OneDay = dailyRate,
                OneWeek = dailyRate * 7m,
                OneMonth = dailyRate * 30m,
                OneYear = dailyRate * 365m
            };

            return (projection, aprHistorical);
        }
        catch (ArgumentOutOfRangeException)
        {
            // Invalid timestamp
            return (null, null);
        }
    }

    public Projection? CalculateFees24hProjection(decimal fees24h)
    {
        if (fees24h <= 0)
            return null;

        return new Projection
        {
            OneDay = fees24h,
            OneWeek = fees24h * 7m,
            OneMonth = fees24h * 30m,
            OneYear = fees24h * 365m
        };
    }

    public ProjectionData CreateProjectionData(
        string type,
        Projection projection,
        ProjectionMetadata? metadata = null)
    {
        return new ProjectionData
        {
            Type = type,
            Projection = projection,
            Metadata = metadata
        };
    }
}
