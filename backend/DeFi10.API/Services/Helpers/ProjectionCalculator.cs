using DeFi10.API.Models;

namespace DeFi10.API.Services.Helpers;

public interface IProjectionCalculator
{
    Projection? CalculateAprProjection(decimal? currentValueUsd, decimal? aprPercentage);
    Projection? CalculateApyProjection(decimal? currentValueUsd, decimal? apyPercentage);
}

public class ProjectionCalculator : IProjectionCalculator
{
    public Projection? CalculateAprProjection(decimal? currentValueUsd, decimal? aprPercentage)
    {
        if (!currentValueUsd.HasValue || !aprPercentage.HasValue || currentValueUsd.Value <= 0 || aprPercentage.Value == 0)
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
        if (!currentValueUsd.HasValue || !apyPercentage.HasValue || currentValueUsd.Value <= 0 || apyPercentage.Value == 0)
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
}
